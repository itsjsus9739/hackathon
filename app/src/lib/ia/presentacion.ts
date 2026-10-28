// Cómo mostrar el resultado de una consulta del asistente (lógica pura, sin servidor).
import type { Barra } from "@/lib/conocimiento";

type Tabla = { columnas: string[]; filas: Record<string, unknown>[] };

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Barras si la tabla es "etiqueta + valor": entre 2 y 15 filas, la primera columna es texto
 * y hay una columna numérica. Si no encaja, null y se muestra solo la tabla.
 */
export function elegirGrafica(t: Tabla): { barras: Barra[]; medida: string } | null {
  if (t.columnas.length < 2 || t.filas.length < 2 || t.filas.length > 15) return null;
  const [etiqueta, ...resto] = t.columnas;
  if (t.filas.some((f) => f[etiqueta] === null || esNumero(f[etiqueta]))) return null;
  const valor = resto.find((c) => t.filas.every((f) => esNumero(f[c])));
  if (!valor) return null;
  return {
    barras: t.filas.map((f) => ({ etiqueta: String(f[etiqueta]), valor: f[valor] as number })),
    medida: valor.replace(/_/g, " "),
  };
}

const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/;

export function formatearCelda(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (esNumero(v)) return v.toLocaleString("es-CO", { maximumFractionDigits: 2 });
  if (typeof v === "string" && ISO.test(v)) {
    const fecha = new Date(v.length === 10 ? `${v}T00:00:00Z` : v);
    return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: v.length === 10 ? "UTC" : "America/Bogota" }).format(fecha);
  }
  if (Array.isArray(v)) return v.join(", ");
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}
