// Agregaciones del tablero de conocimiento (puras: se prueban sin base de datos).
import { AREAS_DIAGNOSTICO, type Diagnostico } from "./empresas";

export type Barra = { etiqueta: string; valor: number };

export type EmpresaResumen = {
  nit: string | null;
  sector: string | null;
  tamano: string | null;
  formalizacion: string | null;
  municipio: string | null;
  vinculo_unab: string | null;
  id_representante: string | null;
  contactos: number;
};

/**
 * Conteo por valor, de mayor a menor. Con `orden` se respeta un orden natural (p. ej. tamaños);
 * con `maximo` lo que sobra se agrupa en "Otros". Los vacíos se cuentan aparte.
 */
export function contarPor<T>(
  filas: T[],
  clave: (f: T) => string | null,
  { orden, maximo }: { orden?: readonly string[]; maximo?: number } = {},
): { barras: Barra[]; sinDato: number } {
  const conteo = new Map<string, number>();
  let sinDato = 0;
  for (const f of filas) {
    const v = clave(f);
    if (!v) sinDato++;
    else conteo.set(v, (conteo.get(v) ?? 0) + 1);
  }
  let barras = [...conteo].map(([etiqueta, valor]) => ({ etiqueta, valor }));
  if (orden) {
    barras.sort((a, b) => orden.indexOf(a.etiqueta) - orden.indexOf(b.etiqueta));
  } else {
    barras.sort((a, b) => b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta));
    if (maximo && barras.length > maximo) {
      const resto = barras.slice(maximo - 1).reduce((s, b) => s + b.valor, 0);
      barras = [...barras.slice(0, maximo - 1), { etiqueta: "Otros", valor: resto }];
    }
  }
  return { barras, sinDato };
}

/** Formalización registrada o, si falta, estimada por el NIT (con NIT = formal). */
export const formalizacionEstimada = (e: EmpresaResumen) =>
  e.formalizacion ?? (e.nit ? "Con NIT (formal)" : "Sin NIT");

export type Calidad = { campo: string; completos: number; porcentaje: number };

const CAMPOS_CALIDAD: { campo: string; tiene: (e: EmpresaResumen) => boolean }[] = [
  { campo: "NIT", tiene: (e) => Boolean(e.nit) },
  { campo: "Sector", tiene: (e) => Boolean(e.sector) },
  { campo: "Tamaño", tiene: (e) => Boolean(e.tamano) },
  { campo: "Municipio", tiene: (e) => Boolean(e.municipio) },
  { campo: "Contacto", tiene: (e) => Boolean(e.id_representante) || e.contactos > 0 },
  { campo: "Formalización", tiene: (e) => Boolean(e.formalizacion) },
  { campo: "Vínculo UNAB", tiene: (e) => Boolean(e.vinculo_unab) },
];

/** % de empresas con cada dato, y cuántas tienen el perfil básico completo (NIT, sector, tamaño, municipio). */
export function calidadDatos(empresas: EmpresaResumen[]): { campos: Calidad[]; perfilCompleto: number } {
  const total = empresas.length || 1;
  const campos = CAMPOS_CALIDAD.map(({ campo, tiene }) => {
    const completos = empresas.filter(tiene).length;
    return { campo, completos, porcentaje: Math.round((100 * completos) / total) };
  });
  const basicos = CAMPOS_CALIDAD.slice(0, 4);
  const completas = empresas.filter((e) => basicos.every(({ tiene }) => tiene(e))).length;
  return { campos, perfilCompleto: Math.round((100 * completas) / total) };
}

export type DiagnosticoFila = Pick<Diagnostico, (typeof AREAS_DIAGNOSTICO)[number]["campo"]> & {
  id_empresa: string;
  fecha: string;
  creado_en: string;
};

/** Promedio por área usando solo el diagnóstico más reciente de cada empresa. */
export function brechasPorArea(diagnosticos: DiagnosticoFila[]): { barras: Barra[]; empresas: number } {
  const ultimo = new Map<string, DiagnosticoFila>();
  for (const d of diagnosticos) {
    const previo = ultimo.get(d.id_empresa);
    if (!previo || d.fecha > previo.fecha || (d.fecha === previo.fecha && d.creado_en > previo.creado_en)) {
      ultimo.set(d.id_empresa, d);
    }
  }
  const lista = [...ultimo.values()];
  const barras = AREAS_DIAGNOSTICO.map(({ campo, nombre }) => ({
    etiqueta: nombre.replace(/^Gestión (de |)/, ""),
    valor: lista.length ? Number((lista.reduce((s, d) => s + Number(d[campo]), 0) / lista.length).toFixed(2)) : 0,
  }));
  return { barras, empresas: lista.length };
}
