// Detección de empresas/personas duplicadas aunque estén escritas distinto.
// Misma lógica que normalizar_nombre() + pg_trgm en la base de datos, para usarla
// en el importador antes de insertar (vista previa) y en pruebas.
import { parsearNIT } from "./nit";

const SUFIJOS_SOCIETARIOS = /\b(s\.?\s?a\.?\s?s\.?|s\.?\s?a\.?|ltda\.?|e\.?\s?u\.?|s\.?\s?en\s?c\.?|y\s+cia\.?)(?=\s|$)/g;

export function normalizarNombre(t: string | null | undefined): string {
  return (t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(SUFIJOS_SOCIETARIOS, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizarCorreo(c: string | null | undefined): string | null {
  const v = (c ?? "").trim().toLowerCase();
  return v.includes("@") ? v : null;
}

export function normalizarTelefono(t: string | null | undefined): string | null {
  const d = (t ?? "").replace(/\D/g, "").replace(/^57(?=3\d{9}$)/, "");
  return d.length >= 7 ? d : null;
}

// Similitud por trigramas, equivalente a similarity() de pg_trgm.
function trigramas(s: string): Set<string> {
  const out = new Set<string>();
  for (const palabra of s.split(" ").filter(Boolean)) {
    const p = `  ${palabra} `;
    for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3));
  }
  return out;
}

export function similitud(a: string, b: string): number {
  const ta = trigramas(normalizarNombre(a));
  const tb = trigramas(normalizarNombre(b));
  if (!ta.size || !tb.size) return 0;
  let comunes = 0;
  for (const t of ta) if (tb.has(t)) comunes++;
  return comunes / (ta.size + tb.size - comunes);
}

export type RegistroEmpresa = {
  id: string;
  nombre: string;
  nit?: string | null;
  correo?: string | null;
  telefono?: string | null;
};

export type ParDuplicado = { a: string; b: string; razon: "nit" | "correo" | "telefono" | "nombre"; puntaje: number };

export const UMBRAL_NOMBRE = 0.75;

export function encontrarDuplicados(registros: RegistroEmpresa[], umbral = UMBRAL_NOMBRE): ParDuplicado[] {
  const pares: ParDuplicado[] = [];
  const norm = registros.map((r) => ({
    ...r,
    nit: parsearNIT(r.nit)?.nit ?? null,
    correo: normalizarCorreo(r.correo),
    telefono: normalizarTelefono(r.telefono),
  }));
  for (let i = 0; i < norm.length; i++) {
    for (let j = i + 1; j < norm.length; j++) {
      const a = norm[i];
      const b = norm[j];
      if (a.nit && a.nit === b.nit) pares.push({ a: a.id, b: b.id, razon: "nit", puntaje: 1 });
      else if (a.correo && a.correo === b.correo) pares.push({ a: a.id, b: b.id, razon: "correo", puntaje: 0.95 });
      else if (a.telefono && a.telefono === b.telefono) pares.push({ a: a.id, b: b.id, razon: "telefono", puntaje: 0.9 });
      else {
        const s = similitud(a.nombre, b.nombre);
        if (s >= umbral) pares.push({ a: a.id, b: b.id, razon: "nombre", puntaje: Number(s.toFixed(2)) });
      }
    }
  }
  return pares.sort((x, y) => y.puntaje - x.puntaje);
}

// Agrupa pares en conjuntos (union-find) para mostrar "estas 3 fichas son la misma empresa".
export function agruparDuplicados(pares: ParDuplicado[]): string[][] {
  const padre = new Map<string, string>();
  const raiz = (x: string): string => {
    const p = padre.get(x) ?? x;
    if (p === x) return x;
    const r = raiz(p);
    padre.set(x, r);
    return r;
  };
  for (const { a, b } of pares) padre.set(raiz(a), raiz(b));
  const grupos = new Map<string, string[]>();
  for (const id of new Set(pares.flatMap((p) => [p.a, p.b]))) {
    const r = raiz(id);
    grupos.set(r, [...(grupos.get(r) ?? []), id]);
  }
  return [...grupos.values()];
}
