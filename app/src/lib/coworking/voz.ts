"use client";

import type { Senal, Transporte } from "./transporte";

// Chat de voz entre los navegadores (WebRTC, malla: una conexión por cada par de personas en la voz).
// La señalización (offer/answer/ICE) viaja por el transporte de la sala; el audio va directo entre
// navegadores. Para no chocar, inicia la conexión quien tenga el id menor.
// Sin servidor TURN: en redes muy cerradas la conexión directa puede fallar.

const ICE: RTCConfiguration = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

type Par = { pc: RTCPeerConnection; audio: HTMLAudioElement; candidatosPendientes: RTCIceCandidateInit[] };

export class Voz {
  private pares = new Map<string, Par>();
  private microfono: MediaStream | null = null;
  private alCambiar: () => void;

  constructor(
    private miId: string,
    private transporte: Transporte,
    alCambiar: () => void = () => {},
  ) {
    this.alCambiar = alCambiar;
    transporte.alRecibirSenal((s) => void this.manejarSenal(s));
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
    this.alCambiar();
  }

  silenciar(silenciado: boolean) {
    this.microfono?.getAudioTracks().forEach((t) => (t.enabled = !silenciado));
  }

  desactivar() {
    for (const id of [...this.pares.keys()]) this.cerrar(id);
    this.microfono?.getTracks().forEach((t) => t.stop());
    this.microfono = null;
    this.alCambiar();
  }

  /** Se llama con la lista de ids que están en la voz: abre las conexiones que faltan y cierra las sobrantes. */
  sincronizar(enVoz: string[]) {
    if (!this.microfono) return;
    const otros = new Set(enVoz.filter((id) => id !== this.miId));
    for (const id of [...this.pares.keys()]) if (!otros.has(id)) this.cerrar(id);
    for (const id of otros) if (!this.pares.has(id) && this.miId < id) void this.llamar(id);
  }

  /** Volumen (0 a 1) de cada persona según la distancia en la sala. */
  ajustarVolumen(id: string, volumen: number) {
    const par = this.pares.get(id);
    if (par) par.audio.volume = Math.max(0, Math.min(1, volumen));
  }

  conectados(): string[] {
    return [...this.pares.entries()].filter(([, p]) => p.pc.connectionState === "connected").map(([id]) => id);
  }

  private crearPar(id: string): Par {
    const pc = new RTCPeerConnection(ICE);
    const audio = new Audio();
    audio.autoplay = true;
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
      if (pc.connectionState === "failed") this.cerrar(id);
      this.alCambiar();
    };
    this.pares.set(id, par);
    return par;
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
      if (!par) return;
      // Los candidatos pueden llegar antes que la descripción remota: se guardan para después
      if (par.pc.remoteDescription) await par.pc.addIceCandidate(s.datos as RTCIceCandidateInit).catch(() => {});
      else par.candidatosPendientes.push(s.datos as RTCIceCandidateInit);
    }
  }

  private async aplicarPendientes(par: Par) {
    for (const c of par.candidatosPendientes.splice(0)) await par.pc.addIceCandidate(c).catch(() => {});
  }

  private cerrar(id: string) {
    const par = this.pares.get(id);
    if (!par) return;
    par.pc.close();
    par.audio.srcObject = null;
    this.pares.delete(id);
    this.alCambiar();
  }
}
