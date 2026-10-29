"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Headphones, Loader2, Mic, MicOff, PhoneOff, Save, Send, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LADO,
  OBJETOS,
  baldosaInicial,
  baldosaLibre,
  semillaDe,
  volumenPorDistancia,
  type Avatar,
  type MensajeChat,
  type Presencia,
} from "@/lib/coworking/tipos";
import { crearTransporteLocal, crearTransporteSupabase, type Transporte } from "@/lib/coworking/transporte";
import { Voz } from "@/lib/coworking/voz";
import { crearClienteNavegador } from "@/lib/supabase/client";

// Geometría isométrica del demo original (baldosas de 64×32, sala de 8×8), con el lienzo ajustado a la sala
const ANCHO = 600;
const ALTO = 380;
const TW = 64;
const TH = 32;
const OX = 300;
const OY = 100;
const aPantalla = (gx: number, gy: number) => ({ x: ((gx - gy) * TW) / 2 + OX, y: ((gx + gy) * TH) / 2 + OY });
const aCuadricula = (px: number, py: number) => {
  const a = (px - OX) / (TW / 2);
  const b = (py - OY) / (TH / 2);
  return { gx: Math.floor((a + b) / 2), gy: Math.floor((b - a) / 2) };
};

type Movil = Presencia & { px: number; py: number; ultimoMovimiento?: number }; // px/py = posición animada

type Props = {
  yo: { id: string; nombre: string; rol: string };
  /** "principal" o el id de una sala creada: cada sala es un canal de Realtime distinto */
  sala: string;
  avatarInicial: Avatar;
  historial: MensajeChat[];
  /** "supabase" en la app; "local" (entre pestañas del mismo navegador) para pruebas y demo sin internet */
  modo: { tipo: "supabase"; idCanal: string; nombres: [string, string][] } | { tipo: "local" };
  guardarAvatar?: (avatar: Avatar) => Promise<{ error?: string } | undefined>;
};

