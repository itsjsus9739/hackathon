import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarPlus,
  CircleCheck,
  Flag,
  GraduationCap,
  PlayCircle,
  Sparkles,
  Ticket,
  Upload,
  Contact,
  PenLine,
} from "lucide-react";

import { tipoEvento } from "@/lib/eventos";
import { modulosPara } from "@/lib/navegacion";
import { NOMBRE_MASCOTA, enlaceTutorial, tutorialesPara } from "@/lib/recorrido";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";

const ACCESOS = [
  { href: "/empresas", icono: Building2, titulo: "Empresas", texto: "Ficha única e historial de cada empresa" },
  { href: "/importar", icono: Upload, titulo: "Importar Excel", texto: "Valida NIT con DV y fusiona duplicados" },
  { href: "/mi-empresa", icono: PenLine, titulo: "Mis datos empresariales", texto: "Actualiza sector, tamaño y lo que vendes" },
  { href: "/planes", icono: Flag, titulo: "Planes de acción", texto: "Compromisos, responsables y avance" },
  { href: "/eventos", icono: CalendarPlus, titulo: "Agendar una cita", texto: "Elige fecha e invita a quien necesites" },
  { href: "/eventos", icono: Ticket, titulo: "Eventos", texto: "Inscríbete y confirma tu asistencia" },
  { href: "/contactos", icono: Contact, titulo: "Mis contactos", texto: "Docentes, estudiantes y empresas" },
  { href: "/asistente", icono: Sparkles, titulo: "Preguntar a la IA", texto: "Consulta tus datos en lenguaje natural" },
] as const;

const ZONA = "America/Bogota";
const FECHA = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA });
const DIA = new Intl.DateTimeFormat("es-CO", { day: "2-digit", timeZone: ZONA });
const DIA_SEMANA = new Intl.DateTimeFormat("es-CO", { weekday: "short", timeZone: ZONA });
const HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: ZONA });
const DIA_MES = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: ZONA });

type Pendiente = { id: string; href: string; titulo: string; detalle: string; color: string };

