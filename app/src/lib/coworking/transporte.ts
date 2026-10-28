"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { MensajeChat, Presencia } from "./tipos";

// Cómo se comunica la sala con los demás. Hay dos implementaciones con la misma interfaz:
//  - Supabase: Realtime privado (presencia + broadcast) y el chat en la tabla mensajes.
//  - Local: BroadcastChannel entre pestañas del mismo navegador (pruebas y demo sin internet).

export type Senal = { de: string; para: string; tipo: "offer" | "answer" | "ice"; datos: unknown };
export type Movimiento = { id: string; x: number; y: number };

export type Transporte = {
  conectar(yo: Presencia): Promise<void>;
  /** Presencia (quién está, avatar, voz): Supabase la limita mucho, se envía como mucho cada 5 s y nunca al moverse */
  actualizar(yo: Presencia): void;
  /** Movimiento: viaja por broadcast (la sala lo repite cada pocos segundos para quien acaba de entrar) */
  enviarMovimiento(m: Movimiento): void;
  enviarSenal(s: Senal): void;
  enviarMensaje(texto: string): Promise<{ error?: string }>;
  alCambiarPresencia(cb: (personas: Presencia[]) => void): void;
  alRecibirSenal(cb: (s: Senal) => void): void;
  alRecibirMovimiento(cb: (m: Movimiento) => void): void;
  alRecibirMensaje(cb: (m: MensajeChat) => void): void;
  alCambiarEstado(cb: (estado: "conectando" | "conectado" | "error") => void): void;
  desconectar(): void;
};

type Oyentes = {
  presencia: ((p: Presencia[]) => void)[];
  senal: ((s: Senal) => void)[];
  movimiento: ((m: Movimiento) => void)[];
  mensaje: ((m: MensajeChat) => void)[];
  estado: ((e: "conectando" | "conectado" | "error") => void)[];
};
const nuevosOyentes = (): Oyentes => ({ presencia: [], senal: [], movimiento: [], mensaje: [], estado: [] });

/** Limita la frecuencia de un envío; el último valor pendiente siempre se envía (Realtime tiene límites por cliente). */
export function limitado<T>(fn: (v: T) => void, ms: number) {
  let ultimo = 0;
  let pendiente: T | null = null;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  return (v: T) => {
    const ahora = Date.now();
    if (ahora - ultimo >= ms) {
      ultimo = ahora;
      fn(v);
    } else {
      pendiente = v;
      temporizador ??= setTimeout(() => {
        temporizador = null;
        ultimo = Date.now();
        if (pendiente) fn(pendiente);
        pendiente = null;
      }, ms - (ahora - ultimo));
    }
  };
}

export function crearTransporteSupabase(
  supabase: SupabaseClient<Database>,
  opciones: { sala: string; idCanal: string; nombres: Map<string, string> },
): Transporte {
  const o = nuevosOyentes();
  let canal: ReturnType<SupabaseClient["channel"]> | null = null;
  let miId = "";
  let yoActual: Presencia | null = null;
  let cerrado = false;
  let reintento: ReturnType<typeof setTimeout> | null = null;

  const avisarPresencia = () => {
    if (!canal) return;
    const estado = canal.presenceState<Presencia>();
    const personas = Object.values(estado)
      .map((metas) => metas.at(-1))
      .filter((p): p is Presencia & { presence_ref: string } => Boolean(p?.id));
    for (const p of personas) opciones.nombres.set(p.id, p.nombre);
    o.presencia.forEach((cb) => cb(personas));
  };
  // ClientPresenceRateLimitReached: con actualizaciones muy seguidas Supabase deja de difundir la presencia
  // y expulsa al cliente del canal: por eso la presencia cambia poco y la posición va por broadcast
  const rastrear = limitado((yo: Presencia) => void canal?.track(yo), 5000);
  // Solo con el canal unido: si no, supabase-js manda cada mensaje por HTTP
  const enviar = (event: string, payload: unknown) => {
    if (canal?.state === "joined") void canal.send({ type: "broadcast", event, payload });
  };
  const mover = limitado((m: Movimiento) => enviar("mover", m), 150);

  // Si el canal se cae (límite de Realtime, red, token vencido) se vuelve a entrar solo
  const reconectar = () => {
    if (cerrado || reintento) return;
    o.estado.forEach((cb) => cb("conectando"));
    reintento = setTimeout(() => {
      reintento = null;
      void abrir().catch(reconectar);
    }, 3000);
  };

  const abrir = async () => {
    if (canal) void supabase.removeChannel(canal);
    canal = null;
    o.estado.forEach((cb) => cb("conectando"));
    await supabase.realtime.setAuth(); // canal privado: Realtime valida el JWT contra las políticas
    const nuevo = supabase.channel(`coworking:${opciones.sala}`, {
      config: { private: true, presence: { key: miId }, broadcast: { self: false } },
    });
    canal = nuevo;
    nuevo
      .on("presence", { event: "sync" }, avisarPresencia)
      .on("broadcast", { event: "mover" }, ({ payload }) => o.movimiento.forEach((cb) => cb(payload as Movimiento)))
      .on("broadcast", { event: "senal" }, ({ payload }) => {
        const s = payload as Senal;
        if (s.para === miId) o.senal.forEach((cb) => cb(s));
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes", filter: `id_canal=eq.${opciones.idCanal}` },
        ({ new: m }) => {
          const fila = m as { id: string; id_autor: string; contenido: string; creado_en: string };
          o.mensaje.forEach((cb) =>
            cb({
              id: fila.id,
              idAutor: fila.id_autor,
              autor: opciones.nombres.get(fila.id_autor) ?? "Miembro",
              texto: fila.contenido,
              fecha: fila.creado_en,
            }),
          );
        },
      )
      .subscribe(async (estado) => {
        if (canal !== nuevo) return; // un canal viejo que se está cerrando
        if (estado === "SUBSCRIBED") {
          if (yoActual) await nuevo.track(yoActual);
          o.estado.forEach((cb) => cb("conectado"));
        } else if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT" || estado === "CLOSED") {
          if (cerrado) return;
          o.estado.forEach((cb) => cb("error"));
          reconectar();
        }
      });
  };

  return {
    async conectar(yo) {
      miId = yo.id;
      yoActual = yo;
      cerrado = false;
      await abrir();
    },
    actualizar(yo) {
      yoActual = yo;
      rastrear(yo);
    },
    enviarMovimiento: (m) => mover(m),
    enviarSenal: (s) => enviar("senal", s),
    async enviarMensaje(texto) {
      const { error } = await supabase.from("mensajes").insert({ id_canal: opciones.idCanal, contenido: texto });
      return error ? { error: "No se pudo enviar el mensaje." } : {};
    },
    alCambiarPresencia: (cb) => void o.presencia.push(cb),
    alRecibirSenal: (cb) => void o.senal.push(cb),
    alRecibirMovimiento: (cb) => void o.movimiento.push(cb),
    alRecibirMensaje: (cb) => void o.mensaje.push(cb),
    alCambiarEstado: (cb) => void o.estado.push(cb),
    desconectar() {
      cerrado = true;
      if (reintento) clearTimeout(reintento);
      if (canal) void supabase.removeChannel(canal);
      canal = null;
    },
  };
}

