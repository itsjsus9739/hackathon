// Medición de cambio: diagnóstico antes/después y brechas cerradas (lógica pura, probada en __tests__).
import { AREAS_DIAGNOSTICO } from "./constantes";

type Campo = (typeof AREAS_DIAGNOSTICO)[number]["campo"];
type ConEjes = Record<Campo, number | string | null> & { fecha: string; promedio: number | string | null };

export type CambioEje = { campo: Campo; nombre: string; antes: number; ahora: number; cambio: number };
export type Comparacion = {
  fechaInicial: string;
  fechaFinal: string;
  promedioInicial: number;
  promedioFinal: number;
  cambioPromedio: number;
  ejes: CambioEje[];
  /** El eje que más mejoró (null si ninguno subió) */
  mayorAvance: CambioEje | null;
};

const num = (v: number | string | null) => Number(v ?? 0);
const redondear = (v: number) => Math.round(v * 100) / 100;

/** Primer contra último diagnóstico (de cualquier orden de entrada). null si hay menos de dos. */
export function compararDiagnosticos<T extends ConEjes>(historial: T[]): Comparacion | null {
  if (historial.length < 2) return null;
  const orden = [...historial].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const inicial = orden[0];
  const final = orden.at(-1)!;
  const ejes = AREAS_DIAGNOSTICO.map(({ campo, nombre }) => {
    const antes = num(inicial[campo]);
    const ahora = num(final[campo]);
    return { campo, nombre, antes, ahora, cambio: redondear(ahora - antes) };
  });
  const mejor = ejes.reduce<CambioEje | null>((m, e) => (e.cambio > 0 && (!m || e.cambio > m.cambio) ? e : m), null);
  return {
    fechaInicial: inicial.fecha,
    fechaFinal: final.fecha,
    promedioInicial: num(inicial.promedio),
    promedioFinal: num(final.promedio),
    cambioPromedio: redondear(num(final.promedio) - num(inicial.promedio)),
    ejes,
    mayorAvance: mejor,
  };
}

/** "+0,8", "−0,3" o "0,0" con coma decimal. */
export const textoCambio = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1).replace(".", ",")}`;

export type BrechaFila = { area: string; descripcion: string; cerrada_en: string | null };

/** Brechas por área: cuántas se detectaron y cuántas se cerraron, de la de más brechas a la de menos. */
export function resumenBrechas(brechas: BrechaFila[]) {
  const porArea = new Map<string, { area: string; detectadas: number; cerradas: number }>();
  for (const b of brechas) {
    const a = porArea.get(b.area) ?? { area: b.area, detectadas: 0, cerradas: 0 };
    a.detectadas += 1;
    if (b.cerrada_en) a.cerradas += 1;
    porArea.set(b.area, a);
  }
  const areas = [...porArea.values()]
    .map((a) => ({ ...a, porcentaje: Math.round((100 * a.cerradas) / a.detectadas) }))
    .sort((x, y) => y.detectadas - x.detectadas || x.area.localeCompare(y.area));
  const detectadas = brechas.length;
  const cerradas = brechas.filter((b) => b.cerrada_en).length;
  return { areas, detectadas, cerradas, porcentaje: detectadas ? Math.round((100 * cerradas) / detectadas) : 0 };
}

type FilaEvolucion = { cambio_promedio: number | null } & Partial<Record<`cambio_${Campo}`, number | null>>;

/** Cambio promedio por eje entre las empresas con dos o más diagnósticos. */
export function avancePorEje(filas: FilaEvolucion[]) {
  const n = filas.length;
  const promedio = (f: (x: FilaEvolucion) => number | null | undefined) =>
    n ? redondear(filas.reduce((s, x) => s + Number(f(x) ?? 0), 0) / n) : 0;
  return {
    empresas: n,
    cambioPromedio: promedio((x) => x.cambio_promedio),
    ejes: AREAS_DIAGNOSTICO.map(({ campo, nombre }) => ({ etiqueta: nombre.replace(/^Gestión (de |)/, ""), valor: promedio((x) => x[`cambio_${campo}`]) })),
  };
}
