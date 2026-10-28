import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";

import { ESQUEMA } from "./esquema";
import { ejecutarConsulta, LIMITE_FILAS } from "./sql";

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

const SISTEMA = `Eres el analista de datos del Centro de Desarrollo Empresarial (CDE) de la UNAB. Respondes en español
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

let cliente: Anthropic | null = null;

/** Responde una pregunta en lenguaje natural consultando la base con el rol ia_lectura. */
export async function preguntarAlAsistente(pregunta: string): Promise<RespuestaAsistente> {
  const consultas: ConsultaHecha[] = [];
  cliente ??= new Anthropic();

  const consultarSql = betaZodTool({
    name: "consultar_sql",
    description:
      "Ejecuta una única consulta SELECT de PostgreSQL (solo lectura) sobre la base del CDE y devuelve las filas en JSON. " +
      "Úsala cada vez que necesites datos para responder.",
    inputSchema: z.object({
      proposito: z.string().describe("Qué averigua esta consulta, en una frase corta en español"),
      sql: z.string().describe("Una sola sentencia SELECT o WITH … SELECT, sin punto y coma intermedio"),
    }),
    run: async ({ proposito, sql }) => {
      try {
        const r = await ejecutarConsulta(sql);
        consultas.push({ proposito, sql, ...r, error: null });
        return JSON.stringify({ filas: r.filas, truncado: r.truncado });
      } catch (e) {
        const error = e instanceof Error ? e.message : "Error desconocido";
        consultas.push({ proposito, sql, columnas: [], filas: [], truncado: false, error });
        return `Error al ejecutar la consulta: ${error}`;
      }
    },
  });

  try {
    const final = await cliente.beta.messages.toolRunner({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      max_iterations: 8,
      output_config: { effort: "medium" },
      // Si un clasificador de seguridad rechaza la petición, la API reintenta con otro modelo
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
      tools: [consultarSql],
      messages: [{ role: "user", content: pregunta }],
    });

    if (final.stop_reason === "refusal") {
      return { ok: false, error: "El asistente no pudo responder esta pregunta. Intenta formularla de otra manera.", consultas };
    }
    const respuesta = final.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!respuesta) {
      return { ok: false, error: "El asistente no alcanzó a terminar la respuesta. Intenta una pregunta más concreta.", consultas };
    }
    return { ok: true, respuesta, consultas };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "El asistente está recibiendo muchas preguntas. Espera un momento.", consultas };
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "La clave de la API de Claude no es válida.", consultas };
    }
    if (e instanceof Anthropic.APIError) {
      return { ok: false, error: `Error del servicio de IA (${e.status ?? "sin estado"}).`, consultas };
    }
    throw e;
  }
}