export default async function Inicio() {
  const sesion = await obtenerSesion();
  if (!sesion) return null; // el layout ya redirige a /login
  const supabase = await crearClienteServidor();

  // Límites del día y de la semana en hora de Colombia (UTC-5, sin horario de verano)
  const ahora = new Date();
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(ahora); // AAAA-MM-DD
  const inicioHoy = new Date(`${hoy}T00:00:00-05:00`);
  const finHoy = new Date(inicioHoy.getTime() + 86_400_000);
  const finSemana = new Date(inicioHoy.getTime() + 7 * 86_400_000);

  // RLS: cada quien recibe solo los eventos que puede ver y los compromisos de sus planes
  const [semana, compromisos, capacitaciones] = await Promise.all([
    supabase
      .from("eventos")
      .select("id, nombre, tipo, fecha, lugar, creado_por, inscripciones_eventos(id_usuario, estado)")
      .gte("fecha", inicioHoy.toISOString())
      .lt("fecha", finSemana.toISOString())
      .order("fecha")
      .limit(50),
    supabase
      .from("compromisos")
      .select("id, descripcion, fecha_limite, id_plan")
      .eq("id_responsable", sesion.id)
      .in("estado", ["Pendiente", "En curso"])
      .lte("fecha_limite", hoy)
      .order("fecha_limite"),
    supabase
      .from("eventos")
      .select("id, nombre, fecha, lugar")
      .eq("tipo", "Capacitación")
      .gte("fecha", ahora.toISOString())
      .order("fecha")
      .limit(2),
  ]);
  for (const r of [semana, compromisos, capacitaciones]) {
    if (r.error) throw new Error(`No se pudo cargar el inicio: ${r.error.message}`);
  }

  const eventos = semana.data ?? [];
  // Pendiente de hoy: lo que organizo o a lo que no he rechazado ir, más los compromisos que vencen hoy o ya vencieron
  const pendientes: Pendiente[] = [
    ...eventos
      .filter((e) => new Date(e.fecha) < finHoy)
      .filter(
        (e) =>
          e.creado_por === sesion.id ||
          e.inscripciones_eventos.some((i) => i.id_usuario === sesion.id && i.estado !== "rechazado"),
      )
      .map((e) => ({
        id: e.id,
        href: `/eventos?e=${e.id}`,
        titulo: e.nombre,
        detalle: `${e.tipo} · ${HORA.format(new Date(e.fecha))}`,
        color: tipoEvento(e.tipo).color,
      })),
    ...(compromisos.data ?? []).map((c) => ({
      id: c.id,
      href: `/planes/${c.id_plan}/editar`,
      titulo: c.descripcion,
      detalle: c.fecha_limite === hoy ? "Compromiso · vence hoy" : "Compromiso · vencido",
      color: "#f5b700",
    })),
  ];

  const primerNombre = sesion.nombre.includes("@") ? "" : sesion.nombre.split(" ")[0];
  // Cada rol ve sus accesos (Importar es del CDE; el emprendedor actualiza su empresa) y sus tutoriales
  const permitidas = new Set<string>(modulosPara(sesion.rol).map((m) => m.href));
  const accesos = ACCESOS.filter((a) => permitidas.has(a.href)).slice(0, 6);
  const tutoriales = tutorialesPara(sesion.rol);
  const n = pendientes.length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-muted-foreground text-sm first-letter:uppercase">{FECHA.format(ahora)}</p>
        <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-[var(--tinta)]">
          {primerNombre ? `Hola, ${primerNombre}` : "Hola"}
        </h1>
      </header>

      {/* Pendientes de hoy */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#00a862] via-[#12b873] to-[#5fd39b] p-6 text-white md:p-7">
        <span className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/10" aria-hidden />
        <div className="relative grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <div>
            <p className="text-xs font-semibold tracking-wider text-white/80 uppercase">Tu día</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {n === 0
                ? "No tienes pendientes para el día de hoy"
                : `Tienes ${n} ${n === 1 ? "pendiente" : "pendientes"} para el día de hoy`}
            </h2>
            <Link
              href="/eventos"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-semibold text-[var(--primario-texto)] transition hover:bg-card/90"
            >
              Ver calendario <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          {n > 0 ? (
            <ul className="space-y-2">
              {pendientes.slice(0, 3).map((p) => (
                <li key={p.id}>
                  <Link href={p.href} className="flex items-center gap-3 rounded-2xl bg-card/95 px-4 py-3 text-[var(--tinta)] transition hover:bg-card">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.titulo}</span>
                      <span className="text-muted-foreground block text-xs">{p.detalle}</span>
                    </span>
                    <ArrowRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  </Link>
                </li>
              ))}
              {n > 3 && <li className="pl-1 text-sm text-white/90">y {n - 3} más</li>}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-white/90">
              <CircleCheck className="size-5" aria-hidden /> Todo al día. Revisa lo que viene esta semana.
            </p>
          )}
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        {/* Esta semana */}
        <section className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[var(--tinta)]">Esta semana</h2>
            <Link href="/eventos" className="text-sm font-semibold text-[var(--primario-texto)] hover:underline">
              Ver calendario
            </Link>
          </div>
          {eventos.length === 0 ? (
            <p className="text-muted-foreground mt-6 text-sm">No hay actividades en los próximos 7 días.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {eventos.slice(0, 5).map((e) => {
                const fecha = new Date(e.fecha);
                const color = tipoEvento(e.tipo).color;
                return (
                  <li key={e.id}>
                    <Link href={`/eventos?e=${e.id}`} className="flex items-center gap-3 py-3">
                      <span className="flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--verde-suave)] text-[var(--primario-texto)]">
                        <span className="text-base leading-none font-bold">{DIA.format(fecha)}</span>
                        <span className="text-[10px] font-semibold uppercase">{DIA_SEMANA.format(fecha).replace(".", "")}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--tinta)]">{e.nombre}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {HORA.format(fecha)}
                          {e.lugar ? ` · ${e.lugar}` : ""}
                        </span>
                      </span>
                      <span
                        className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={{ color, background: `${color}1a` }}
                      >
                        {e.tipo}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Accesos rápidos */}
        <section>
          <h2 className="font-semibold text-[var(--tinta)]">Accesos rápidos</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-3">
            {accesos.map(({ href, icono: Icono, titulo, texto }) => (
              <Link
                key={titulo}
                href={href}
                className="flex flex-col gap-3 rounded-2xl border bg-card p-4 transition sm:p-5 hover:border-[var(--primario)] hover:shadow-sm"
              >
                <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--verde-suave)] text-[var(--primario-texto)]">
                  <Icono className="size-6" strokeWidth={1.8} aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold text-[var(--tinta)]">{titulo}</span>
                  <span className="text-muted-foreground mt-0.5 block text-sm">{texto}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Tutoriales y capacitaciones */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--tinta)]">Tutoriales y capacitaciones</h2>
          <Link href="/formacion" className="text-sm font-semibold text-[var(--primario-texto)] hover:underline">
            Ver formación
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(capacitaciones.data ?? []).map((c) => (
            <Link
              key={c.id}
              // Abre el evento y el búho explica cómo inscribirse
              href={`/eventos?e=${c.id}&tutorial=inscribirse-evento`}
              className="flex flex-col rounded-2xl border bg-card p-5 transition hover:border-[var(--primario)]"
            >
              <span className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--acento-calido)] text-[var(--acento-calido-texto)]">
                  <GraduationCap className="size-5" strokeWidth={1.8} aria-hidden />
                </span>
                <span className="rounded-full bg-[var(--acento-calido)] px-2.5 py-1 text-[11px] font-semibold text-[var(--acento-calido-texto)]">
                  Capacitación
                </span>
              </span>
              <span className="mt-4 font-semibold text-[var(--tinta)]">{c.nombre}</span>
              <span className="text-muted-foreground mt-1 text-sm">
                {DIA_MES.format(new Date(c.fecha))} · {HORA.format(new Date(c.fecha))}
                {c.lugar ? ` · ${c.lugar}` : ""}
              </span>
              <span className="mt-auto pt-4 text-sm font-semibold text-[var(--primario-texto)]">Inscribirme</span>
            </Link>
          ))}
          {tutoriales.slice(0, 4 - (capacitaciones.data?.length ?? 0)).map((t) => (
            <Link
              key={t.id}
              // El búho guía el tutorial paso a paso en la página
              href={enlaceTutorial(t.id)}
              className="flex flex-col rounded-2xl border bg-card p-5 transition hover:border-[var(--primario)]"
            >
              <span className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--verde-suave)] text-[var(--primario-texto)]">
                  <PlayCircle className="size-5" strokeWidth={1.8} aria-hidden />
                </span>
                <span className="rounded-full bg-[var(--verde-suave)] px-2.5 py-1 text-[11px] font-semibold text-[var(--primario-texto)]">
                  Tutorial
                </span>
              </span>
              <span className="mt-4 font-semibold text-[var(--tinta)]">{t.titulo}</span>
              <span className="text-muted-foreground mt-1 text-sm">{t.resumen}</span>
              <span className="mt-auto pt-4 text-sm font-semibold text-[var(--primario-texto)]">Empezar con {NOMBRE_MASCOTA}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
