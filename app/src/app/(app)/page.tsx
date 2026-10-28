import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CalendarDays,
  FileUp,
  GraduationCap,
  Lightbulb,
  ListChecks,
  Rocket,
} from "lucide-react";

import { obtenerSesion } from "@/lib/sesion";

const PILARES = [
  { href: "/empresas", icono: Building2, titulo: "Empresas", texto: "Ficha única e historial" },
  { href: "/importar", icono: FileUp, titulo: "Depurar datos", texto: "Excel, NIT y duplicados" },
  { href: "/planes", icono: ListChecks, titulo: "Seguimiento", texto: "Planes y proyectos de aula" },
  { href: "/citas", icono: CalendarClock, titulo: "Citas", texto: "Agenda y recordatorios" },
  { href: "/eventos", icono: CalendarDays, titulo: "Eventos", texto: "Inscripción y asistencia QR" },
  { href: "/formacion", icono: GraduationCap, titulo: "Formación", texto: "Microcursos y recompensas" },
  { href: "/conocimiento", icono: Lightbulb, titulo: "Conocimiento", texto: "Brechas e impacto" },
  { href: "/portal", icono: Rocket, titulo: "Portal", texto: "Oferta para emprendedores" },
];

const FECHA = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Bogota",
});

export default async function Inicio() {
  const sesion = await obtenerSesion();
  // Si el perfil no tiene nombre, obtenerSesion devuelve el correo: no lo usamos como saludo
  const primerNombre = sesion?.nombre.includes("@") ? "" : sesion?.nombre.split(" ")[0];
  const hoy = FECHA.format(new Date());

  return (
    <div className="mx-auto max-w-5xl py-2">
      <p className="text-muted-foreground text-sm first-letter:uppercase">{hoy}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--tinta)]">
        {primerNombre ? `Hola, ${primerNombre}` : "Hola"}
      </h1>

      <section className="mt-8 flex flex-col gap-4 rounded-2xl bg-[var(--verde-suave)] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--tinta)]">De datos dispersos a conocimiento que innova</h2>
          <p className="text-muted-foreground mt-1 text-sm">Centro de Desarrollo Empresarial · UNAB</p>
        </div>
        <Link
          href="/empresas"
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-[var(--primario-texto)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--tinta)] sm:self-auto"
        >
          Ver empresas <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>

      <h2 className="mt-10 text-sm font-semibold text-[var(--tinta)]">Accesos rápidos</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PILARES.map(({ href, icono: Icono, titulo, texto }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-2xl border bg-white p-4 transition hover:border-[var(--primario)]"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--verde-suave)] text-[var(--primario-texto)]">
              <Icono className="size-5" strokeWidth={1.8} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--tinta)]">{titulo}</span>
              <span className="text-muted-foreground block truncate text-xs">{texto}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
