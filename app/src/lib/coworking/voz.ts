"use client";

import type { Senal, Transporte } from "./transporte";

// Chat de voz entre los navegadores (WebRTC, malla: una conexión por cada par de personas en la voz).
// La señalización (offer/answer/ICE) viaja por el transporte de la sala; el audio va directo entre
// navegadores. Para no chocar, inicia la conexión quien tenga el id menor.
//
// Redes cerradas (Wi-Fi institucional, datos móviles con NAT estricto) bloquean la conexión directa:
// para esas hace falta un servidor TURN, que se configura con NEXT_PUBLIC_TURN_URL / _USUARIO / _CLAVE.

function servidoresIce(): RTCIceServer[] {
  const servidores: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
  ];
  const turn = process.env.NEXT_PUBLIC_TURN_URL;
  if (turn) {
    servidores.push({
      urls: turn.split(",").map((u) => u.trim()).filter(Boolean),
      username: process.env.NEXT_PUBLIC_TURN_USUARIO,
      credential: process.env.NEXT_PUBLIC_TURN_CLAVE,
    });
  }
  return servidores;
}
export const hayTurn = () => Boolean(process.env.NEXT_PUBLIC_TURN_URL);

export type EstadoPar = "conectando" | "conectado" | "fallo";
type Par = { pc: RTCPeerConnection; audio: HTMLAudioElement; candidatosPendientes: RTCIceCandidateInit[]; reloj?: ReturnType<typeof setTimeout> };

const ESPERA_REINTENTO_MS = 2500;
const MAX_REINTENTOS = 4;

export class Voz {
  private pares = new Map<string, Par>();
  /** Candidatos que llegan antes que la oferta (la red no garantiza el orden): se guardan hasta crear el par */
  private sinPar = new Map<string, RTCIceCandidateInit[]>();
  private fallos = new Map<string, number>();
  private enVoz: string[] = [];
  private microfono: MediaStream | null = null;
  private alCambiar: () => void;

  constructor(
    private miId: string,
    private transporte: Transporte,
    alCambiar: () => void = () => {},
  ) {
    this.alCambiar = alCambiar;
    transporte.alRecibirSenal((s) => void this.manejarSenal(s).catch(() => {}));
  }

  get activa() {
    return this.microfono !== null;
  }

  /** Pide el micrófono (debe llamarse desde un clic: los navegadores lo exigen). */
  async activar() {
    if (this.microfono) return;
    this.microfono = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.fallos.clear();
    this.alCambiar();
  }

  silenciar(silenciado: boolean) {
    this.microfono?.getAudioTracks().forEach((t) => (t.enabled = !silenciado));
  }

  desactivar() {
    for (const id of [...this.pares.keys()]) this.cerrar(id);
    this.microfono?.getTracks().forEach((t) => t.stop());
    this.microfono = null;
    this.sinPar.clear();
    this.alCambiar();
  }

  /**
   * Se llama con la lista de ids que están en la voz (al cambiar la presencia y cada pocos segundos):
   * abre las conexiones que faltan, cierra las sobrantes y reintenta las que fallaron.
   */
  sincronizar(enVoz: string[]) {
    this.enVoz = enVoz;
    if (!this.microfono) return;
    const otros = new Set(enVoz.filter((id) => id !== this.miId));
    for (const id of [...this.pares.keys()]) if (!otros.has(id)) this.cerrar(id);
    for (const id of otros) {
      if (this.pares.has(id) || this.miId > id) continue;
      if ((this.fallos.get(id) ?? 0) > MAX_REINTENTOS) continue;
      void this.llamar(id).catch(() => this.fallo(id));
    }
  }

  /** Volumen (0 a 1) de cada persona según la distancia en la sala. */
  ajustarVolumen(id: string, volumen: number) {
    const par = this.pares.get(id);
    if (par) par.audio.volume = Math.max(0, Math.min(1, volumen));
  }

  conectados(): string[] {
    return [...this.pares.entries()].filter(([, p]) => p.pc.connectionState === "connected").map(([id]) => id);
  }

  /** Estado de la conexión con cada persona, para mostrarlo en la sala. */
  estados(): Record<string, EstadoPar> {
    const r: Record<string, EstadoPar> = {};
    for (const [id, p] of this.pares) r[id] = p.pc.connectionState === "connected" ? "conectado" : "conectando";
    for (const [id, n] of this.fallos) if (!r[id] && n > MAX_REINTENTOS) r[id] = "fallo";
    return r;
  }