export function SalaCoworking({ yo: identidad, sala, avatarInicial, historial, modo, guardarAvatar }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const transporte = useRef<Transporte | null>(null);
  const voz = useRef<Voz | null>(null);
  const otros = useRef(new Map<string, Movil>());
  const [avatar, setAvatar] = useState<Avatar>(avatarInicial);
  const inicio = useMemo(() => baldosaInicial([], semillaDe(identidad.id)), [identidad.id]);
  const yo = useRef<Movil>({ ...identidad, avatar: avatarInicial, x: inicio.x, y: inicio.y, px: inicio.x, py: inicio.y, enVoz: false, silenciado: false });
  const [personas, setPersonas] = useState<Presencia[]>([]);
  const [estado, setEstado] = useState<"conectando" | "conectado" | "error">("conectando");
  const [mensajes, setMensajes] = useState<MensajeChat[]>(historial);
  const [texto, setTexto] = useState("");
  const [enVoz, setEnVoz] = useState(false);
  const [silenciado, setSilenciado] = useState(false);
  const [conectadosVoz, setConectadosVoz] = useState<string[]>([]);
  const [errorVoz, setErrorVoz] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();
  const [avisoAvatar, setAvisoAvatar] = useState<string | null>(null);
  const finChat = useRef<HTMLDivElement>(null);

  const publicar = useCallback(() => {
    const { px: _px, py: _py, ...presencia } = yo.current;
    void _px;
    void _py;
    transporte.current?.actualizar(presencia);
  }, []);

  // Conexión con la sala: depende solo de valores estables (un objeto nuevo en props no debe reconectar)
  const modoActual = useRef(modo);
  const idCanal = modo.tipo === "supabase" ? modo.idCanal : null;
  useEffect(() => {
    const modo = modoActual.current;
    const t =
      modo.tipo === "supabase"
        ? crearTransporteSupabase(crearClienteNavegador(), { sala, idCanal: modo.idCanal, nombres: new Map(modo.nombres) })
        : crearTransporteLocal(sala);
    transporte.current = t;
    const v = new Voz(identidad.id, t, () => setConectadosVoz(v.conectados()));
    voz.current = v;

    t.alCambiarEstado(setEstado);
    t.alCambiarPresencia((lista) => {
      const vistos = new Set<string>();
      for (const p of lista) {
        if (p.id === identidad.id) continue;
        vistos.add(p.id);
        const previo = otros.current.get(p.id);
        // La posición la manda el broadcast de movimiento (repetido cada 2 s); la de la presencia solo
        // sirve mientras no haya llegado ninguno.
        const reciente = Boolean(previo?.ultimoMovimiento);
        otros.current.set(
          p.id,
          previo
            ? { ...p, x: reciente ? previo.x : p.x, y: reciente ? previo.y : p.y, px: previo.px, py: previo.py, ultimoMovimiento: previo.ultimoMovimiento }
            : { ...p, px: p.x, py: p.y },
        );
      }
      for (const id of [...otros.current.keys()]) if (!vistos.has(id)) otros.current.delete(id);
      setPersonas(lista.filter((p) => p.id !== identidad.id));
      v.sincronizar(lista.filter((p) => p.enVoz).map((p) => p.id));
    });
    t.alRecibirMovimiento((m) => {
      const o = otros.current.get(m.id);
      if (o && Number.isFinite(m.x) && Number.isFinite(m.y)) {
        o.x = m.x;
        o.y = m.y;
        o.ultimoMovimiento = Date.now();
      }
    });
    t.alRecibirMensaje((m) => setMensajes((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms.slice(-99), m])));
    const { px: _px, py: _py, ...presencia } = yo.current;
    void _px;
    void _py;
    void t.conectar(presencia).catch(() => setEstado("error"));

    return () => {
      v.desactivar();
      t.desconectar();
    };
  }, [identidad.id, sala, idCanal]);

  useEffect(() => {
    // Con llaves: en Chrome reciente scrollIntoView devuelve una promesa y un efecto solo puede devolver su limpieza
    finChat.current?.scrollIntoView({ block: "nearest" });
  }, [mensajes]);

  // La posición se repite cada 2 s: quien entra o se reconecta ve a cada uno donde está de verdad
  useEffect(() => {
    const intervalo = setInterval(() => {
      transporte.current?.enviarMovimiento({ id: identidad.id, x: yo.current.x, y: yo.current.y });
    }, 2000);
    return () => clearInterval(intervalo);
  }, [identidad.id]);

  // Volumen por cercanía: cada medio segundo según la distancia en la sala
  useEffect(() => {
    const intervalo = setInterval(() => {
      for (const o of otros.current.values()) {
        voz.current?.ajustarVolumen(o.id, volumenPorDistancia({ x: yo.current.px, y: yo.current.py }, { x: o.px, y: o.py }));
      }
    }, 500);
    return () => clearInterval(intervalo);
  }, []);

  // Dibujo de la sala (bucle de animación)
  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    let cuadro = 0;

    const rect = (x: number, y: number, dx: number, dy: number, w: number, h: number, c: string, px = 4) => {
      ctx.fillStyle = c;
      ctx.fillRect(x + dx * px, y + dy * px, w * px, h * px);
    };

    const dibujarAvatar = (m: Movil, esYo: boolean, moviendose: boolean, x: number, y: number) => {
      const a = m.avatar;
      const rebote = moviendose ? Math.abs(Math.sin(Date.now() / 100)) * 3 : 0;
      const paso = moviendose ? Math.sin(Date.now() / 100) * 2 : 0;
      const by = y - rebote;
      if (esYo) {
        ctx.fillStyle = "rgba(42,120,214,0.18)";
        ctx.beginPath();
        ctx.ellipse(x, y, 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      rect(x, by, -3, -16, 6, 2, a.pelo);
      rect(x, by, -3, -14, 6, 5, a.piel);
      rect(x, by, -4, -9, 8, 6, a.camiseta);
      rect(x, y, -3, -3, 2, 3 - paso, "#33415c");
      rect(x, y, 1, -3, 2, 3 + paso, "#33415c");
      if (a.accesorio === "audifonos") {
        rect(x, by, -4, -14, 1, 4, "#222");
        rect(x, by, 3, -14, 1, 4, "#222");
      } else if (a.accesorio === "gafas") {
        rect(x, by, -3, -12, 6, 1, "#111");
      }
      ctx.textAlign = "center";
      ctx.fillStyle = esYo ? "#1d4ed8" : "#333";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(`${m.enVoz ? (m.silenciado ? "🔇 " : "🎤 ") : ""}${m.nombre}`, x, y - 75);
      ctx.fillStyle = "#666";
      ctx.font = "10px sans-serif";
      ctx.fillText(`[${m.rol}]`, x, y - 63);
    };

    const dibujarObjeto = (x: number, y: number, tipo: string) => {
      if (tipo === "mesa") {
        rect(x, y, -6, -8, 12, 6, "#8b5a2b");
        rect(x, y, -5, -2, 2, 4, "#5c3a21");
        rect(x, y, 3, -2, 2, 4, "#5c3a21");
      } else if (tipo === "silla") {
        rect(x, y, -3, -5, 6, 2, "#444");
        rect(x, y, -3, -9, 2, 4, "#444");
      } else if (tipo === "pc") {
        rect(x, y, -2, -12, 4, 3, "#ccc");
        rect(x, y, -1, -9, 2, 1, "#999");
      } else if (tipo === "planta") {
        rect(x, y, -3, -5, 6, 5, "#c18553");
        rect(x, y, -4, -12, 8, 7, "#3a7d44");
      }
    };

    const acercar = (m: Movil) => {
      const dx = m.x - m.px;
      const dy = m.y - m.py;
      const d = Math.hypot(dx, dy);
      if (d > 0.05) {
        m.px += (dx / d) * Math.min(0.08, d);
        m.py += (dy / d) * Math.min(0.08, d);
        return true;
      }
      m.px = m.x;
      m.py = m.y;
      return false;
    };

    const bucle = () => {
      ctx.clearRect(0, 0, ANCHO, ALTO);
      for (let gx = 0; gx < LADO; gx++) {
        for (let gy = 0; gy < LADO; gy++) {
          const p = aPantalla(gx, gy);
          ctx.fillStyle = (gx + gy) % 2 ? "#e2e8f0" : "#cbd5e1";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + TW / 2, p.y + TH / 2);
          ctx.lineTo(p.x, p.y + TH);
          ctx.lineTo(p.x - TW / 2, p.y + TH / 2);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#94a3b8";
          ctx.stroke();
        }
      }
      const moviendo = new Map<string, boolean>();
      moviendo.set(identidad.id, acercar(yo.current));
      for (const o of otros.current.values()) moviendo.set(o.id, acercar(o));

      type Entidad = { orden: number; dibujar: () => void };
      const entidades: Entidad[] = [
        ...OBJETOS.map((o) => ({ orden: o.x + o.y, dibujar: () => { const p = aPantalla(o.x, o.y); dibujarObjeto(p.x, p.y, o.tipo); } })),
        ...[yo.current, ...otros.current.values()].map((m) => ({
          orden: m.px + m.py + 0.01,
          dibujar: () => {
            const p = aPantalla(m.px, m.py);
            const enSilla = OBJETOS.some((o) => o.tipo === "silla" && Math.abs(o.x - m.px) < 0.1 && Math.abs(o.y - m.py) < 0.1);
            dibujarAvatar(m, m.id === identidad.id, moviendo.get(m.id) ?? false, p.x, p.y + (enSilla ? 10 : 0));
          },
        })),
      ];
      entidades.sort((a, b) => a.orden - b.orden).forEach((e) => e.dibujar());
      cuadro = requestAnimationFrame(bucle);
    };
    bucle();
    return () => cancelAnimationFrame(cuadro);
  }, [identidad.id]);

  const moverA = (gx: number, gy: number) => {
    const ocupadas = [...otros.current.values()].map((o) => ({ x: o.x, y: o.y }));
    if (!baldosaLibre(gx, gy, ocupadas)) return;
    yo.current.x = gx + 0.5;
    yo.current.y = gy + 0.5;
    // Sin tocar la presencia: moverse seguido con ella hacía que Supabase sacara al jugador del canal
    transporte.current?.enviarMovimiento({ id: identidad.id, x: yo.current.x, y: yo.current.y });
  };

  const clicEnSala = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    // El canvas se escala para caber en pantalla: se traduce el clic a su resolución interna
    const c = aCuadricula(((e.clientX - r.left) * ANCHO) / r.width, ((e.clientY - r.top) * ALTO) / r.height);
    moverA(c.gx, c.gy);
  };

  const teclado = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const pasos: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const paso = pasos[e.key];
    if (!paso) return;
    e.preventDefault();
    moverA(Math.floor(yo.current.x) + paso[0], Math.floor(yo.current.y) + paso[1]);
  };

  const cambiarAvatar = (cambio: Partial<Avatar>) => {
    const nuevo = { ...avatar, ...cambio };
    setAvatar(nuevo);
    yo.current.avatar = nuevo;
    setAvisoAvatar(null);
    publicar();
  };

  const entrarVoz = async () => {
    setErrorVoz(null);
    try {
      await voz.current?.activar();
      yo.current.enVoz = true;
      yo.current.silenciado = false;
      setEnVoz(true);
      setSilenciado(false);
      publicar();
      voz.current?.sincronizar([identidad.id, ...personas.filter((p) => p.enVoz).map((p) => p.id)]);
    } catch {
      setErrorVoz("No se pudo usar el micrófono. Revisa el permiso del navegador.");
    }
  };
  const salirVoz = () => {
    voz.current?.desactivar();
    yo.current.enVoz = false;
    setEnVoz(false);
    publicar();
  };
  const alternarSilencio = () => {
    const nuevo = !silenciado;
    voz.current?.silenciar(nuevo);
    yo.current.silenciado = nuevo;
    setSilenciado(nuevo);
    publicar();
  };

  const enviar = async () => {
    const limpio = texto.trim();
    if (!limpio || !transporte.current) return;
    setTexto("");
    const r = await transporte.current.enviarMensaje(limpio.slice(0, 4000));
    if (r.error) setTexto(limpio);
  };

  const enVozOtros = personas.filter((p) => p.enVoz);

  return (
    <div className="space-y-4">
      {/* Barra: estado, voz y personas */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={estado === "conectado" ? "outline" : estado === "error" ? "destructive" : "secondary"}>
          {estado === "conectado" ? "● Conectado" : estado === "error" ? "Sin conexión con la sala" : "Conectando…"}
        </Badge>
        <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
          <Users className="size-4" aria-hidden /> {personas.length + 1} en la sala
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {enVoz ? (
            <>
              <Button size="sm" variant={silenciado ? "secondary" : "outline"} onClick={alternarSilencio}>
                {silenciado ? <MicOff aria-hidden /> : <Mic aria-hidden />} {silenciado ? "Activar micrófono" : "Silenciar"}
              </Button>
              <Button size="sm" variant="destructive" onClick={salirVoz}>
                <PhoneOff aria-hidden /> Salir de la voz
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={entrarVoz} disabled={estado !== "conectado"}>
              <Headphones aria-hidden /> Unirse a la voz
            </Button>
          )}
        </div>
      </div>
      {errorVoz && <p className="text-destructive text-sm">{errorVoz}</p>}
      {enVoz && (
        <p className="text-muted-foreground text-xs">
          En la voz: {enVozOtros.length ? enVozOtros.map((p) => `${p.nombre}${conectadosVoz.includes(p.id) ? "" : " (conectando…)"}`).join(", ") : "solo tú por ahora"}.
          Acércate a alguien para oírle mejor; a más de 6 baldosas no se oye.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-3">
          <canvas
            ref={canvas}
            width={ANCHO}
            height={ALTO}
            tabIndex={0}
            aria-label="Sala de coworking. Haz clic en una baldosa o usa las flechas para moverte."
            onClick={clicEnSala}
            onKeyDown={teclado}
            className="w-full cursor-pointer rounded-lg border bg-card focus-visible:ring-2 focus-visible:ring-[var(--serie-1)] focus-visible:outline-none"
            style={{ aspectRatio: `${ANCHO} / ${ALTO}`, imageRendering: "pixelated" }}
          />
          {/* Editor de avatar */}
          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Personalizar mi avatar</summary>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              {(["piel", "camiseta", "pelo"] as const).map((campo) => (
                <label key={campo} className="flex flex-col gap-1 text-xs capitalize">
                  {campo}
                  <input type="color" value={avatar[campo]} onChange={(e) => cambiarAvatar({ [campo]: e.target.value })} className="h-9 w-14 cursor-pointer rounded border" />
                </label>
              ))}
              <label className="flex flex-col gap-1 text-xs">
                Accesorio
                <select
                  value={avatar.accesorio}
                  onChange={(e) => cambiarAvatar({ accesorio: e.target.value as Avatar["accesorio"] })}
                  className="h-9 rounded-md border px-2 text-sm"
                >
                  <option value="ninguno">Ninguno</option>
                  <option value="audifonos">Audífonos</option>
                  <option value="gafas">Gafas</option>
                </select>
              </label>
              {guardarAvatar && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={guardando}
                  onClick={() =>
                    iniciarGuardado(async () => {
                      const r = await guardarAvatar(avatar);
                      setAvisoAvatar(r?.error ?? "Avatar guardado");
                    })
                  }
                >
                  {guardando ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />} Guardar
                </Button>
              )}
              {avisoAvatar && <span className="text-muted-foreground text-xs">{avisoAvatar}</span>}
            </div>
          </details>
        </div>

        {/* Chat de la sala */}
        <div className="flex h-[28rem] flex-col overflow-hidden rounded-lg border lg:h-auto lg:max-h-[36rem]">
          <p className="bg-[var(--serie-1)] px-3 py-2 text-sm font-semibold text-white">Chat del coworking</p>
          <div className="flex-1 space-y-2 overflow-y-auto bg-muted p-3 text-sm" aria-live="polite">
            {mensajes.length === 0 && <p className="text-muted-foreground text-xs">Nadie ha escrito todavía. ¡Saluda!</p>}
            {mensajes.map((m) => (
              <p key={m.id} className="break-words">
                <b className={m.idAutor === identidad.id ? "text-[var(--serie-1)]" : ""}>{m.idAutor === identidad.id ? "Tú" : m.autor}:</b> {m.texto}
              </p>
            ))}
            <div ref={finChat} />
          </div>
          <form
            className="flex gap-2 border-t p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
          >
            <Input aria-label="Mensaje" placeholder="Escribe aquí…" value={texto} maxLength={4000} onChange={(e) => setTexto(e.target.value)} />
            <Button type="submit" size="icon" aria-label="Enviar" disabled={!texto.trim() || estado !== "conectado"}>
              <Send aria-hidden />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
