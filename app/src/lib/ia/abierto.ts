import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import { ejecutarHerramienta, HERRAMIENTA, MAX_PASOS, SIN_RESPUESTA, SISTEMA, type ConsultaHecha, type RespuestaAsistente } from "./comun";

// Proveedor de modelos abiertos con API compatible con OpenAI (IA_PROVEEDOR=abierto, el predeterminado).
// Groq por defecto (plan gratuito); también sirve OpenRouter, Together u Ollama local cambiando IA_BASE_URL.
export const BASE_URL_PREDETERMINADA = "https://api.groq.com/openai/v1";
export const MODELO_PREDETERMINADO = "qwen/qwen3-32b";

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
// Modelo que de verdad respondió (si el configurado no existe en el proveedor, se elige otro y se recuerda)
let modeloElegido: string | null = null;
// Google Gemini también habla la API de OpenAI: basta IA_BASE_URL=URL_GEMINI y la clave de Google AI Studio
export const URL_GEMINI = "https://generativelanguage.googleapis.com/v1beta/openai/";
const esGemini = () => (process.env.IA_BASE_URL ?? "").includes("generativelanguage.googleapis.com");
export const modeloActivo = () =>
  modeloElegido ?? (process.env.IA_MODELO || (esGemini() ? "gemini-2.5-flash" : MODELO_PREDETERMINADO));

/** Si el proveedor no tiene el modelo pedido (404), elige entre los que sí ofrece: Gemini Flash, Qwen 32B, otro Qwen o gpt-oss. */
export function elegirModelo(disponibles: string[], pedido: string): string | null {
  if (disponibles.includes(pedido)) return pedido;
  const gemini = disponibles
    .filter((id) => /gemini/i.test(id) && /flash/i.test(id) && !/lite|image|tts|live|audio|embed|exp|preview/i.test(id))
    .sort()
    .at(-1); // la versión más nueva
  return (
    gemini ??
    disponibles.find((id) => /qwen/i.test(id) && /32b/i.test(id)) ??
    disponibles.find((id) => /qwen/i.test(id) && !/guard|vl|audio|embed/i.test(id)) ??
    disponibles.find((id) => id === "openai/gpt-oss-120b") ??
    disponibles.find((id) => /gpt-oss|llama-3\.3-70b/i.test(id)) ??
    null
  );
}

// Groq gratuito limita los tokens por minuto y cuenta el máximo de salida pedido: se pide poco y, si avisa
// que esperemos, se espera lo que indica (sin pasar el tiempo de la función en Vercel, 60 s).
const MAX_SALIDA = 1500;
const ESPERA_MAXIMA_MS = 20_000;
const PRESUPUESTO_MS = 45_000;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cuánto razona cada familia: gpt-oss poco; Qwen3 nada (su modo «pensar» gasta tokens y tiempo en SQL simple). */
function razonamiento(modelo: string): { reasoning_effort?: "low" | "none" } {
  if (modelo.includes("gpt-oss")) return { reasoning_effort: "low" };
  if (/qwen3/i.test(modelo)) return { reasoning_effort: "none" };
  // Gemini Flash: sin «pensar» (si el modelo no lo permite, el proveedor lo rechaza y se reintenta sin él)
  if (/gemini/i.test(modelo) && /flash/i.test(modelo)) return { reasoning_effort: "none" };
  return {};
}

/** Quita el razonamiento que algunos modelos (Qwen3, DeepSeek) dejan en el texto entre <think>…</think>. */
export const limpiarRespuesta = (texto: string) =>
  texto
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^[\s\S]*?<\/think>/i, "") // etiqueta de cierre sin apertura
    .trim();

/**
 * Motivo que da el proveedor, resumido, para saber qué cuota se agotó (Gemini dice si es por minuto,
 * por día o si el modelo no tiene cuota gratuita: «limit: 0»). Sin claves ni datos: solo el texto del error.
 */
export function detalleProveedor(e: { message?: string }): string {
  const texto = (e.message ?? "").replace(/\s+/g, " ").trim();
  if (!texto) return "";
  const cuota = texto.match(/Quota exceeded for metric: [^,]+, limit: \d+/i)?.[0];
  return ` Detalle: ${(cuota ?? texto).slice(0, 220)}`;
}

/** Segundos que pide esperar el proveedor (cabecera retry-after o "try again in 7.5s" en el mensaje). */
export function esperaSugerida(e: { headers?: Headers | Record<string, string> | null; message?: string }): number {
  const h = e.headers;
  const valor = h instanceof Headers ? h.get("retry-after") : h?.["retry-after"];
  const segundos = Number(valor);
  if (Number.isFinite(segundos) && segundos > 0) return segundos * 1000;
  // Groq: "try again in 7.5s"; Gemini: "Please retry in 34.2s"
  const m = e.message?.match(/(?:try again|retry) in ([\d.]+)\s*(ms|s)/i);
  if (m) return Number(m[1]) * (m[2].toLowerCase() === "ms" ? 1 : 1000);
  return 8000;
}

