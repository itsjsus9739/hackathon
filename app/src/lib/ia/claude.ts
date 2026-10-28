import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";

import { ejecutarHerramienta, HERRAMIENTA, MAX_PASOS, SIN_RESPUESTA, SISTEMA, type ConsultaHecha, type RespuestaAsistente } from "./comun";

let cliente: Anthropic | null = null;

/** Proveedor Claude (IA_PROVEEDOR=claude): toolRunner del SDK de Anthropic. */
export async function preguntarAClaude(pregunta: string): Promise<RespuestaAsistente> {
  const consultas: ConsultaHecha[] = [];
  cliente ??= new Anthropic();

  const consultarSql = betaZodTool({
    name: HERRAMIENTA.nombre,
    description: HERRAMIENTA.descripcion,
    inputSchema: z.object({
      proposito: z.string().describe(HERRAMIENTA.parametros.proposito),
      sql: z.string().describe(HERRAMIENTA.parametros.sql),
    }),
    run: ({ proposito, sql }) => ejecutarHerramienta(proposito, sql, consultas),
  });

  try {
    const final = await cliente.beta.messages.toolRunner({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      max_iterations: MAX_PASOS,
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
    if (!respuesta) return { ok: false, error: SIN_RESPUESTA, consultas };
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
