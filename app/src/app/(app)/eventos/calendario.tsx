"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type { DateSelectArg, EventDropArg, EventInput, EventSourceFuncArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import Link from "next/link";
import { CalendarPlus, CheckCircle2, Clock, Coins, Loader2, MapPin, QrCode, Tag, Trash2, User, X } from "lucide-react";

import { AvatarRol, EtiquetaRol } from "@/components/personas/rol";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  contarRespuestas,
  esRolCde,
  ETIQUETA_RESPUESTA,
  puedeCrearTipo,
  puedeGestionar,
  TIPOS_EVENTO,
  tipoEvento,
  tipoInicial,
  tiposCreables,
  type EstadoRespuesta,
} from "@/lib/eventos";
import { COLOR_ROL, ORDEN_ROL } from "@/lib/roles";
import type { Enums } from "@/lib/supabase/database.types";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { borrarEvento, guardarEvento, moverEvento, responderEvento } from "./actions";
import { CasillaAsistencia, QrAsistencia } from "./asistencia-controles";
import "./calendario.css";

type Rol = Enums<"rol_usuario">;
type Persona = { id: string; nombre: string; rol: Rol };

type Actividad = {
  id: string;
  nombre: string;
  tipo: string;
  fecha: string;
  fin: string | null;
  lugar: string | null;
  descripcion: string | null;
  cupo: number | null;
  creado_por: string | null;
  es_ejemplo: boolean;
  puntos_gamificacion: number;
  asistentes: { id: string; id_usuario: string; estado: EstadoRespuesta; invitado_por: string | null; asistio: boolean }[];
};

type Props = {
  yo: { id: string; rol: Rol };
  personas: Persona[];
  etiquetasRol: Record<Rol, string>;
  /** ?e=<id> desde una notificación: se abre su detalle */
  eventoInicial: string | null;
};

const formatoFecha = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const formatoHora = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" });
/** Fecha → valor de <input type="datetime-local"> en la hora del navegador */
const aEntradaLocal = (d: Date) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return x.toISOString().slice(0, 16);
};
const finDe = (a: Actividad) => a.fin ?? new Date(Date.parse(a.fecha) + 3_600_000).toISOString();

