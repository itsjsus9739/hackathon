import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import { ejecutarHerramienta, HERRAMIENTA, MAX_PASOS, SIN_RESPUESTA, SISTEMA, type ConsultaHecha, type RespuestaAsistente } from "./comun";

// Proveedor de modelos abiertos con API compatible con OpenAI (IA_PROVEEDOR=abierto, el predeterminado).
// Groq por defecto (plan gratuito); también sirve OpenRouter, Together u Ollama local cambiando IA_BASE_URL.
export const BASE_URL_PREDETERMINADA = "https://api.groq.com/openai/v1";
export const MODELO_PREDETERMINADO = "openai/gpt-oss-120b";

const argumentos = z.object({ proposito: z.string().default("Consulta"), sql: z.string().min(1) });

const herramienta: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: HERRAMIENTA.nombre,
    description: HERRAMIENTA.descripcion,
    parameters: {
      type: "object",
      properties: {
        proposito: { type: "string", description: HERRAMIENTA.parametros.proposito },
        sql: { type: "string", description: HERRAMIENTA.parametros.sql },
      },
      required: ["proposito", "sql"],
      additionalProperties: false,
    },
  },
};

let cliente: OpenAI | null = null;

export async function preguntarAModeloAbierto(pregunta: string): Promise<RespuestaAsistente> {
  const consultas: ConsultaHecha[] = [];
  cliente ??= new OpenAI({
    baseURL: process.env.IA_BASE_URL || BASE_URL_PREDETERMINADA,
    apiKey: process.env.IA_API_KEY || "sin-clave", // Ollama local no pide clave
    timeout: 45_000,
    maxRetries: 1,
  });
  const modelo = process.env.IA_MODELO || MODELO_PREDETERMINADO;
  const mensajes: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SISTEMA },
    { role: "user", content: pregunta },
  ];

  try {
    for (let paso = 0; paso < MAX_PASOS; paso++) {
      const r = await cliente.chat.completions.create({
        model: modelo,
        messages: mensajes,
        tools: [herramienta],
        tool_choice: "auto",
        temperature: 0.1, // SQL y cifras: poca creatividad
        max_completion_tokens: 4096,
      });
      const eleccion = r.choices[0];
      if (!eleccion) return { ok: false, error: SIN_RESPUESTA, consultas };
      const mensaje = eleccion.message;
      const llamadas = (mensaje.tool_calls ?? []).filter((t) => t.type === "function");

      if (llamadas.length === 0) {
        const respuesta = (mensaje.content ?? "").trim();
        if (!respuesta || eleccion.finish_reason === "length") return { ok: false, error: SIN_RESPUESTA, consultas };
        return { ok: true, respuesta, consultas };
      }

      // Se reenvía solo lo necesario (sin campos propios del proveedor, como el razonamiento)
      mensajes.push({ role: "assistant", content: mensaje.content ?? null, tool_calls: llamadas });
      for (const llamada of llamadas) {
        let contenido: string;
        try {
          const args = argumentos.parse(JSON.parse(llamada.function.arguments || "{}"));
          contenido =
            llamada.function.name === HERRAMIENTA.nombre
              ? await ejecutarHerramienta(args.proposito, args.sql, consultas)
              : `La herramienta ${llamada.function.name} no existe; usa ${HERRAMIENTA.nombre}.`;
        } catch {
          contenido = `Los argumentos no son un JSON válido con "proposito" y "sql". Vuelve a llamar a ${HERRAMIENTA.nombre}.`;
        }
        mensajes.push({ role: "tool", tool_call_id: llamada.id, content: contenido });
      }
    }
    return { ok: false, error: SIN_RESPUESTA, consultas };
  } catch (e) {
    if (e instanceof OpenAI.RateLimitError) {
      return { ok: false, error: "Se alcanzó el límite de preguntas por minuto del proveedor de IA. Espera un momento.", consultas };
    }
    if (e instanceof OpenAI.AuthenticationError) {
      return { ok: false, error: "La clave del proveedor de IA (IA_API_KEY) no es válida.", consultas };
    }
    if (e instanceof OpenAI.APIConnectionError) {
      return { ok: false, error: "No se pudo conectar con el proveedor de IA.", consultas };
    }
    if (e instanceof OpenAI.APIError) {
      return { ok: false, error: `Error del proveedor de IA (${e.status ?? "sin estado"}).`, consultas };
    }
    throw e;
  }
}