  private crearPar(id: string): Par {
    const pc = new RTCPeerConnection({ iceServers: servidoresIce() });
    // El audio va en el documento (oculto): Safari en iPhone no reproduce un <audio> suelto
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "");
    audio.hidden = true;
    document.body.appendChild(audio);
    const par: Par = { pc, audio, candidatosPendientes: [] };
    this.microfono?.getTracks().forEach((t) => pc.addTrack(t, this.microfono!));
    pc.ontrack = ({ streams }) => {
      audio.srcObject = streams[0];
      void audio.play().catch(() => {});
    };
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.transporte.enviarSenal({ de: this.miId, para: id, tipo: "ice", datos: candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      const estado = pc.connectionState;
      if (estado === "connected") {
        this.fallos.delete(id);
        if (par.reloj) clearTimeout(par.reloj);
      } else if (estado === "failed") {
        this.fallo(id);
      } else if (estado === "disconnected") {
        // Un corte breve se recupera solo; si dura, se vuelve a conectar
        par.reloj = setTimeout(() => pc.connectionState === "disconnected" && this.fallo(id), 5000);
      }
      this.alCambiar();
    };
    this.pares.set(id, par);
    return par;
  }

  /** La conexión falló: se cierra y se vuelve a intentar unas veces (la inicia quien tiene el id menor). */
  private fallo(id: string) {
    this.cerrar(id);
    this.fallos.set(id, (this.fallos.get(id) ?? 0) + 1);
    this.alCambiar();
    setTimeout(() => this.sincronizar(this.enVoz), ESPERA_REINTENTO_MS);
  }

  private async llamar(id: string) {
    const { pc } = this.crearPar(id);
    const oferta = await pc.createOffer();
    await pc.setLocalDescription(oferta);
    this.transporte.enviarSenal({ de: this.miId, para: id, tipo: "offer", datos: oferta });
  }

  private async manejarSenal(s: Senal) {
    if (!this.microfono) return; // quien no está en la voz no contesta
    if (s.tipo === "offer") {
      if (this.pares.has(s.de)) this.cerrar(s.de); // reconexión: se empieza de cero
      const par = this.crearPar(s.de);
      par.candidatosPendientes.push(...(this.sinPar.get(s.de) ?? []));
      this.sinPar.delete(s.de);
      await par.pc.setRemoteDescription(s.datos as RTCSessionDescriptionInit);
      await this.aplicarPendientes(par);
      const respuesta = await par.pc.createAnswer();
      await par.pc.setLocalDescription(respuesta);
      this.transporte.enviarSenal({ de: this.miId, para: s.de, tipo: "answer", datos: respuesta });
    } else if (s.tipo === "answer") {
      const par = this.pares.get(s.de);
      if (par && par.pc.signalingState === "have-local-offer") {
        await par.pc.setRemoteDescription(s.datos as RTCSessionDescriptionInit);
        await this.aplicarPendientes(par);
      }
    } else if (s.tipo === "ice") {
      const par = this.pares.get(s.de);
      const candidato = s.datos as RTCIceCandidateInit;
      if (!par) {
        // Llegó antes que la oferta: se guarda (con tope, por si nunca llega)
        const lista = this.sinPar.get(s.de) ?? [];
        if (lista.length < 50) lista.push(candidato);
        this.sinPar.set(s.de, lista);
        return;
      }
      // Los candidatos pueden llegar antes que la descripción remota: se guardan para después
      if (par.pc.remoteDescription) await par.pc.addIceCandidate(candidato).catch(() => {});
      else par.candidatosPendientes.push(candidato);
    }
  }

  private async aplicarPendientes(par: Par) {
    for (const c of par.candidatosPendientes.splice(0)) await par.pc.addIceCandidate(c).catch(() => {});
  }

  private cerrar(id: string) {
    const par = this.pares.get(id);
    if (!par) return;
    if (par.reloj) clearTimeout(par.reloj);
    par.pc.close();
    par.audio.srcObject = null;
    par.audio.remove();
    this.pares.delete(id);
    this.alCambiar();
  }
}
