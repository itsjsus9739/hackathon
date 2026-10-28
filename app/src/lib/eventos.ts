// Calendario de eventos: tipos, colores y permisos por rol (lógica pura, probada en __tests__).
// Las mismas reglas viven en la base (0019_calendario_eventos.sql); aquí solo guían la interfaz.
import type { Enums } from "@/lib/supabase/database.types";

type Rol = Enums<"rol_usuario">;

export type TipoEvento = {
  tipo: string;
  color: string;
  /** Público: todos lo ven y cualquiera se inscribe. Privado: solo organizador, invitados y CDE */
  publico: boolean;
  /** Roles que lo crean además del CDE (que crea todos) */
  creadores: readonly Rol[];
};

const TODOS: readonly Rol[] = ["admin_cde", "cde", "docente", "estudiante", "emprendedor"];

export const TIPOS_EVENTO: readonly TipoEvento[] = [
  { tipo: "Evento", color: "#2563eb", publico: true, creadores: ["emprendedor"] },
  { tipo: "Networking", color: "#9333ea", publico: true, creadores: ["emprendedor"] },
  { tipo: "Conversatorio", color: "#ea580c", publico: false, creadores: ["docente"] },
  { tipo: "Cita", color: "#16a34a", publico: false, creadores: TODOS },
  { tipo: "Coworking", color: "#0d9488", publico: false, creadores: TODOS },
  { tipo: "Capacitación", color: "#0284c7", publico: true, creadores: [] },
  { tipo: "Feria", color: "#c8102e", publico: true, creadores: [] },
  { tipo: "Sesión empresarial", color: "#64748b", publico: true, creadores: [] },
  { tipo: "Ruta de acompañamiento", color: "#a16207", publico: true, creadores: [] },
];

export const ESTADOS_RESPUESTA = ["pendiente", "confirmado", "rechazado"] as const;
export type EstadoRespuesta = (typeof ESTADOS_RESPUESTA)[number];

export const ETIQUETA_RESPUESTA: Record<EstadoRespuesta, string> = {
  pendiente: "Pendiente",
  confirmado: "Asistirá",
  rechazado: "No asistirá",
};

export const esRolCde = (rol: Rol) => rol === "cde" || rol === "admin_cde";

export const tipoEvento = (tipo: string): TipoEvento =>
  TIPOS_EVENTO.find((t) => t.tipo === tipo) ?? { tipo, color: "#64748b", publico: true, creadores: [] };

export const puedeCrearTipo = (rol: Rol, tipo: string) => esRolCde(rol) || tipoEvento(tipo).creadores.includes(rol);

/** Tipos que el rol puede crear, en el orden del calendario. */
export const tiposCreables = (rol: Rol) => TIPOS_EVENTO.filter((t) => puedeCrearTipo(rol, t.tipo));

/** Tipo propuesto al crear: Cita si se puede (es lo más común), si no el primero permitido. */
export const tipoInicial = (rol: Rol) => {
  const creables = tiposCreables(rol);
  return (creables.find((t) => t.tipo === "Cita") ?? creables[0])?.tipo ?? "Cita";
};

/** Editar, mover y borrar: el organizador o el CDE. */
export const puedeGestionar = (yo: { id: string; rol: Rol }, ev: { creado_por: string | null }) =>
  esRolCde(yo.rol) || ev.creado_por === yo.id;

export type Asistente = { id_usuario: string; estado: EstadoRespuesta };

export function contarRespuestas(asistentes: Asistente[]) {
  const conteo: Record<EstadoRespuesta, number> = { pendiente: 0, confirmado: 0, rechazado: 0 };
  for (const a of asistentes) conteo[a.estado] += 1;
  return conteo;
}

/** Fin por defecto: una hora después del inicio. */
export const finPorDefecto = (inicio: string | null, fin: string | null) =>
  fin ?? (inicio ? new Date(Date.parse(inicio) + 3_600_000).toISOString() : null);

/**
 * Cambios de invitados al guardar: a quién invitar y a quién quitar. Solo se quitan los que el
 * organizador había invitado; quien se inscribió por su cuenta a un evento público se queda.
 */
export function cambiosInvitados(
  actuales: { id_usuario: string; invitado_por: string | null }[],
  pedidos: string[],
  organizador: string,
) {
  const pedidosSet = new Set(pedidos.filter((id) => id !== organizador));
  const yaEstan = new Set(actuales.map((a) => a.id_usuario));
  return {
    invitar: [...pedidosSet].filter((id) => !yaEstan.has(id)),
    quitar: actuales.filter((a) => a.invitado_por && !pedidosSet.has(a.id_usuario)).map((a) => a.id_usuario),
  };
}