export async function preguntarAModeloAbierto(pregunta: string): Promise<RespuestaAsistente> {
  const consultas: ConsultaHecha[] = [];
  cliente ??= new OpenAI({
    baseURL: process.env.IA_BASE_URL || BASE_URL_PREDETERMINADA,
    apiKey: process.env.IA_API_KEY || "sin-clave", // Ollama local no pide clave
    timeout: 45_000,
    maxRetries: 0, // los reintentos por límite los maneja crear() con la espera que pide el proveedor
  });
  let modelo = modeloActivo();
  let modeloBuscado = false;
  const mensajes: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SISTEMA },
    { role: "user", content: pregunta },
  ];

  const inicio = Date.now();
  const api = cliente;
  let extra = razonamiento(modelo);
  const crear = async () => {
    for (;;) {
      try {
        return await api.chat.completions.create({
          model: modelo,
          messages: mensajes,
          tools: [herramienta],
          tool_choice: "auto",
          temperature: 0.1, // SQL y cifras: poca creatividad
          // Gemini (API compatible) usa el nombre clásico del límite de salida
          ...(esGemini() ? { max_tokens: MAX_SALIDA } : { max_completion_tokens: MAX_SALIDA }),
          ...extra,
        });
      } catch (e) {
        // Si el proveedor no acepta el parámetro de razonamiento para este modelo, se pide sin él
        if (e instanceof OpenAI.BadRequestError && "reasoning_effort" in extra && /reasoning/i.test(e.message)) {
          extra = {};
          continue;
        }
        // El modelo no existe en el proveedor (retirado o mal escrito): se busca uno disponible, una sola vez
        if (e instanceof OpenAI.NotFoundError && !modeloBuscado) {
          modeloBuscado = true;
          const lista = await api.models.list().then((r) => r.data.map((m) => m.id)).catch(() => []);
          const otro = elegirModelo(lista, modelo);
          if (otro && otro !== modelo) {
            console.warn(`[asistente] El modelo ${modelo} no está disponible en el proveedor; se usa ${otro}.`);
            modelo = modeloElegido = otro;
            extra = razonamiento(otro);
            continue;
          }
        }
        const espera = e instanceof OpenAI.RateLimitError ? esperaSugerida(e) : Infinity;
        if (espera > ESPERA_MAXIMA_MS || Date.now() - inicio + espera > PRESUPUESTO_MS) throw e;
        await dormir(espera + 250);
      }
    }
  };

  try {
    for (let paso = 0; paso < MAX_PASOS; paso++) {
      const r = await crear();
      const eleccion = r.choices[0];
      if (!eleccion) return { ok: false, error: SIN_RESPUESTA, consultas };
      const mensaje = eleccion.message;
      const llamadas = (mensaje.tool_calls ?? []).filter((t) => t.type === "function");

      if (llamadas.length === 0) {
        const respuesta = limpiarRespuesta(mensaje.content ?? "");
        if (!respuesta || eleccion.finish_reason === "length") return { ok: false, error: SIN_RESPUESTA, consultas };
        return { ok: true, respuesta, consultas };
      }

      // Se reenvía solo lo necesario (sin campos propios del proveedor, como el razonamiento)
      mensajes.push({ role: "assistant", content: mensaje.content ? limpiarRespuesta(mensaje.content) : null, tool_calls: llamadas });
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
      return {
        ok: false,
        error: consultas.length
          ? "El proveedor de IA llegó a su límite por minuto antes de terminar. Abajo están los datos que alcancé a consultar; vuelve a preguntar en un minuto para la respuesta completa."
          : `Se alcanzó el límite del proveedor de IA (plan gratuito). Vuelve a intentarlo en un minuto.${detalleProveedor(e)}`,
        consultas,
      };
    }
    if (e instanceof OpenAI.AuthenticationError) {
      return { ok: false, error: "La clave del proveedor de IA (IA_API_KEY) no es válida.", consultas };
    }
    if (e instanceof OpenAI.APIConnectionError) {
      return { ok: false, error: "No se pudo conectar con el proveedor de IA.", consultas };
    }
    if (e instanceof OpenAI.NotFoundError) {
      return {
        ok: false,
        error: `El proveedor de IA no tiene el modelo «${modelo}» ni uno parecido. Revisa IA_MODELO (y IA_BASE_URL) en las variables de entorno.`,
        consultas,
      };
    }
    if (e instanceof OpenAI.APIError) {
      return { ok: false, error: `Error del proveedor de IA (${e.status ?? "sin estado"}).`, consultas };
    }
    throw e;
  }
}
