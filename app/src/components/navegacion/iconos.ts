import {
  Armchair,
  BookOpen,
  Building2,
  CalendarDays,
  Flag,
  House,
  Rocket,
  Sparkles,
  Star,
  Ticket,
  Upload,
  type LucideIcon,
} from "lucide-react";

import type { RutaModulo } from "@/lib/navegacion";

/** Ícono de cada módulo (menú lateral, barra inferior y menú del celular). */
export const ICONO_MODULO: Record<RutaModulo, LucideIcon> = {
  "/": House,
  "/empresas": Building2,
  "/importar": Upload,
  "/planes": Flag,
  "/citas": CalendarDays,
  "/eventos": Ticket,
  "/formacion": Star,
  "/conocimiento": BookOpen,
  "/asistente": Sparkles,
  "/coworking": Armchair,
  "/portal": Rocket,
};

/** Módulo activo: la ruta exacta o una subruta (/empresas/123 activa Empresas). */
export const estaActivo = (ruta: string, href: string) => (href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`));
