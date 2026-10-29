// Color de cada rol: el mismo en Mis contactos, el calendario y cualquier lista de personas.
import type { Enums } from "@/lib/supabase/database.types";

type Rol = Enums<"rol_usuario">;

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin_cde: "Admin CDE",
  cde: "Miembro CDE",
  docente: "Docente",
  estudiante: "Estudiante",
  emprendedor: "Emprendedor",
};

/** Clases de Tailwind por rol: fondo suave, texto con contraste AA y punto de color sólido. */
export const COLOR_ROL: Record<Rol, { fondo: string; texto: string; punto: string; borde: string }> = {
  admin_cde: { fondo: "bg-violet-100", texto: "text-violet-800", punto: "bg-violet-600", borde: "border-violet-200" },
  cde: { fondo: "bg-emerald-100", texto: "text-emerald-800", punto: "bg-emerald-600", borde: "border-emerald-200" },
  docente: { fondo: "bg-sky-100", texto: "text-sky-800", punto: "bg-sky-600", borde: "border-sky-200" },
  emprendedor: { fondo: "bg-amber-100", texto: "text-amber-900", punto: "bg-amber-500", borde: "border-amber-200" },
  estudiante: { fondo: "bg-pink-100", texto: "text-pink-800", punto: "bg-pink-600", borde: "border-pink-200" },
};

/** Orden en que se agrupan las personas. */
export const ORDEN_ROL: Rol[] = ["admin_cde", "cde", "docente", "emprendedor", "estudiante"];

export const iniciales = (nombre: string) =>
  nombre
    .replace(/\(.*\)/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
