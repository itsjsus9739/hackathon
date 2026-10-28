// Módulos del menú lateral. El recorrido del búho apunta a estas mismas rutas.
export const MODULOS = [
  { href: "/", etiqueta: "Inicio" },
  { href: "/empresas", etiqueta: "Empresas" },
  { href: "/importar", etiqueta: "Importar y depurar" },
  { href: "/planes", etiqueta: "Planes de acción" },
  { href: "/citas", etiqueta: "Citas" },
  { href: "/eventos", etiqueta: "Eventos" },
  { href: "/formacion", etiqueta: "Formación y recompensas" },
  { href: "/conocimiento", etiqueta: "Conocimiento" },
  { href: "/asistente", etiqueta: "Asistente IA" },
  { href: "/coworking", etiqueta: "Coworking" },
  { href: "/portal", etiqueta: "Portal del emprendedor" },
] as const;

export type RutaModulo = (typeof MODULOS)[number]["href"];

/** Módulos que solo abre el equipo del CDE (la página muestra "Solo para el equipo del CDE" a los demás). */
export const SOLO_CDE: readonly RutaModulo[] = ["/importar", "/asistente"];
