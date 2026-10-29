import type { Enums } from "@/lib/supabase/database.types";

// Reglas de la gamificación que viven en la interfaz. Los puntos, insignias y canjes
// los calcula y protege la base (triggers + RLS); aquí solo se presentan.

type Rol = Enums<"rol_usuario">;

// ---------------------------------------------------------------------
// Niveles: se calculan con los puntos GANADOS (canjear no baja de nivel)
// ---------------------------------------------------------------------
export const NIVELES = [
  { nivel: 1, nombre: "Explorador", desde: 0 },
  { nivel: 2, nombre: "Aprendiz", desde: 50 },
  { nivel: 3, nombre: "Constructor", desde: 150 },
  { nivel: 4, nombre: "Estratega", desde: 300 },
  { nivel: 5, nombre: "Leyenda CDE", desde: 500 },
] as const;

export type Nivel = (typeof NIVELES)[number];

export function calcularNivel(puntos: number) {
  const p = Math.max(0, puntos);
  const actual = [...NIVELES].reverse().find((n) => p >= n.desde) ?? NIVELES[0];
  const siguiente = NIVELES.find((n) => n.desde > p) ?? null;
  const progreso = siguiente ? Math.round(((p - actual.desde) / (siguiente.desde - actual.desde)) * 100) : 100;
  return { actual, siguiente, progreso, faltan: siguiente ? siguiente.desde - p : 0 };
}

// ---------------------------------------------------------------------
// Insignias: medalla por nivel (1 bronce, 2 plata, 3 oro) y progreso hacia la meta
// ---------------------------------------------------------------------
export const MEDALLA = {
  1: { nombre: "Bronce", aro: "from-[#e7b48a] to-[#a8693c]", texto: "text-[#7a4a24]" },
  2: { nombre: "Plata", aro: "from-[#e8edf0] to-[#9aa6ae]", texto: "text-[#4d5a62]" },
  3: { nombre: "Oro", aro: "from-[#ffe08a] to-[#d4a017]", texto: "text-[#7a5a00]" },
} as const;

export const medalla = (nivel: number) => MEDALLA[(Math.min(Math.max(nivel, 1), 3) as 1 | 2 | 3)];

export type Criterio =
  | "aportes_validados"
  | "puntos"
  | "eventos_asistidos"
  | "onboarding"
  | "manual"
  | "compromisos_cumplidos"
  | "perfil_completo"
  | "canjes"
  | "madrugador";

export type ContextoInsignias = {
  puntos: number;
  eventos: number;
  aportesPorArea: Map<string, number>;
  aportesTotal: number;
  onboarding: boolean;
  compromisos: number;
  canjes: number;
};

/** Progreso hacia la meta de una insignia automática; null en las manuales (las otorga el CDE). */
export function progresoInsignia(
  i: { criterio: string; meta: number; id_area: string | null },
  c: ContextoInsignias,
): { actual: number; meta: number } | null {
  switch (i.criterio) {
    case "puntos":
      return { actual: Math.min(c.puntos, i.meta), meta: i.meta };
    case "eventos_asistidos":
      return { actual: Math.min(c.eventos, i.meta), meta: i.meta };
    case "aportes_validados": {
      const n = i.id_area ? (c.aportesPorArea.get(i.id_area) ?? 0) : c.aportesTotal;
      return { actual: Math.min(n, i.meta), meta: i.meta };
    }
    case "onboarding":
      return { actual: c.onboarding ? 1 : 0, meta: 1 };
    case "compromisos_cumplidos":
      return { actual: Math.min(c.compromisos, i.meta), meta: i.meta };
    case "canjes":
      return { actual: Math.min(c.canjes, i.meta), meta: i.meta };
    case "perfil_completo":
    case "madrugador":
      return { actual: 0, meta: 1 }; // se cumplen de una vez: la base las otorga al instante
    default:
      return null;
  }
}

export type EstadoInsignia = "ganada" | "en_progreso" | "bloqueada" | "manual" | "secreta";

export function estadoInsignia(ganada: boolean, progreso: { actual: number } | null, secreta = false): EstadoInsignia {
  if (ganada) return "ganada";
  if (secreta) return "secreta";
  if (!progreso) return "manual";
  return progreso.actual > 0 ? "en_progreso" : "bloqueada";
}

