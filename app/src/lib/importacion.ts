// Importar y depurar la base del CDE: encabezados → limpieza y validación por fila →
// duplicados (dentro del archivo y contra la base) → fusión → operaciones a guardar.
// Lógica pura (sin React ni Supabase) para probarla y reutilizarla en servidor y cliente.
import { agruparDuplicados, encontrarDuplicados, normalizarCorreo, normalizarTelefono, similitud, type ParDuplicado } from "./duplicados";
import { calcularDV, parsearNIT } from "./nit";
import { Constants, type Enums } from "./supabase/database.types";

export type Campo =
  | "nombre"
  | "nit"
  | "representante"
  | "correo"
  | "celular"
  | "sector"
  | "tamano"
  | "municipio"
  | "departamento"
  | "vinculo";

export const ETIQUETA_CAMPO: Record<Campo, string> = {
  nombre: "Nombre",
  nit: "NIT",
  representante: "Representante",
  correo: "Correo",
  celular: "Celular",
  sector: "Sector",
  tamano: "Tamaño",
  municipio: "Municipio",
  departamento: "Departamento",
  vinculo: "Vínculo UNAB",
};

// Encabezados que usa el CDE en sus hojas (ya sin tildes ni mayúsculas)
const SINONIMOS: Record<Campo, string[]> = {
  nombre: ["nombre empresa", "nombre de la empresa", "empresa", "razon social", "nombre", "emprendimiento", "negocio"],
  nit: ["nit", "nit empresa", "numero de nit", "identificacion", "documento"],
  representante: ["emprendedor", "representante", "representante legal", "contacto", "nombre contacto", "propietario"],
  correo: ["correo", "correo electronico", "email", "e mail", "mail"],
  celular: ["celular", "telefono", "movil", "whatsapp", "numero de contacto"],
  sector: ["sector", "sector economico", "actividad"],
  tamano: ["tamano", "tamano empresa", "tamano de la empresa"],
  municipio: ["municipio", "ciudad"],
  departamento: ["departamento"],
  vinculo: ["vinculo unab", "vinculo", "relacion con la unab"],
};

const normalizarEncabezado = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Índice de columna de cada campo reconocido (el primer encabezado que coincida). */
export function mapearEncabezados(encabezados: string[]): Partial<Record<Campo, number>> {
  const mapa: Partial<Record<Campo, number>> = {};
  const norm = encabezados.map(normalizarEncabezado);
  for (const campo of Object.keys(SINONIMOS) as Campo[]) {
    const i = norm.findIndex((h, idx) => SINONIMOS[campo].includes(h) && !Object.values(mapa).includes(idx));
    if (i >= 0) mapa[campo] = i;
  }
  return mapa;
}

// ---------------------------------------------------------------------
// Limpieza de cada valor
// ---------------------------------------------------------------------
const PALABRAS_MENORES = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "en"]);

