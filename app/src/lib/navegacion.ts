// Módulos del menú lateral. El recorrido del búho apunta a estas mismas rutas.
import type { Enums } from "@/lib/supabase/database.types";

type Rol = Enums<"rol_usuario">;

export const MODULOS = [
  { href: "/", etiqueta: "Inicio" },
  { href: "/empresas", etiqueta: "Empresas" },
  { href: "/importar", etiqueta: "Importar y depurar" },
  { href: "/mi-empresa", etiqueta: "Actualizar datos empresariales" },
  { href: "/planes", etiqueta: "Planes de acción" },
  { href: "/contactos", etiqueta: "Mis contactos" },
  { href: "/eventos", etiqueta: "Eventos" },
  { href: "/formacion", etiqueta: "Formación y recompensas" },
  { href: "/conocimiento", etiqueta: "Conocimiento" },
  { href: "/asistente", etiqueta: "Asistente IA" },
  { href: "/coworking", etiqueta: "Coworking" },
  { href: "/portal", etiqueta: "Portal del emprendedor" },
] as const;

export type RutaModulo = (typeof MODULOS)[number]["href"];

/** Módulos que solo ve el equipo del CDE (a los demás roles no se les muestran). */
export const SOLO_CDE: readonly RutaModulo[] = ["/importar", "/asistente"];

/** Módulos exclusivos de otros roles: el emprendedor actualiza los datos de su empresa en vez de importar bases. */
export const SOLO_ROL: Partial<Record<RutaModulo, readonly Rol[]>> = { "/mi-empresa": ["emprendedor"] };

export const esRolCde = (rol: Rol) => rol === "cde" || rol === "admin_cde";

/** Módulos del menú para un rol. */
export function modulosPara(rol: Rol) {
  return MODULOS.filter((m) => {
    if (SOLO_CDE.includes(m.href)) return esRolCde(rol);
    const solo = SOLO_ROL[m.href];
    return !solo || solo.includes(rol);
  });
}
