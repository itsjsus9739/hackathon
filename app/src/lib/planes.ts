// Planes de acción: estados, vencimientos y textos (lógica pura, probada en __tests__).
import { AREAS_DIAGNOSTICO, ZONA_HORARIA } from "./constantes";

export const ESTADOS_PLAN = ["Pendiente", "En curso", "Completado", "Cancelado"] as const;
export const ESTADOS_COMPROMISO = ["Pendiente", "En curso", "Cumplido", "Cancelado"] as const;
export type EstadoPlan = (typeof ESTADOS_PLAN)[number];
export type EstadoCompromiso = (typeof ESTADOS_COMPROMISO)[number];

export const AREAS_PLAN = [...AREAS_DIAGNOSTICO.map((a) => ({ campo: a.campo as string, nombre: a.nombre })), { campo: "otra", nombre: "Otra" }];

export const nombreArea = (campo: string | null) => AREAS_PLAN.find((a) => a.campo === campo)?.nombre ?? null;

const TITULOS: Record<string, string> = {
  estrategia: "Plan de estrategia empresarial",
  mercadeo_ventas: "Plan de mercadeo y ventas",
  financiera: "Plan de gestión financiera",
  normativa_legal: "Plan de formalización",
  productividad: "Plan de productividad",
  transformacion_digital: "Plan de transformación digital",
};

/** Título sugerido a partir del área de la brecha: "Plan de transformación digital". */
export const tituloSugerido = (campo: string | null) => (campo ? (TITULOS[campo] ?? "") : "");

/** Fecha de hoy en Bogotá como "AAAA-MM-DD" (los compromisos vencen por día, no por hora UTC). */
export function hoyBogota(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

/** Vencido: tenía fecha, ya pasó y sigue abierto (pendiente o en curso). */
export function estaVencido(c: { fecha_limite: string | null; estado: string }, hoy = hoyBogota()): boolean {
  return Boolean(c.fecha_limite) && c.fecha_limite! < hoy && (c.estado === "Pendiente" || c.estado === "En curso");
}

/** Días entre hoy y la fecha límite (negativo = días de retraso). */
export function diasHasta(fecha: string, hoy = hoyBogota()): number {
  return Math.round((Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000);
}

export function textoPlazo(fecha: string | null, estado: string, hoy = hoyBogota()): string {
  if (!fecha) return "Sin fecha";
  const dias = diasHasta(fecha, hoy);
  const legible = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${fecha}T00:00:00Z`));
  if (estado === "Cumplido" || estado === "Cancelado") return legible;
  if (dias < 0) return `${legible} · ${-dias} ${dias === -1 ? "día" : "días"} de retraso`;
  if (dias === 0) return `${legible} · vence hoy`;
  return `${legible} · faltan ${dias} ${dias === 1 ? "día" : "días"}`;
}

/** Compromisos típicos para cerrar cada brecha (punto de partida editable al crear un plan). */
export const COMPROMISOS_SUGERIDOS: Record<string, string[]> = {
  transformacion_digital: [
    "Crear perfil de Google Business y redes sociales",
    "Montar catálogo o tienda en línea",
    "Llevar ventas e inventario en una herramienta digital",
  ],
  financiera: [
    "Separar las finanzas personales de las del negocio",
    "Construir el flujo de caja mensual",
    "Calcular costos y punto de equilibrio",
  ],
  mercadeo_ventas: [
    "Definir cliente ideal y propuesta de valor",
    "Plan de contenidos para redes (4 semanas)",
    "Medir ventas por canal",
  ],
  normativa_legal: [
    "Registro mercantil en la Cámara de Comercio",
    "RUT y facturación electrónica",
    "Revisar permisos sanitarios y de funcionamiento",
  ],
  estrategia: ["Definir misión, visión y metas a un año", "Análisis DOFA con el mentor", "Tablero de 3 indicadores clave"],
  productividad: ["Documentar el proceso principal", "Reducir los tiempos de entrega", "Plan de compras e inventario"],
};

/** Suma días a una fecha "AAAA-MM-DD". */
export const sumarDias = (fecha: string, dias: number) =>
  new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