/** Recorta espacios, unifica sufijos (S.A.S.) y corrige TODO MAYÚSCULAS / todo minúsculas. */
export function limpiarNombre(valor: string): string {
  let n = valor.replace(/\s+/g, " ").trim();
  const letras = n.replace(/[^\p{L}]/gu, "");
  if (letras && (letras === letras.toUpperCase() || letras === letras.toLowerCase())) {
    n = n
      .toLowerCase()
      .split(" ")
      .map((p, i) => (i > 0 && PALABRAS_MENORES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
      .join(" ");
  }
  return n
    .replace(/\s+s\.?\s?a\.?\s?s\.?$/i, " S.A.S.")
    .replace(/\s+ltda\.?$/i, " Ltda.");
}

const MUNICIPIOS: Record<string, string> = {
  bucaramanga: "Bucaramanga",
  "b manga": "Bucaramanga",
  bmanga: "Bucaramanga",
  bga: "Bucaramanga",
  floridablanca: "Floridablanca",
  florida: "Floridablanca",
  fblanca: "Floridablanca",
  giron: "Girón",
  piedecuesta: "Piedecuesta",
  lebrija: "Lebrija",
  "san gil": "San Gil",
  barrancabermeja: "Barrancabermeja",
  socorro: "Socorro",
};
const MUNICIPIOS_SANTANDER = new Set(Object.values(MUNICIPIOS));

export function limpiarMunicipio(valor: string): string | null {
  const v = normalizarEncabezado(valor);
  if (!v) return null;
  return MUNICIPIOS[v] ?? limpiarNombre(valor);
}

// Sectores con otro nombre en las hojas del CDE
const SECTORES_EQUIVALENTES: Record<string, string> = {
  "arte y cultura": "Audiovisuales, Arte y Cultura",
  tecnologia: "Tecnológico",
  "manufactura e industrial": "Manufactura / Industrial",
  industrial: "Manufactura / Industrial",
  agropecuario: "Agropecuario / Minero",
  transporte: "Sector Transporte y Logística",
  inmobiliario: "Sector Inmobiliario",
};

/** Sector del catálogo que corresponde al texto; si no hay ninguno parecido, es un sector nuevo. */
export function emparejarSector(valor: string, catalogo: string[]): { sector: string | null; nuevo: boolean } {
  const v = normalizarEncabezado(valor);
  if (!v) return { sector: null, nuevo: false };
  const exacto = catalogo.find((c) => normalizarEncabezado(c) === v);
  if (exacto) return { sector: exacto, nuevo: false };
  const equivalente = SECTORES_EQUIVALENTES[v];
  if (equivalente && catalogo.includes(equivalente)) return { sector: equivalente, nuevo: false };
  const [mejor] = catalogo
    .map((c) => ({ c, s: similitud(c, valor) }))
    .sort((a, b) => b.s - a.s);
  if (mejor && mejor.s >= 0.5) return { sector: mejor.c, nuevo: false };
  return { sector: limpiarNombre(valor), nuevo: true };
}

const buscarEnum = <T extends string>(valores: readonly T[], valor: string): T | null =>
  valores.find((t) => normalizarEncabezado(t) === normalizarEncabezado(valor)) ?? null;

// ---------------------------------------------------------------------
// Validación por fila
// ---------------------------------------------------------------------
export type Fila = {
  /** Número de fila en la hoja (la 1 son los encabezados) */
  fila: number;
  nombre: string;
  nit: string | null;
  nitDv: number | null;
  representante: string | null;
  correo: string | null;
  celular: string | null;
  sector: string | null;
  sectorNuevo: boolean;
  tamano: Enums<"tamano_empresa"> | null;
  municipio: string | null;
  departamento: string | null;
  vinculo: Enums<"vinculo_unab"> | null;
  errores: string[];
  avisos: string[];
};

export type Crudo = Partial<Record<Campo, string>>;

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validarFila(crudo: Crudo, fila: number, sectores: string[]): Fila {
  const errores: string[] = [];
  const avisos: string[] = [];
  const texto = (c: Campo) => (crudo[c] ?? "").replace(/\s+/g, " ").trim();

  const nombreOriginal = texto("nombre");
  const nombre = nombreOriginal ? limpiarNombre(nombreOriginal) : "";
  if (!nombre) errores.push("Falta el nombre de la empresa");
  else if (nombre !== nombreOriginal) avisos.push(`Nombre corregido: «${nombreOriginal}» → «${nombre}»`);

  // NIT: 10 dígitos que empiezan por 8 o 9 traen el DV pegado (900123456 + 7)
  let nit: string | null = null;
  let nitDv: number | null = null;
  const nitTexto = texto("nit");
  if (nitTexto) {
    const digitos = nitTexto.replace(/\D/g, "");
    const parseado = parsearNIT(nitTexto, /^[89]\d{9}$/.test(digitos));
    if (!parseado) {
      errores.push(`NIT «${nitTexto}» no tiene un formato válido`);
    } else if (parseado.nit.length < 6 || parseado.nit.length > 15) {
      errores.push(`NIT «${nitTexto}» tiene una longitud inválida`);
    } else if (parseado.valido === false) {
      errores.push(`El DV no coincide: para el NIT ${parseado.nit} debería ser ${calcularDV(parseado.nit)}, no ${parseado.dv}`);
    } else {
      nit = parseado.nit;
      nitDv = parseado.dv ?? calcularDV(parseado.nit);
      if (parseado.dv === null) avisos.push(`DV calculado: ${nit}-${nitDv}`);
    }
  } else {
    avisos.push("Sin NIT (negocio informal o dato faltante)");
  }

  const correoTexto = texto("correo");
  const correo = normalizarCorreo(correoTexto);
  if (correoTexto && (!correo || !CORREO.test(correo))) avisos.push(`Correo «${correoTexto}» no es válido: se omite`);

  const celularTexto = texto("celular");
  const celular = normalizarTelefono(celularTexto);
  if (celularTexto && !celular) avisos.push(`Celular «${celularTexto}» no es válido: se omite`);

  const { sector, nuevo: sectorNuevo } = emparejarSector(texto("sector"), sectores);
  if (sectorNuevo) avisos.push(`Sector nuevo «${sector}»: se agregará al catálogo`);
  else if (sector && normalizarEncabezado(sector) !== normalizarEncabezado(texto("sector")))
    avisos.push(`Sector «${texto("sector")}» → «${sector}»`);

  const tamanoTexto = texto("tamano");
  const tamano = tamanoTexto ? buscarEnum(Constants.public.Enums.tamano_empresa, tamanoTexto) : null;
  if (tamanoTexto && !tamano) avisos.push(`Tamaño «${tamanoTexto}» no reconocido: se deja vacío`);

  const vinculoTexto = texto("vinculo");
  const vinculo = vinculoTexto ? buscarEnum(Constants.public.Enums.vinculo_unab, vinculoTexto) : null;
  if (vinculoTexto && !vinculo) avisos.push(`Vínculo «${vinculoTexto}» no reconocido: se deja vacío`);

  const municipio = limpiarMunicipio(texto("municipio"));
  if (municipio && municipio !== texto("municipio")) avisos.push(`Municipio «${texto("municipio")}» → «${municipio}»`);
  const departamento =
    (texto("departamento") ? limpiarNombre(texto("departamento")) : null) ??
    (municipio && MUNICIPIOS_SANTANDER.has(municipio) ? "Santander" : null);

  return {
    fila,
    nombre,
    nit,
    nitDv,
    representante: texto("representante") ? limpiarNombre(texto("representante")) : null,
    correo: correo && CORREO.test(correo) ? correo : null,
    celular,
    sector,
    sectorNuevo,
    tamano,
    municipio,
    departamento,
    vinculo,
    errores,
    avisos,
  };
}

/** Convierte la hoja (primera fila = encabezados) en filas validadas. */
export function procesarHoja(tabla: string[][]) {
  const [encabezados = [], ...datos] = tabla;
  const mapa = mapearEncabezados(encabezados.map(String));
  const filas = datos
    .map((celdas, i) => ({ celdas, fila: i + 2 }))
    .filter(({ celdas }) => celdas.some((c) => String(c ?? "").trim()))
    .map(({ celdas, fila }) => {
      const crudo: Crudo = {};
      for (const [campo, idx] of Object.entries(mapa) as [Campo, number][]) crudo[campo] = String(celdas[idx] ?? "");
      return { crudo, fila };
    });
  return { mapa, filas };
}

// ---------------------------------------------------------------------
// Duplicados y fusión
// ---------------------------------------------------------------------
export type EmpresaExistente = {
  id: string;
  nombre: string;
  nit: string | null;
  nit_dv: number | null;
  sector: string | null;
  tamano: Enums<"tamano_empresa"> | null;
  municipio: string | null;
  departamento: string | null;
  vinculo_unab: Enums<"vinculo_unab"> | null;
  correo: string | null;
  telefono: string | null;
};

/** Registro unificado: una fila del archivo ("f:12") o una empresa que ya está en la base ("db:uuid"). */
export type Registro = {
  clave: string;
  origen: "archivo" | "base";
  fila: number | null;
  idEmpresa: string | null;
  nombre: string;
  nit: string | null;
  nitDv: number | null;
  representante: string | null;
  correo: string | null;
  celular: string | null;
  sector: string | null;
  sectorNuevo: boolean;
  tamano: Enums<"tamano_empresa"> | null;
  municipio: string | null;
  departamento: string | null;
  vinculo: Enums<"vinculo_unab"> | null;
};

export const deFila = (f: Fila): Registro => ({
  clave: `f:${f.fila}`,
  origen: "archivo",
  fila: f.fila,
  idEmpresa: null,
  nombre: f.nombre,
  nit: f.nit,
  nitDv: f.nitDv,
  representante: f.representante,
  correo: f.correo,
  celular: f.celular,
  sector: f.sector,
  sectorNuevo: f.sectorNuevo,
  tamano: f.tamano,
  municipio: f.municipio,
  departamento: f.departamento,
  vinculo: f.vinculo,
});

export const deBase = (e: EmpresaExistente): Registro => ({
  clave: `db:${e.id}`,
  origen: "base",
  fila: null,
  idEmpresa: e.id,
  nombre: e.nombre,
  nit: e.nit,
  nitDv: e.nit_dv,
  representante: null,
  correo: e.correo,
  celular: e.telefono,
  sector: e.sector,
  sectorNuevo: false,
  tamano: e.tamano,
  municipio: e.municipio,
  departamento: e.departamento,
  vinculo: e.vinculo_unab,
});

export type GrupoDuplicado = {
  /** Claves ordenadas y unidas: identifica el grupo aunque cambie el orden */
  id: string;
  claves: string[];
  razones: ParDuplicado["razon"][];
};

const ETIQUETA_RAZON: Record<ParDuplicado["razon"], string> = {
  nit: "mismo NIT",
  correo: "mismo correo",
  telefono: "mismo celular",
  nombre: "nombre parecido",
};
export const describirRazones = (r: ParDuplicado["razon"][]) => r.map((x) => ETIQUETA_RAZON[x]).join(" · ");

/** Grupos de registros que parecen la misma empresa. Solo los que incluyen al menos una fila del archivo. */
export function detectarDuplicados(registros: Registro[]): GrupoDuplicado[] {
  const pares = encontrarDuplicados(
    registros.map((r) => ({ id: r.clave, nombre: r.nombre, nit: r.nit, correo: r.correo, telefono: r.celular })),
  ).filter((p) => p.a.startsWith("f:") || p.b.startsWith("f:"));
  return agruparDuplicados(pares)
    .map((claves) => {
      const ordenadas = [...claves].sort();
      const razones = [...new Set(pares.filter((p) => claves.includes(p.a)).map((p) => p.razon))];
      return { id: ordenadas.join("|"), claves: ordenadas, razones };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

const CAMPOS_FUSION = [
  "nombre",
  "nit",
  "nitDv",
  "representante",
  "correo",
  "celular",
  "sector",
  "tamano",
  "municipio",
  "departamento",
  "vinculo",
] as const;

/** Registro principal + los datos que le falten tomados de los demás (en orden). */
export function fusionar(principal: Registro, otros: Registro[]): Registro {
  const resultado: Registro = { ...principal };
  for (const otro of otros) {
    for (const campo of CAMPOS_FUSION) {
      if (resultado[campo] === null || resultado[campo] === "") {
        (resultado as Record<string, unknown>)[campo] = otro[campo];
        if (campo === "sector") resultado.sectorNuevo = otro.sectorNuevo;
        if (campo === "nit") resultado.nitDv = otro.nitDv;
      }
    }
  }
  // Si el grupo incluye una empresa de la base, se actualiza esa en vez de crear otra
  const enBase = principal.idEmpresa ?? otros.find((o) => o.idEmpresa)?.idEmpresa ?? null;
  return { ...resultado, idEmpresa: enBase, origen: enBase ? "base" : "archivo" };
}

// ---------------------------------------------------------------------
// Operaciones a guardar
// ---------------------------------------------------------------------
export type Operacion = {
  accion: "crear" | "actualizar";
  idEmpresa: string | null;
  filas: number[];
  nombre: string;
  nit: string | null;
  nitDv: number | null;
  representante: string | null;
  correo: string | null;
  celular: string | null;
  sector: string | null;
  sectorNuevo: boolean;
  tamano: Enums<"tamano_empresa"> | null;
  municipio: string | null;
  departamento: string | null;
  vinculo: Enums<"vinculo_unab"> | null;
};

export type Decision = { tipo: "fusionar"; principal: string } | { tipo: "distintos" };

/**
 * Plan final: filas válidas, con los grupos fusionados según la decisión del usuario.
 * Los grupos sin decidir bloquean la importación (pendientes).
 */
export function planificar(filas: Fila[], existentes: EmpresaExistente[], decisiones: Record<string, Decision>) {
  const validas = filas.filter((f) => f.errores.length === 0);
  const registros = [...validas.map(deFila), ...existentes.map(deBase)];
  const porClave = new Map(registros.map((r) => [r.clave, r]));
  const grupos = detectarDuplicados(registros);

  const consumidas = new Set<string>();
  const operaciones: Operacion[] = [];
  const pendientes: GrupoDuplicado[] = [];

  const aOperacion = (r: Registro, filasOrigen: number[]): Operacion => ({
    accion: r.idEmpresa ? "actualizar" : "crear",
    idEmpresa: r.idEmpresa,
    filas: filasOrigen,
    nombre: r.nombre,
    nit: r.nit,
    nitDv: r.nitDv,
    representante: r.representante,
    correo: r.correo,
    celular: r.celular,
    sector: r.sector,
    sectorNuevo: r.sectorNuevo,
    tamano: r.tamano,
    municipio: r.municipio,
    departamento: r.departamento,
    vinculo: r.vinculo,
  });

  for (const grupo of grupos) {
    const decision = decisiones[grupo.id];
    if (!decision) {
      pendientes.push(grupo);
      grupo.claves.forEach((c) => consumidas.add(c));
      continue;
    }
    if (decision.tipo === "distintos") continue;   // cada fila sigue su camino por separado
    const principal = porClave.get(decision.principal) ?? porClave.get(grupo.claves[0])!;
    const otros = grupo.claves.filter((c) => c !== principal.clave).map((c) => porClave.get(c)!);
    const unido = fusionar(principal, otros);
    const filasGrupo = grupo.claves.filter((c) => c.startsWith("f:")).map((c) => Number(c.slice(2)));
    operaciones.push(aOperacion(unido, filasGrupo));
    grupo.claves.forEach((c) => consumidas.add(c));
  }

  for (const f of validas) {
    const r = deFila(f);
    if (!consumidas.has(r.clave)) operaciones.push(aOperacion(r, [f.fila]));
  }

  operaciones.sort((a, b) => Math.min(...a.filas) - Math.min(...b.filas));
  return { grupos, pendientes, operaciones, conErrores: filas.length - validas.length };
}
