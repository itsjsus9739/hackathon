"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Headphones, Loader2, Mic, MicOff, PhoneOff, Save, Send, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALTO, ANCHO, aCuadricula, cargarSprites, Escena, type Mascota, type Personaje, type Pose, type PoseBuho } from "@/lib/coworking/dibujo";
import {
  OPCIONES_AVATAR,
  baldosaInicial,
  baldosaLibre,
  buscarRuta,
  claveSilla,
  objetoEn,
  poseDesde,
  proximoReinicioChat,
  semillaDe,
  sillaPorClave,
  volumenPorDistancia,
  type Avatar,
  type MensajeChat,
  type Objeto,
  type Presencia,
} from "@/lib/coworking/tipos";
import { crearTransporteLocal, crearTransporteSupabase, type Movimiento, type Transporte } from "@/lib/coworking/transporte";
import { recorrer, segundosEntre, VELOCIDAD_BUHO, VELOCIDAD_PERSONA } from "@/lib/coworking/movimiento";
import { hayTurn, Voz, type EstadoPar } from "@/lib/coworking/voz";
import { NOMBRE_MASCOTA } from "@/lib/recorrido";
import { crearClienteNavegador } from "@/lib/supabase/client";

type Punto = { x: number; y: number };
/** Presencia + estado de la animación local (px/py = posición dibujada, ruta = baldosas por recorrer) */
type Movil = Presencia & { px: number; py: number; ruta: Punto[]; pose: Pose; sentado: Objeto | null; ultimoMovimiento?: number };

// Lo que dice Banu al hacerle clic (en orden, y vuelve a empezar)
const CONSEJOS = [
  "¡Hola! Soy Banu, el búho del CDE. Haz clic en mí cuando necesites una idea.",
  "Haz clic en una silla libre para sentarte a trabajar.",
  "Únete a la voz y acércate a alguien: entre más cerca, mejor se oye.",
  "¿Ya revisaste los compromisos de tu plan de acción? Cumplir uno te da +30 puntos.",
  "Completa los datos de tu empresa en «Mi empresa»: cada dato real suma +10 puntos.",
  "Una idea sin plan es solo un deseo. ¡Anótala en tu plan de acción!",
  "Asistir a un evento del CDE y escanear el QR también suma puntos.",
  "Valida tu idea con clientes reales antes de invertir de más.",
  "Escribe en el chat de la sala: aquí todos están construyendo algo.",
  "El chat de la sala se reinicia todos los días a las 4:00 a. m.",
  "Toma agua y estira las alas: trabajar descansado rinde más. ☕",
  "Un buen pitch cabe en un minuto: problema, solución y por qué tú.",
  "Conoce a tus clientes: pregúntales qué les duele antes de venderles.",
  "Las finanzas también son estrategia: separa las cuentas de tu empresa de las personales.",
  "¿Tienes dudas? Agenda una asesoría con el equipo del CDE.",
  "Mira la Formación: hay insignias secretas esperando a que las descubras. 🤫",
  "El trabajo en equipo multiplica: invita a tu equipo a una sala propia.",
  "Celebra los avances pequeños: cada compromiso cumplido cuenta.",
  "Si te trabas, explica tu problema en voz alta. ¡A veces la solución aparece sola!",
  "Revisa tu diagnóstico: tus brechas te dicen por dónde empezar.",
];

const aPresencia = (m: Movil): Presencia => ({
  id: m.id,
  nombre: m.nombre,
  rol: m.rol,
  avatar: m.avatar,
  x: m.x,
  y: m.y,
  silla: m.silla,
  enVoz: m.enVoz,
  silenciado: m.silenciado,
});

/** Avanza por la ruta lo que corresponde a `segundos`; al llegar a una silla elegida, se sienta. Devuelve si se movió. */
function avanzar(u: Movil, segundos: number): boolean {
  const { movio, direccion, termino } = recorrer(u, VELOCIDAD_PERSONA * segundos);
  if (direccion) u.pose = poseDesde(direccion.x, direccion.y);
  if (termino && u.silla) u.sentado = sillaPorClave(u.silla);
  return movio;
}

