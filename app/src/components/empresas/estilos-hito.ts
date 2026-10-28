import { CalendarClock, ClipboardCheck, GraduationCap, Handshake, ListChecks, Ticket, type LucideIcon } from "lucide-react";

import type { TipoHito } from "@/lib/empresas";

export const ESTILO_TIPO: Record<
  TipoHito,
  { etiqueta: string; etiquetaSingular: string; etiquetaPlural: string; icono: LucideIcon; punto: string; texto: string; anillo: string }
> = {
  proyecto_aula: {
    etiqueta: "Proyecto de aula",
    etiquetaSingular: "proyecto de aula",
    etiquetaPlural: "proyectos de aula",
    icono: GraduationCap,
    punto: "bg-violet-600",
    texto: "text-violet-700",
    anillo: "ring-violet-200",
  },
  plan_accion: {
    etiqueta: "Plan de acción",
    etiquetaSingular: "plan de acción",
    etiquetaPlural: "planes de acción",
    icono: ListChecks,
    punto: "bg-orange-600",
    texto: "text-orange-700",
    anillo: "ring-orange-200",
  },
  cita: {
    etiqueta: "Asesoría / cita",
    etiquetaSingular: "cita",
    etiquetaPlural: "citas",
    icono: CalendarClock,
    punto: "bg-sky-600",
    texto: "text-sky-700",
    anillo: "ring-sky-200",
  },
  diagnostico: {
    etiqueta: "Diagnóstico de madurez",
    etiquetaSingular: "diagnóstico",
    etiquetaPlural: "diagnósticos",
    icono: ClipboardCheck,
    punto: "bg-amber-500",
    texto: "text-amber-700",
    anillo: "ring-amber-200",
  },
  evento: {
    etiqueta: "Evento",
    etiquetaSingular: "evento asistido",
    etiquetaPlural: "eventos asistidos",
    icono: Ticket,
    punto: "bg-emerald-600",
    texto: "text-emerald-700",
    anillo: "ring-emerald-200",
  },
  atencion: {
    etiqueta: "Atención del CDE",
    etiquetaSingular: "atención",
    etiquetaPlural: "atenciones",
    icono: Handshake,
    punto: "bg-rose-600",
    texto: "text-rose-700",
    anillo: "ring-rose-200",
  },
};
