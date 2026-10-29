import {
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  FileUp,
  GraduationCap,
  Home,
  Sparkles,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { RutaModulo } from "@/lib/navegacion";

export const ICONO_MODULO: Record<RutaModulo, LucideIcon> = {
  "/": Home,
  "/empresas": Building2,
  "/importar": FileUp,
  "/planes": ClipboardList,
  "/citas": CalendarClock,
  "/eventos": CalendarDays,
  "/formacion": GraduationCap,
  "/conocimiento": BarChart3,
  "/asistente": Sparkles,
  "/coworking": Users,
  "/portal": Store,
};

/** Módulo activo: la ruta exacta o una subruta (/empresas/123 activa Empresas). */
export const estaActivo = (ruta: string, href: string) => (href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`));
