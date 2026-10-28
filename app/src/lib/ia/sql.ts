import "server-only";

import { Pool, types } from "pg";

// Consultas del asistente. Tres barreras, de la más fuerte a la más débil:
//   1. el rol de base de datos ia_lectura solo tiene SELECT (y no ve columnas sensibles);
//   2. cada consulta corre en una transacción READ ONLY con statement_timeout y se revierte;
//   3. aquí se acepta un único SELECT/WITH, envuelto en una subconsulta con LIMIT.

export const LIMITE_FILAS = 200;

/** Valida el SQL que propone el modelo. Devuelve el SQL limpio o un motivo de rechazo. */
export function validarConsulta(sql: string): { ok: true; sql: string } | { ok: false; motivo: string } {
  const limpio = sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .trim()
    .replace(/;\s*$/, "")
    .trim();
  if (!limpio) return { ok: false, motivo: "La consulta está vacía." };
  if (limpio.length > 8000) return { ok: false, motivo: "La consulta es demasiado larga." };
  if (limpio.includes(";")) return { ok: false, motivo: "Solo se permite una consulta, sin punto y coma intermedio." };
  if (!/^(select|with)\b/i.test(limpio)) return { ok: false, motivo: "Solo se permiten consultas SELECT (o WITH … SELECT)." };
  if (/\b(pg_sleep|pg_read_file|pg_ls_dir|lo_import|lo_export|dblink|set_config)\b/i.test(limpio)) {
    return { ok: false, motivo: "La consulta usa una función no permitida." };
  }
  return { ok: true, sql: limpio };
}

export type ResultadoConsulta = { columnas: string[]; filas: Record<string, unknown>[]; truncado: boolean };

// numeric y bigint llegan como texto por defecto: para el asistente y las gráficas basta con number
types.setTypeParser(types.builtins.NUMERIC, (v) => Number(v));
types.setTypeParser(types.builtins.INT8, (v) => Number(v));

let pool: Pool | null = null;
const obtenerPool = () => {
  const url = process.env.IA_DATABASE_URL;
  if (!url) throw new Error("Falta configurar IA_DATABASE_URL (conexión con el rol ia_lectura).");
  // Supabase exige TLS; su certificado no está en el almacén de Node, por eso no se verifica la cadena.
  // IA_DATABASE_SSL=false solo para pruebas contra un Postgres local.
  const ssl = process.env.IA_DATABASE_SSL === "false" ? false : { rejectUnauthorized: false };
  pool ??= new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000, ssl });
  return pool;
};

export const asistenteConfigurado = () => Boolean(process.env.IA_DATABASE_URL && process.env.ANTHROPIC_API_KEY);

export async function ejecutarConsulta(sql: string): Promise<ResultadoConsulta> {
  const valida = validarConsulta(sql);
  if (!valida.ok) throw new Error(valida.motivo);
  const cliente = await obtenerPool().connect();
  try {
    await cliente.query("begin transaction read only");
    await cliente.query("set local statement_timeout = '8s'");
    const r = await cliente.query({
      text: `select * from (${valida.sql}) as consulta limit ${LIMITE_FILAS + 1}`,
      rowMode: "array",
    });
    const columnas = r.fields.map((f) => f.name);
    const filas = (r.rows as unknown[][]).slice(0, LIMITE_FILAS).map((fila) =>
      Object.fromEntries(fila.map((v, i) => [columnas[i], v instanceof Date ? v.toISOString() : v])),
    );
    return { columnas, filas, truncado: r.rows.length > LIMITE_FILAS };
  } finally {
    await cliente.query("rollback").catch(() => {});
    cliente.release();
  }
}