export default function Calendario({ yo, personas, etiquetasRol, eventoInicial }: Props) {
  const calendario = useRef<FullCalendar>(null);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());
  const [soloMias, setSoloMias] = useState(false);
  const [detalle, setDetalle] = useState<Actividad | null>(null);
  const [formulario, setFormulario] = useState<{ actividad: Actividad | null; inicio?: Date; fin?: Date } | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null);
  const [movil, setMovil] = useState(false);
  const pendienteAbrir = useRef(eventoInicial);
  const nombres = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas]);
  const creables = tiposCreables(yo.rol);

  useEffect(() => setMovil(window.innerWidth < 700), []);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const miEstado = useCallback((a: Actividad) => a.asistentes.find((x) => x.id_usuario === yo.id)?.estado ?? null, [yo.id]);
  const participo = useCallback((a: Actividad) => a.creado_por === yo.id || miEstado(a) !== null, [yo.id, miEstado]);

  const refrescar = () => calendario.current?.getApi().refetchEvents();

  // RLS: cada quien recibe solo lo que puede ver (públicos, lo suyo y donde está invitado)
  const cargar = useCallback(
    async (info: EventSourceFuncArg) => {
      const supabase = crearClienteNavegador();
      const desde = new Date(info.start.getTime() - 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("eventos")
        .select(
          "id, nombre, tipo, fecha, fin, lugar, descripcion, cupo, creado_por, es_ejemplo, puntos_gamificacion, inscripciones_eventos(id, id_usuario, estado, invitado_por, asistio)",
        )
        .gte("fecha", desde)
        .lte("fecha", info.end.toISOString())
        .order("fecha");
      if (error) throw new Error(error.message);
      const lista: Actividad[] = (data ?? []).map(({ inscripciones_eventos, ...a }) => ({
        ...a,
        asistentes: (inscripciones_eventos ?? []) as Actividad["asistentes"],
      }));
      setActividades(lista);
      if (pendienteAbrir.current) {
        const buscada = lista.find((a) => a.id === pendienteAbrir.current);
        if (buscada) {
          setDetalle(buscada);
          pendienteAbrir.current = null;
        }
      }
      return lista;
    },
    [],
  );

  // Si el detalle abierto cambió (respuesta, edición), se muestra la versión nueva
  useEffect(() => {
    setDetalle((d) => (d ? (actividades.find((a) => a.id === d.id) ?? null) : d));
  }, [actividades]);

  const fuente = useCallback(
    async (info: EventSourceFuncArg): Promise<EventInput[]> => {
      const lista = await cargar(info);
      return lista
        .filter((a) => !ocultos.has(a.tipo))
        .filter((a) => !soloMias || participo(a))
        .map((a) => {
          const estado = miEstado(a);
          return {
            id: a.id,
            title: a.nombre,
            start: a.fecha,
            end: finDe(a),
            color: tipoEvento(a.tipo).color,
            editable: puedeGestionar(yo, a),
            classNames: estado === "pendiente" ? ["cal-pendiente"] : estado === "rechazado" ? ["cal-rechazado"] : [],
          };
        });
    },
    [cargar, ocultos, soloMias, participo, miEstado, yo],
  );

  const cambiarHorario = async (info: EventDropArg | EventResizeDoneArg) => {
    const inicio = info.event.start;
    const fin = info.event.end ?? (inicio ? new Date(inicio.getTime() + 3_600_000) : null);
    if (!inicio || !fin) return info.revert();
    const r = await moverEvento({ id: info.event.id, inicio: inicio.toISOString(), fin: fin.toISOString() });
    if (r.error) {
      info.revert();
      setAviso({ texto: r.error, error: true });
    } else {
      setAviso({ texto: "Horario actualizado" });
      refrescar();
    }
  };

  const seleccionar = (info: DateSelectArg) => {
    calendario.current?.getApi().unselect();
    if (!creables.length) return;
    let inicio = info.start;
    let fin = info.end;
    if (info.allDay) {
      inicio = new Date(info.start);
      inicio.setHours(9, 0, 0, 0);
      fin = new Date(inicio.getTime() + 3_600_000);
    }
    setFormulario({ actividad: null, inicio, fin });
  };

  const responder = async (id: string, estado: "confirmado" | "rechazado") => {
    const r = await responderEvento({ id, estado });
    if (r.error) setAviso({ texto: r.error, error: true });
    else {
      setAviso({ texto: estado === "confirmado" ? "¡Asistencia confirmada!" : "Respuesta registrada" });
      refrescar();
    }
  };

  const ahora = Date.now();
  const invitaciones = actividades.filter((a) => miEstado(a) === "pendiente" && Date.parse(finDe(a)) > ahora);

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="order-2 flex flex-col gap-4 lg:order-1">
        {creables.length > 0 && (
          <Button size="lg" className="w-full" data-recorrido="eventos-crear" onClick={() => setFormulario({ actividad: null })}>
            <CalendarPlus /> Crear actividad
          </Button>
        )}

        <section data-recorrido="eventos-invitaciones" className="rounded-lg border p-4">
          <h3 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
            Invitaciones pendientes
            {invitaciones.length > 0 && <Badge>{invitaciones.length}</Badge>}
          </h3>
          {invitaciones.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tienes invitaciones pendientes en este periodo.</p>
          ) : (
            <ul className="space-y-3">
              {invitaciones.map((a) => (
                <li key={a.id} className="text-sm">
                  <button className="flex items-center gap-2 text-left font-medium hover:underline" onClick={() => setDetalle(a)}>
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ background: tipoEvento(a.tipo).color }} />
                    {a.nombre}
                  </button>
                  <p className="text-muted-foreground mt-0.5 mb-2 text-xs">
                    {a.tipo} · {formatoFecha.format(new Date(a.fecha))}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => responder(a.id, "confirmado")}>
                      Asistiré
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => responder(a.id, "rechazado")}>
                      No asistiré
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section data-recorrido="eventos-filtros" className="rounded-lg border p-4">
          <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">Mostrar</h3>
          <div className="space-y-1.5">
            {TIPOS_EVENTO.map((t) => (
              <label key={t.tipo} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={!ocultos.has(t.tipo)}
                  onChange={(e) =>
                    setOcultos((o) => {
                      const n = new Set(o);
                      if (e.target.checked) n.delete(t.tipo);
                      else n.add(t.tipo);
                      return n;
                    })
                  }
                />
                <span className="size-3 shrink-0 rounded-sm" style={{ background: t.color }} />
                {t.tipo}
                <span className="text-muted-foreground ml-auto text-xs">{t.publico ? "Público" : "Privado"}</span>
              </label>
            ))}
            <label className="mt-2 flex cursor-pointer items-center gap-2 border-t pt-2 text-sm">
              <input type="checkbox" className="size-4" checked={soloMias} onChange={(e) => setSoloMias(e.target.checked)} />
              Solo donde participo
            </label>
          </div>
        </section>

        <section className="hidden rounded-lg border p-4 lg:block">
          <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">Lo que puedes hacer</h3>
          <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-xs">
            <li>
              Crear: <b className="text-foreground">{creables.map((t) => t.tipo).join(", ") || "nada"}</b>
            </li>
            <li>Ver todos los eventos, ferias, capacitaciones y networking (son públicos)</li>
            {esRolCde(yo.rol) ? (
              <li>
                Ver, editar y eliminar <b className="text-foreground">todas</b> las actividades
              </li>
            ) : (
              <>
                <li>Ver citas, coworking y conversatorios donde participas</li>
                <li>Editar, mover o eliminar lo que tú organizas</li>
              </>
            )}
            <li>Confirmar o rechazar tu asistencia</li>
          </ul>
        </section>
      </aside>

      <div data-recorrido="eventos-calendario" className="calendario-cde bg-background order-1 min-w-0 rounded-lg border p-2 sm:p-4 lg:order-2">
        <FullCalendar
          ref={calendario}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          locale={esLocale}
          firstDay={1}
          height="auto"
          nowIndicator
          selectable={creables.length > 0}
          editable
          initialView={movil ? "listWeek" : "dayGridMonth"}
          key={movil ? "movil" : "escritorio"}
          headerToolbar={
            movil
              ? { left: "prev,next", center: "title", right: "today" }
              : { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" }
          }
          footerToolbar={movil ? { center: "dayGridMonth,timeGridWeek,listWeek" } : undefined}
          buttonText={{ today: "Hoy", month: "Mes", week: "Semana", day: "Día", list: "Agenda" }}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          dayMaxEvents={3}
          events={fuente}
          eventClick={(info) => {
            const a = actividades.find((x) => x.id === info.event.id);
            if (a) setDetalle(a);
          }}
          select={seleccionar}
          eventDrop={cambiarHorario}
          eventResize={cambiarHorario}
        />
      </div>

      {detalle && (
        <Detalle
          actividad={detalle}
          yo={yo}
          nombres={nombres}
          etiquetasRol={etiquetasRol}
          miEstado={miEstado(detalle)}
          cerrar={() => setDetalle(null)}
          responder={responder}
          alCambiarAsistencia={refrescar}
          editar={() => {
            setFormulario({ actividad: detalle });
            setDetalle(null);
          }}
          borrar={async () => {
            if (!confirm(`¿Eliminar "${detalle.nombre}"? Esta acción no se puede deshacer.`)) return;
            const r = await borrarEvento(detalle.id);
            if (r.error) setAviso({ texto: r.error, error: true });
            else {
              setDetalle(null);
              setAviso({ texto: "Actividad eliminada" });
              refrescar();
            }
          }}
        />
      )}

      {formulario && (
        <Formulario
          yo={yo}
          personas={personas}
          etiquetasRol={etiquetasRol}
          actividad={formulario.actividad}
          inicio={formulario.inicio}
          fin={formulario.fin}
          cerrar={() => setFormulario(null)}
          listo={(texto) => {
            setFormulario(null);
            setAviso({ texto });
            refrescar();
          }}
        />
      )}

      {aviso && (
        <div
          role="status"
          className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md px-4 py-2 text-sm text-white shadow-lg ${aviso.error ? "bg-destructive" : "bg-foreground"}`}
        >
          {aviso.texto}
        </div>
      )}
    </div>
  );
}

function Modal({ titulo, color, cerrar, children }: { titulo: string; color?: string; cerrar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [cerrar]);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className="bg-background max-h-[92vh] w-full max-w-xl overflow-auto rounded-xl shadow-2xl">
        <header className="flex items-center gap-3 px-5 pt-5">
          {color && <span className="size-4 shrink-0 rounded" style={{ background: color }} />}
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button className="text-muted-foreground ml-auto" onClick={cerrar} aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </header>
        <div className="px-5 pt-3 pb-5">{children}</div>
      </div>
    </div>
  );
}

function Detalle(p: {
  actividad: Actividad;
  yo: { id: string; rol: Rol };
  nombres: Map<string, Persona>;
  etiquetasRol: Record<Rol, string>;
  miEstado: EstadoRespuesta | null;
  cerrar: () => void;
  responder: (id: string, estado: "confirmado" | "rechazado") => Promise<void>;
  alCambiarAsistencia: () => void;
  editar: () => void;
  borrar: () => Promise<void>;
}) {
  const { actividad: a, yo, nombres, etiquetasRol, miEstado } = p;
  const t = tipoEvento(a.tipo);
  const [ocupado, iniciar] = useTransition();
  const inicio = new Date(a.fecha);
  const fin = new Date(finDe(a));
  const mismoDia = inicio.toDateString() === fin.toDateString();
  const organizador = a.creado_por ? nombres.get(a.creado_por) : undefined;
  const conteo = contarRespuestas(a.asistentes);
  const soyOrganizador = a.creado_por === yo.id;
  const gestiono = puedeGestionar(yo, a);
  const lleno = a.cupo !== null && conteo.confirmado + conteo.pendiente >= a.cupo;
  const cde = esRolCde(yo.rol);
  const miInscripcion = a.asistentes.find((x) => x.id_usuario === yo.id);
  const asistieron = a.asistentes.filter((x) => x.asistio).length;
  const textoRespuesta =
    miEstado === "confirmado"
      ? "Confirmaste tu asistencia"
      : miEstado === "rechazado"
        ? "Indicaste que no asistirás"
        : miEstado === "pendiente"
          ? "¿Asistirás?"
          : "¿Te gustaría asistir?";

  return (
    <Modal titulo={a.nombre} color={t.color} cerrar={p.cerrar}>
      <dl className="grid grid-cols-[20px_1fr] items-start gap-x-3 gap-y-2 text-sm">
        <Tag className="text-muted-foreground mt-0.5 size-4" />
        <dd>
          {a.tipo} · <span className="text-muted-foreground">{t.publico ? "Abierto a todos" : "Solo invitados"}</span>
          {a.es_ejemplo && (
            <Badge variant="outline" className="ml-2">
              Ejemplo
            </Badge>
          )}
        </dd>
        <Clock className="text-muted-foreground mt-0.5 size-4" />
        <dd className="first-letter:uppercase">
          {formatoFecha.format(inicio)} – {mismoDia ? formatoHora.format(fin) : formatoFecha.format(fin)}
        </dd>
        <MapPin className="text-muted-foreground mt-0.5 size-4" />
        <dd>{a.lugar || "Sin lugar definido"}</dd>
        <User className="text-muted-foreground mt-0.5 size-4" />
        <dd>
          Organiza {organizador ? `${organizador.nombre} (${etiquetasRol[organizador.rol]})` : "el CDE"}
          {a.cupo !== null && <span className="text-muted-foreground"> · Cupo {a.cupo}</span>}
        </dd>
        {a.puntos_gamificacion > 0 && (
          <>
            <Coins className="mt-0.5 size-4 text-[var(--primario-texto)]" />
            <dd className="font-medium text-[var(--primario-texto)]">Asistir vale {a.puntos_gamificacion} puntos</dd>
          </>
        )}
      </dl>
      {a.descripcion && <p className="mt-3 text-sm whitespace-pre-wrap">{a.descripcion}</p>}

      {!soyOrganizador && (miEstado !== null || t.publico) && (
        <div className="bg-muted mt-4 flex flex-wrap items-center gap-2 rounded-lg p-3">
          <strong className="flex-1 text-sm">{textoRespuesta}</strong>
          <Button
            size="sm"
            data-recorrido="evento-asistire"
            disabled={ocupado || miEstado === "confirmado" || (lleno && miEstado !== "pendiente")}
            onClick={() => iniciar(() => p.responder(a.id, "confirmado"))}
          >
            Asistiré
          </Button>
          <Button size="sm" variant="outline" disabled={ocupado || miEstado === "rechazado"} onClick={() => iniciar(() => p.responder(a.id, "rechazado"))}>
            No asistiré
          </Button>
          {lleno && miEstado !== "confirmado" && miEstado !== "pendiente" && (
            <span className="text-muted-foreground w-full text-xs">No quedan cupos.</span>
          )}
        </div>
      )}

      {/* Asistencia real: el participante muestra su QR; si ya la registraron, lo confirma */}
      {miInscripcion?.asistio ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="size-4" aria-hidden /> Asistencia registrada
          {a.puntos_gamificacion > 0 && ` · +${a.puntos_gamificacion} puntos`}
        </p>
      ) : (
        miInscripcion?.estado === "confirmado" && <QrAsistencia idInscripcion={miInscripcion.id} puntos={a.puntos_gamificacion} />
      )}

      <h3 className="mt-5 mb-1 text-sm font-semibold">
        Asistentes{" "}
        <span className="text-muted-foreground font-normal">
          · {conteo.confirmado} confirmados, {conteo.pendiente} pendientes, {conteo.rechazado} no asisten
          {asistieron > 0 && `, ${asistieron} asistieron`}
        </span>
      </h3>
      {cde && a.asistentes.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--verde-suave)] p-2 text-xs">
          <span>Marca «Asistió» o escanea el QR de cada persona: la base le suma los puntos del evento.</span>
          <Link href={`/eventos/asistencia?e=${a.id}`} className="inline-flex items-center gap-1 font-semibold text-[var(--primario-texto)] underline underline-offset-4">
            <QrCode className="size-3.5" aria-hidden /> Escanear QR
          </Link>
        </div>
      )}
      {a.asistentes.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aún no hay asistentes.</p>
      ) : (
        <ul className="divide-y">
          {a.asistentes.map((x) => {
            const persona = nombres.get(x.id_usuario);
            return (
              <li key={x.id_usuario} className="flex items-center gap-3 py-2 text-sm">
                {persona ? (
                  <AvatarRol nombre={persona.nombre} rol={persona.rol} className="size-7 text-[10px]" />
                ) : (
                  <span className="bg-muted grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold">?</span>
                )}
                <span className="space-y-0.5">
                  <span className="block">{persona?.nombre ?? "Miembro"}</span>
                  {persona && <EtiquetaRol rol={persona.rol} />}
                </span>
                {cde ? (
                  <span className="ml-auto">
                    <CasillaAsistencia idInscripcion={x.id} asistio={x.asistio} alCambiar={p.alCambiarAsistencia} />
                  </span>
                ) : (
                  x.asistio && (
                    <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Asistió</span>
                  )
                )}
                <span
                  className={`${cde || x.asistio ? "" : "ml-auto "}rounded-full px-2 py-0.5 text-xs ${
                    x.estado === "confirmado"
                      ? "bg-green-100 text-green-800"
                      : x.estado === "rechazado"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {ETIQUETA_RESPUESTA[x.estado]}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {gestiono && (
        <div className="mt-5 flex justify-between gap-2">
          <Button variant="outline" className="text-destructive" disabled={ocupado} onClick={() => iniciar(p.borrar)}>
            <Trash2 /> Eliminar
          </Button>
          <Button onClick={p.editar}>Editar</Button>
        </div>
      )}
    </Modal>
  );
}

function Formulario(p: {
  yo: { id: string; rol: Rol };
  personas: Persona[];
  etiquetasRol: Record<Rol, string>;
  actividad: Actividad | null;
  inicio?: Date;
  fin?: Date;
  cerrar: () => void;
  listo: (texto: string) => void;
}) {
  const { yo, personas, etiquetasRol, actividad: a } = p;
  const [tipo, setTipo] = useState(a?.tipo ?? tipoInicial(yo.rol));
  const [elegidos, setElegidos] = useState<Set<string>>(
    new Set(a ? a.asistentes.filter((x) => x.invitado_por).map((x) => x.id_usuario) : []),
  );
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  const valoresIniciales = useMemo(() => {
    if (a) return { inicio: aEntradaLocal(new Date(a.fecha)), fin: aEntradaLocal(new Date(finDe(a))) };
    const inicio = p.inicio ?? (() => {
      const d = new Date();
      d.setHours(d.getHours() + 1, 0, 0, 0);
      return d;
    })();
    const fin = p.fin ?? new Date(inicio.getTime() + 3_600_000);
    return { inicio: aEntradaLocal(inicio), fin: aEntradaLocal(fin) };
  }, [a, p.inicio, p.fin]);

  const organizador = a?.creado_por ?? yo.id;
  const q = busqueda.trim().toLowerCase();
  const grupos = ORDEN_ROL.map((rol) => ({
    rol,
    gente: personas.filter(
      (x) => x.rol === rol && x.id !== organizador && (!q || x.nombre.toLowerCase().includes(q) || etiquetasRol[rol].toLowerCase().includes(q)),
    ),
  })).filter((g) => g.gente.length);
  const t = tipoEvento(tipo);

  const enviar = (form: FormData) => {
    setError(null);
    const inicio = new Date(String(form.get("inicio")));
    const fin = new Date(String(form.get("fin")));
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return setError("Revisa las fechas.");
    const cupoTexto = String(form.get("cupo") ?? "").trim();
    const puntosTexto = String(form.get("puntos") ?? "").trim();
    iniciar(async () => {
      const r = await guardarEvento({
        id: a?.id,
        nombre: String(form.get("nombre") ?? ""),
        tipo,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        lugar: String(form.get("lugar") ?? ""),
        descripcion: String(form.get("descripcion") ?? ""),
        cupo: cupoTexto ? Number(cupoTexto) : null,
        puntos: esRolCde(yo.rol) && puntosTexto ? Number(puntosTexto) : undefined,
        invitados: [...elegidos],
      });
      if (r.error) setError(r.error);
      else p.listo(a ? "Cambios guardados" : elegidos.size ? "Actividad creada e invitaciones enviadas" : "Actividad creada");
    });
  };

  return (
    <Modal titulo={a ? "Editar actividad" : "Nueva actividad"} cerrar={p.cerrar}>
      <form action={enviar} className="space-y-4 text-sm">
        <label className="block space-y-1.5">
          <span className="font-medium">Título</span>
          <Input name="nombre" required minLength={3} maxLength={200} defaultValue={a?.nombre} placeholder="Ej. Asesoría plan de negocio" autoFocus />
        </label>

        <div className="space-y-1.5">
          <span className="font-medium">Tipo de actividad</span>
          <div className="flex flex-wrap gap-2">
            {TIPOS_EVENTO.filter((x) => puedeCrearTipo(yo.rol, x.tipo) || x.tipo === a?.tipo || x.creadores.length > 0).map((x) => {
              const permitido = puedeCrearTipo(yo.rol, x.tipo) || x.tipo === a?.tipo;
              return (
                <button
                  key={x.tipo}
                  type="button"
                  disabled={!permitido}
                  title={permitido ? undefined : "Tu rol no puede crear este tipo"}
                  onClick={() => setTipo(x.tipo)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-35 ${
                    tipo === x.tipo ? "bg-foreground text-background border-foreground" : ""
                  }`}
                >
                  <span className="size-2.5 rounded-sm" style={{ background: x.color }} />
                  {x.tipo}
                </button>
              );
            })}
          </div>
          <p className="text-muted-foreground text-xs">
            {t.publico ? "Visible para todos; cualquiera puede inscribirse." : "Solo lo verán tú, los invitados y el CDE."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="font-medium">Inicio</span>
            <Input type="datetime-local" name="inicio" required defaultValue={valoresIniciales.inicio} />
          </label>
          <label className="block space-y-1.5">
            <span className="font-medium">Fin</span>
            <Input type="datetime-local" name="fin" required defaultValue={valoresIniciales.fin} />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <label className="block space-y-1.5">
            <span className="font-medium">Lugar o enlace</span>
            <Input name="lugar" maxLength={200} defaultValue={a?.lugar ?? ""} placeholder="CDE · Sala 2 o enlace de Meet/Teams" />
          </label>
          <label className="block space-y-1.5">
            <span className="font-medium">Cupo</span>
            <Input name="cupo" type="number" min={1} max={10000} defaultValue={a?.cupo ?? ""} placeholder="Sin límite" />
          </label>
        </div>

        {esRolCde(yo.rol) && (
          <label className="block space-y-1.5">
            <span className="font-medium">Puntos por asistir</span>
            <Input name="puntos" type="number" min={0} max={500} defaultValue={a?.puntos_gamificacion ?? 20} className="w-32" />
            <span className="text-muted-foreground block text-xs">
              Se suman al marcar la asistencia (recomendado 10 a 30; con 0 no da puntos).
            </span>
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="font-medium">Descripción</span>
          <Textarea name="descripcion" rows={3} maxLength={4000} defaultValue={a?.descripcion ?? ""} />
        </label>

        <div className="space-y-1.5">
          <span className="font-medium">
            Invitar asistentes {elegidos.size > 0 && <span className="text-muted-foreground font-normal">({elegidos.size} seleccionados)</span>}
          </span>
          <Input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o rol…" />
          <div className="max-h-52 overflow-auto rounded-md border">
            {grupos.length === 0 ? (
              <p className="text-muted-foreground p-3">Sin resultados</p>
            ) : (
              grupos.map((g) => (
                <div key={g.rol}>
                  <div className={`px-3 pt-2 pb-1 text-[11px] font-semibold uppercase ${COLOR_ROL[g.rol].fondo} ${COLOR_ROL[g.rol].texto}`}>
                    {etiquetasRol[g.rol]}
                  </div>
                  {g.gente.map((x) => (
                    <label key={x.id} className="hover:bg-muted flex cursor-pointer items-center gap-3 px-3 py-1.5">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={elegidos.has(x.id)}
                        onChange={(e) =>
                          setElegidos((s) => {
                            const n = new Set(s);
                            if (e.target.checked) n.add(x.id);
                            else n.delete(x.id);
                            return n;
                          })
                        }
                      />
                      {x.nombre}
                    </label>
                  ))}
                </div>
              ))
            )}
          </div>
          <p className="text-muted-foreground text-xs">Cada invitado recibe un aviso en la campana y responde Asistiré o No asistiré.</p>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex justify-between gap-2">
          <Button type="button" variant="outline" onClick={p.cerrar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando && <Loader2 className="animate-spin" />} Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