/** Transporte local entre pestañas (BroadcastChannel): mismo comportamiento sin servidor. */
export function crearTransporteLocal(sala: string): Transporte {
  const o = nuevosOyentes();
  const bc = new BroadcastChannel(`coworking-local:${sala}`);
  const personas = new Map<string, Presencia & { visto: number }>();
  let yo: Presencia | null = null;
  let latido: ReturnType<typeof setInterval> | null = null;

  const avisar = () => {
    const ahora = Date.now();
    for (const [id, p] of personas) if (ahora - p.visto > 6000) personas.delete(id);
    o.presencia.forEach((cb) => cb([...(yo ? [yo] : []), ...personas.values()]));
  };
  const anunciar = () => yo && bc.postMessage({ t: "presencia", p: yo });

  bc.onmessage = ({ data }) => {
    if (data.t === "presencia") {
      const nuevo = !personas.has(data.p.id);
      personas.set(data.p.id, { ...data.p, visto: Date.now() });
      if (nuevo) anunciar(); // que el recién llegado también nos vea
      avisar();
    } else if (data.t === "salida") {
      personas.delete(data.id);
      avisar();
    } else if (data.t === "mover") {
      o.movimiento.forEach((cb) => cb(data.m));
    } else if (data.t === "senal" && yo && data.s.para === yo.id) {
      o.senal.forEach((cb) => cb(data.s));
    } else if (data.t === "mensaje") {
      o.mensaje.forEach((cb) => cb(data.m));
    }
  };

  return {
    async conectar(p) {
      yo = p;
      anunciar();
      latido = setInterval(() => {
        anunciar();
        avisar();
      }, 2000);
      avisar();
      o.estado.forEach((cb) => cb("conectado"));
    },
    actualizar(p) {
      yo = p;
      anunciar();
      avisar();
    },
    enviarMovimiento: (m) => bc.postMessage({ t: "mover", m }),
    enviarSenal: (s) => bc.postMessage({ t: "senal", s }),
    async enviarMensaje(texto) {
      if (!yo) return { error: "Sin conexión" };
      const m: MensajeChat = { id: crypto.randomUUID(), idAutor: yo.id, autor: yo.nombre, texto, fecha: new Date().toISOString() };
      bc.postMessage({ t: "mensaje", m });
      o.mensaje.forEach((cb) => cb(m));
      return {};
    },
    alCambiarPresencia: (cb) => void o.presencia.push(cb),
    alRecibirSenal: (cb) => void o.senal.push(cb),
    alRecibirMovimiento: (cb) => void o.movimiento.push(cb),
    alRecibirMensaje: (cb) => void o.mensaje.push(cb),
    alCambiarEstado: (cb) => void o.estado.push(cb),
    desconectar() {
      if (latido) clearInterval(latido);
      if (yo) bc.postMessage({ t: "salida", id: yo.id });
      bc.close();
    },
  };
}