type Props = {
  yo: { id: string; nombre: string; rol: string };
  /** "principal" o el id de una sala creada: cada sala es un canal de Realtime distinto */
  sala: string;
  avatarInicial: Avatar;
  /** Mensajes desde el último reinicio del chat (4:00 a. m.) */
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
  const yo = useRef<Movil>({
    ...identidad,
    avatar: avatarInicial,
    x: inicio.x,
    y: inicio.y,
    silla: null,
    enVoz: false,
    silenciado: false,
    px: inicio.x,
    py: inicio.y,
    ruta: [],
    pose: "fr_izq",
    sentado: null,
  });
  const buho = useRef({ px: 6.5, py: 1.5, ruta: [] as Punto[], pose: "sentado" as PoseBuho, mensaje: null as string | null, quieto: Date.now(), consejo: 0, ocultar: 0 });
  const [cargada, setCargada] = useState(false);
  const [personas, setPersonas] = useState<Presencia[]>([]);
  const [estado, setEstado] = useState<"conectando" | "conectado" | "error">("conectando");
  const [mensajes, setMensajes] = useState<MensajeChat[]>(historial);
  const [reiniciado, setReiniciado] = useState(false);
  const [texto, setTexto] = useState("");
  const [enVoz, setEnVoz] = useState(false);
  const [silenciado, setSilenciado] = useState(false);
  const [estadosVoz, setEstadosVoz] = useState<Record<string, EstadoPar>>({});
  const enVozRef = useRef<string[]>([]);
  const [errorVoz, setErrorVoz] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();
  const [avisoAvatar, setAvisoAvatar] = useState<string | null>(null);
  const finChat = useRef<HTMLDivElement>(null);

  const publicar = useCallback(() => transporte.current?.actualizar(aPresencia(yo.current)), []);
  const enviarDestino = useCallback(() => {
    const { x, y, silla } = yo.current;
    transporte.current?.enviarMovimiento({ id: identidad.id, x, y, silla });
  }, [identidad.id]);

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
    const v = new Voz(identidad.id, t, () => setEstadosVoz(v.estados()));
    voz.current = v;

    // Otro jugador cambió de destino: se calcula su recorrido aquí (los demás solo mandan a dónde van)
    const irA = (o: Movil, m: Pick<Movimiento, "x" | "y" | "silla">) => {
      const mismo = o.x === m.x && o.y === m.y && o.silla === m.silla;
      o.x = m.x;
      o.y = m.y;
      o.silla = m.silla;
      if (mismo && (o.ruta.length || Math.hypot(o.px - m.x, o.py - m.y) < 0.05)) return; // repetición cada 2 s
      o.sentado = null;
      const ruta = buscarRuta({ x: o.px, y: o.py }, Math.floor(m.x), Math.floor(m.y), [], Boolean(m.silla));
      if (ruta.length) o.ruta = ruta;
      else if (Math.hypot(o.px - m.x, o.py - m.y) > 0.05) o.ruta = [{ x: m.x, y: m.y }];
      else o.sentado = sillaPorClave(m.silla);
    };

    t.alCambiarEstado(setEstado);
    t.alCambiarPresencia((lista) => {
      const vistos = new Set<string>();
      for (const p of lista) {
        if (p.id === identidad.id) continue;
        vistos.add(p.id);
        const previo = otros.current.get(p.id);
        if (!previo) {
          otros.current.set(p.id, { ...p, silla: p.silla ?? null, px: p.x, py: p.y, ruta: [], pose: "fr_izq", sentado: sillaPorClave(p.silla ?? null) });
          continue;
        }
        // La posición la manda el broadcast de movimiento (repetido cada 2 s); la de la presencia solo
        // sirve mientras no haya llegado ninguno.
        const { x, y, silla } = previo;
        Object.assign(previo, p, { x, y, silla }); // nombre, avatar y voz; el destino lo decide irA
        if (!previo.ultimoMovimiento) irA(previo, { x: p.x, y: p.y, silla: p.silla ?? null });
      }
      for (const id of [...otros.current.keys()]) if (!vistos.has(id)) otros.current.delete(id);
      setPersonas(lista.filter((p) => p.id !== identidad.id));
      enVozRef.current = lista.filter((p) => p.enVoz && p.id !== identidad.id).map((p) => p.id);
      v.sincronizar(enVozRef.current);
    });
    t.alRecibirMovimiento((m) => {
      const o = otros.current.get(m.id);
      if (!o || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
      o.ultimoMovimiento = Date.now();
      irA(o, { x: m.x, y: m.y, silla: typeof m.silla === "string" ? m.silla : null });
    });
    t.alRecibirMensaje((m) => setMensajes((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms.slice(-99), m])));
    void t.conectar(aPresencia(yo.current)).catch(() => setEstado("error"));

    return () => {
      v.desactivar();
      t.desconectar();
    };
  }, [identidad.id, sala, idCanal]);

  useEffect(() => {
    // Con llaves: en Chrome reciente scrollIntoView devuelve una promesa y un efecto solo puede devolver su limpieza
    finChat.current?.scrollIntoView({ block: "nearest" });
  }, [mensajes]);

  // El chat se reinicia todos los días a las 4:00 a. m.: quien tenga la sala abierta lo ve vaciarse a esa hora
  useEffect(() => {
    let reloj: ReturnType<typeof setTimeout>;
    const programar = () => {
      reloj = setTimeout(() => {
        setMensajes([]);
        setReiniciado(true);
        programar();
      }, proximoReinicioChat().getTime() - Date.now() + 1000);
    };
    programar();
    return () => clearTimeout(reloj);
  }, []);

  // El destino se repite cada 2 s: quien entra o se reconecta ve a cada uno donde está de verdad
  useEffect(() => {
    const intervalo = setInterval(enviarDestino, 2000);
    return () => clearInterval(intervalo);
  }, [enviarDestino]);

  // La voz se revisa cada 4 s: abre conexiones que falten y reintenta las que fallaron
  useEffect(() => {
    const intervalo = setInterval(() => voz.current?.sincronizar(enVozRef.current), 4000);
    return () => clearInterval(intervalo);
  }, []);

  // Volumen por cercanía: cada medio segundo según la distancia en la sala
  useEffect(() => {
    const intervalo = setInterval(() => {
      for (const o of otros.current.values()) {
        voz.current?.ajustarVolumen(o.id, volumenPorDistancia({ x: yo.current.px, y: yo.current.py }, { x: o.px, y: o.py }));
      }
    }, 500);
    return () => clearInterval(intervalo);
  }, []);

  // Escena: se cargan los sprites y empieza el bucle de animación
  const escena = useRef<Escena | null>(null);
  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    let cuadro = 0;
    let vivo = true;

    const personajeDe = (m: Movil, esYo: boolean, moviendose: boolean): Personaje => ({
      nombre: m.nombre,
      rol: m.rol,
      avatar: m.avatar,
      px: m.px,
      py: m.py,
      pose: m.pose,
      sentado: m.sentado,
      moviendose,
      esYo,
      enVoz: m.enVoz,
      silenciado: m.silenciado,
    });

    const moverBuho = (segundos: number) => {
      const b = buho.current;
      if (b.mensaje && Date.now() > b.ocultar) b.mensaje = null;
      if (b.ruta.length) {
        const { direccion, termino } = recorrer(b, VELOCIDAD_BUHO * segundos);
        if (direccion) {
          const { x: dx, y: dy } = direccion;
          b.pose = `${dx + dy >= 0 ? "frente" : "espalda"}${dx - dy < 0 ? "_izq" : "_der"}` as PoseBuho;
        }
        if (termino) b.quieto = Date.now();
        return !termino;
      }
      b.pose = "sentado";
      // Cada 7 s, si nadie le habla, camina a otro punto libre de la sala
      if (!b.mensaje && Date.now() - b.quieto > 7000) {
        const gente = [yo.current, ...otros.current.values()].map((m) => ({ x: m.x, y: m.y }));
        const destinos = [{ x: 2, y: 6 }, { x: 6, y: 2 }, { x: 4, y: 4 }, { x: 6, y: 6 }, { x: 4, y: 0 }].filter((d) => baldosaLibre(d.x, d.y, gente));
        const elegido = destinos[Math.floor(Math.random() * destinos.length)];
        if (elegido) b.ruta = buscarRuta({ x: b.px, y: b.py }, elegido.x, elegido.y, gente);
        b.quieto = Date.now();
      }
      return false;
    };

    // Tiempo real entre cuadros: la velocidad no depende de los hercios del monitor
    let anterior: number | null = null;
    const bucle = (ahora: number = performance.now()) => {
      const segundos = anterior === null ? 0 : segundosEntre(anterior, ahora);
      anterior = ahora;
      const e = escena.current;
      if (e) {
        const lista: Personaje[] = [];
        for (const o of otros.current.values()) lista.push(personajeDe(o, false, avanzar(o, segundos)));
        lista.push(personajeDe(yo.current, true, avanzar(yo.current, segundos)));
        const moviendose = moverBuho(segundos);
        const b = buho.current;
        const mascota: Mascota = { px: b.px, py: b.py, pose: b.pose, moviendose, mensaje: b.mensaje };
        e.dibujar(lista, mascota);
      }
      cuadro = requestAnimationFrame(bucle);
    };

    void cargarSprites().then((sprites) => {
      if (!vivo) return;
      escena.current = new Escena(ctx, sprites);
      setCargada(true);
    });
    bucle();
    return () => {
      vivo = false;
      cancelAnimationFrame(cuadro);
    };
  }, []);

  /** Camina a una baldosa libre o, si es una silla libre, se sienta en ella. */
  const moverA = (gx: number, gy: number) => {
    const y = yo.current;
    const gente = [...otros.current.values()].flatMap((o) => [{ x: o.x, y: o.y }, { x: o.px, y: o.py }]);
    const obj = objetoEn(gx, gy);
    let silla: string | null = null;
    if (obj?.tipo === "silla") {
      silla = claveSilla(obj);
      const ocupada = [...otros.current.values()].some((o) => o.silla === silla);
      if (ocupada || y.silla === silla) return;
    } else if (!baldosaLibre(gx, gy, gente)) return;
    const ruta = buscarRuta({ x: y.px, y: y.py }, gx, gy, gente, Boolean(silla));
    if (!ruta.length) return;
    y.ruta = ruta;
    y.sentado = null;
    y.silla = silla;
    y.x = gx + 0.5;
    y.y = gy + 0.5;
    // Sin tocar la presencia: moverse seguido con ella hacía que Supabase sacara al jugador del canal
    enviarDestino();
  };

  const clicEnSala = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    // El canvas se escala para caber en pantalla: se traduce el clic a su resolución interna
    const px = ((ev.clientX - r.left) * ANCHO) / r.width;
    const py = ((ev.clientY - r.top) * ALTO) / r.height;
    const b = buho.current;
    if (escena.current?.tocaMascota({ ...b, moviendose: false }, px, py)) {
      b.mensaje = b.mensaje ? null : CONSEJOS[b.consejo++ % CONSEJOS.length];
      b.ocultar = Date.now() + 9000;
      b.ruta = []; // se queda quieto mientras habla
      return;
    }
    const c = aCuadricula(px, py);
    moverA(c.gx, c.gy);
  };

  const teclado = (ev: React.KeyboardEvent<HTMLCanvasElement>) => {
    const pasos: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const paso = pasos[ev.key];
    if (!paso) return;
    ev.preventDefault();
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
      voz.current?.sincronizar(enVozRef.current);
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
  const selector = "h-9 rounded-md border bg-card px-2 text-sm";

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
      {enVoz && Object.values(estadosVoz).includes("fallo") && (
        <p className="text-sm text-amber-700">
          Con alguien no se pudo conectar la voz: la red (por ejemplo, el Wi-Fi de la universidad) bloquea la conexión directa
          entre equipos.{" "}
          {hayTurn() ? "Prueben salir y volver a entrar a la voz." : "Prueben con datos móviles o pidan configurar un servidor TURN (NEXT_PUBLIC_TURN_URL)."}
        </p>
      )}
      {enVoz && (
        <p className="text-muted-foreground text-xs">
          En la voz:{" "}
          {enVozOtros.length
            ? enVozOtros
                .map((p) => {
                  const e = estadosVoz[p.id];
                  return `${p.nombre}${e === "conectado" ? " ✓" : e === "fallo" ? " (no se pudo conectar)" : " (conectando…)"}`;
                })
                .join(", ")
            : "solo tú por ahora"}
          . Entre más cerca, mejor se oye.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-3">
          <div className="relative">
            <canvas
              ref={canvas}
              width={ANCHO}
              height={ALTO}
              tabIndex={0}
              aria-label={`Sala de coworking. Haz clic en el piso o usa las flechas para moverte, en una silla libre para sentarte y en ${NOMBRE_MASCOTA} para un consejo.`}
              onClick={clicEnSala}
              onKeyDown={teclado}
              className="w-full cursor-pointer rounded-lg border bg-[#f0f2f6] focus-visible:ring-2 focus-visible:ring-[var(--primario)] focus-visible:outline-none dark:bg-[#1a2420]"
              style={{ aspectRatio: `${ANCHO} / ${ALTO}` }}
            />
            {!cargada && (
              <p className="text-muted-foreground absolute inset-0 flex items-center justify-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando la sala…
              </p>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Clic en el piso para caminar, en una silla libre para sentarte y en {NOMBRE_MASCOTA} para un consejo. También puedes usar las flechas.
          </p>
          {/* Editor de avatar */}
          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Personalizar mi avatar</summary>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              {(
                [
                  ["camisa", "Camisa"],
                  ["pantalon", "Pantalón"],
                  ["pelo", "Cabello"],
                  ["accesorio", "Accesorio"],
                ] as const
              ).map(([campo, etiqueta]) => (
                <label key={campo} className="flex flex-col gap-1 text-xs">
                  {etiqueta}
                  <select value={avatar[campo]} onChange={(e) => cambiarAvatar({ [campo]: e.target.value })} className={selector}>
                    {OPCIONES_AVATAR[campo].map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
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
        <div className="flex h-[28rem] flex-col overflow-hidden rounded-lg border lg:h-auto lg:max-h-[42rem]">
          <div className="bg-[var(--primario)] px-3 py-2 text-white">
            <p className="text-sm font-semibold">Chat del coworking</p>
            <p className="text-[11px] text-white/85">Se reinicia todos los días a las 4:00 a. m.</p>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto bg-muted p-3 text-sm" aria-live="polite">
            {reiniciado && <p className="text-muted-foreground text-center text-xs italic">El chat se reinició (4:00 a. m.).</p>}
            {mensajes.length === 0 && !reiniciado && <p className="text-muted-foreground text-xs">Nadie ha escrito hoy todavía. ¡Saluda!</p>}
            {mensajes.map((m) => (
              <p key={m.id} className="break-words">
                <b className={m.idAutor === identidad.id ? "text-[var(--primario-texto)]" : ""}>{m.idAutor === identidad.id ? "Tú" : m.autor}:</b> {m.texto}
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