// ---------------------------------------------------------------------
// Recompensas: el público va al inicio de la descripción («Para: emprendedores. …»)
// ---------------------------------------------------------------------
const PUBLICO: [RegExp, Rol[]][] = [
  [/todos/i, ["admin_cde", "cde", "docente", "estudiante", "emprendedor"]],
  [/emprendedor/i, ["emprendedor"]],
  [/estudiante/i, ["estudiante"]],
  [/docente/i, ["docente"]],
  [/cde/i, ["cde", "admin_cde"]],
];

/** Separa «Para: …» del resto de la descripción y dice a qué roles aplica (sin «Para:» = todos). */
export function leerRecompensa(descripcion: string | null) {
  const texto = (descripcion ?? "").trim();
  const m = texto.match(/^para:\s*([^.]+)\.\s*([\s\S]*)$/i);
  if (!m) return { publico: null, roles: null as Rol[] | null, detalle: texto };
  const publico = m[1].trim();
  const roles = [...new Set(PUBLICO.filter(([re]) => re.test(publico)).flatMap(([, r]) => r))];
  return { publico, roles: roles.length ? roles : null, detalle: m[2].trim() };
}

export const recompensaParaRol = (descripcion: string | null, rol: Rol) => {
  const { roles } = leerRecompensa(descripcion);
  return !roles || roles.includes(rol);
};

/** Insignia secreta sin ganar: no se revela qué pide (la base la otorga sola). */
export const INSIGNIA_SECRETA = { nombre: "Insignia secreta", descripcion: "Sigue usando la plataforma para descubrirla." };

// ---------------------------------------------------------------------
// Perfil de la empresa: datos que dan puntos al completarlos (la base los premia, 0030)
// ---------------------------------------------------------------------
export const CAMPOS_PERFIL = [
  { campo: "sector", etiqueta: "Sector" },
  { campo: "tamano", etiqueta: "Tamaño" },
  { campo: "municipio", etiqueta: "Municipio" },
  { campo: "formalizacion", etiqueta: "Formalización" },
  { campo: "descripcion", etiqueta: "Qué ofrece" },
  { campo: "nit", etiqueta: "NIT" },
] as const;
export const PUNTOS_POR_DATO = 10;
export const BONO_PERFIL_COMPLETO = 50;

type EmpresaPerfil = Record<(typeof CAMPOS_PERFIL)[number]["campo"], string | null> & { datos_estimados: string[] };

/** Qué datos del perfil están completos y son reales (un sector o tamaño estimado no cuenta hasta confirmarlo). */
export function perfilEmpresa(e: EmpresaPerfil) {
  const campos = CAMPOS_PERFIL.map((c) => ({ ...c, completo: Boolean(e[c.campo]) && !e.datos_estimados.includes(c.campo) }));
  const completos = campos.filter((c) => c.completo).length;
  return { campos, completos, porcentaje: Math.round((100 * completos) / campos.length) };
}

// ---------------------------------------------------------------------
// Cómo se ganan puntos (texto para la pantalla y para el búho)
// ---------------------------------------------------------------------
export function reglasPuntos(rol: Rol) {
  const reglas = [
    { accion: "Completar el recorrido de bienvenida con el búho", puntos: "+20, una vez" },
    { accion: "Asistir a un evento o capacitación (escaneando el QR)", puntos: "Lo que valga el evento" },
  ];
  if (rol === "estudiante") reglas.splice(1, 0, { accion: "Aporte validado por tu docente", puntos: "+10 por aporte" });
  if (rol === "emprendedor")
    reglas.push({ accion: "Completar o confirmar un dato de tu empresa (en Mi empresa)", puntos: "+10 por dato, +50 al completarla" });
  reglas.push({ accion: "Cumplir un compromiso de un plan de acción", puntos: "+30" });
  reglas.push({ accion: "Canjear una recompensa", puntos: "Resta su costo (no baja tu nivel)" });
  return reglas;
}

export const esCde = (rol: Rol) => rol === "cde" || rol === "admin_cde";
