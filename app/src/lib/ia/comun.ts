import "server-only";

import { ESQUEMA } from "./esquema";
import { ejecutarConsulta, LIMITE_FILAS } from "./sql";

// Piezas compartidas por todos los proveedores de IA: instrucciones, herramienta y tipos.

export type ConsultaHecha = {
  proposito: string;
  sql: string;
  columnas: string[];
  filas: Record<string, unknown>[];
  truncado: boolean;
  error: string | null;
};

export type RespuestaAsistente =
  | { ok: true; respuesta: string; consultas: ConsultaHecha[] }
  | { ok: false; error: string; consultas: ConsultaHecha[] };

export const SISTEMA = `Eres el analista de datos del Centro de Desarrollo Empresarial (CDE) de la UNAB. Respondes en español
a preguntas del equipo del CDE sobre las empresas que acompañan, sus diagnósticos, planes de acción,
proyectos de aula, eventos y postulaciones.

Para obtener datos usa la herramienta consultar_sql (PostgreSQL, solo lectura). Reglas:
- Basa cada cifra en una consulta; si la pregunta no se puede responder con estos datos, dilo.
- Muestra nombres, no ids: une con empresas, perfiles o asignaturas para devolver nombres legibles.
- Para buscar por texto usa ILIKE; la función unaccent no está disponible, así que prueba variantes con y sin tilde.
- Si una consulta falla, corrígela a partir del error; no repitas la misma.
- Las filas con es_ejemplo = true y los campos listados en empresas.datos_estimados son datos de demostración:
  si influyen en la respuesta, menciónalo en una frase.
- Las consultas devuelven como máximo ${LIMITE_FILAS} filas; agrega o resume en SQL en vez de traer listas largas.

Cuando la respuesta sea una lista o comparación, haz que tu ÚLTIMA consulta devuelva exactamente esa tabla
(primera columna: la etiqueta; las demás: los valores), porque la interfaz la muestra como tabla o gráfica.

Respuesta final: breve y directa (2 a 6 frases o una lista corta con guiones), con las cifras clave y,
si aplica, una recomendación concreta para el CDE. Sin encabezados ni tablas en markdown: la tabla ya se muestra aparte.

Esquema disponible:
${ESQUEMA}`;

export const HERRAMIENTA = {
  nombre: "consultar_sql",
  descripcion:
    "Ejecuta una única consulta SELECT de PostgreSQL (solo lectura) sobre la base del CDE y devuelve las filas en JSON. " +
    "Úsala cada vez que necesites datos para responder.",
  parametros: {
    proposito: "Qué averigua esta consulta, en una frase corta en español",
    sql: "Una sola sentencia SELECT o WITH … SELECT, sin punto y coma intermedio",
  },
} as const;

export const MAX_PASOS = 8;

/** Lo que se le reenvía al modelo por consulta (la interfaz muestra todas las filas): ahorra tokens por minuto. */
export const MAX_CARACTERES_AL_MODELO = 6000;

/** Filas en JSON recortadas para el modelo; avisa cuántas quedaron fuera para que agregue en SQL si las necesita. */
export function resultadoParaModelo(filas: Record<string, unknown>[], truncado: boolean, maximo = MAX_CARACTERES_AL_MODELO): string {
  let n = filas.length;
  let texto = JSON.stringify({ filas, truncado });
  while (texto.length > maximo && n > 1) {
    n = Math.max(1, Math.floor(n * 0.7));
    texto = JSON.stringify({
      filas: filas.slice(0, n),
      truncado: true,
      nota: `Solo ves ${n} de ${filas.length} filas (el usuario las ve todas en la tabla). Si necesitas el total, agrega en SQL.`,
    });
  }
  return texto.length > maximo ? texto.slice(0, maximo) : texto;
}

/** Ejecuta la herramienta, registra la consulta y devuelve el texto que recibe el modelo. */
export async function ejecutarHerramienta(proposito: string, sql: string, consultas: ConsultaHecha[]): Promise<string> {
  try {
    const r = await ejecutarConsulta(sql);
    consultas.push({ proposito, sql, ...r, error: null });
    return resultadoParaModelo(r.filas, r.truncado);
  } catch (e) {
    const error = e instanceof Error ? e.message : "Error desconocido";
    consultas.push({ proposito, sql, columnas: [], filas: [], truncado: false, error });
    return `Error al ejecutar la consulta: ${error}`;
  }
}

export const SIN_RESPUESTA = "El asistente no alcanzó a terminar la respuesta. Intenta una pregunta más concreta.";
