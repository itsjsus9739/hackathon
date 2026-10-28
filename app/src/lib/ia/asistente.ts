import "server-only";

import { MODELO_PREDETERMINADO, preguntarAModeloAbierto } from "./abierto";
import { preguntarAClaude } from "./claude";
import type { RespuestaAsistente } from "./comun";

export type { ConsultaHecha, RespuestaAsistente } from "./comun";

// Selector de proveedor: IA_PROVEEDOR=abierto (predeterminado, modelo abierto vía API compatible
// con OpenAI) o IA_PROVEEDOR=claude. Cambiar de proveedor no toca la base ni la interfaz.
const proveedor = () => (process.env.IA_PROVEEDOR === "claude" ? "claude" : "abierto");

/** Variables que le faltan al servidor para usar el asistente (vacío = listo). */
export function variablesFaltantes(): string[] {
  const faltan: string[] = [];
  if (!process.env.IA_DATABASE_URL) faltan.push("IA_DATABASE_URL");
  if (proveedor() === "claude") {
    if (!process.env.ANTHROPIC_API_KEY) faltan.push("ANTHROPIC_API_KEY");
  } else if (!process.env.IA_API_KEY && !process.env.IA_BASE_URL) {
    faltan.push("IA_API_KEY");
  }
  return faltan;
}

export const asistenteConfigurado = () => variablesFaltantes().length === 0;

/** Nombre del modelo en uso, para mostrarlo en la interfaz. */
export const modeloEnUso = () =>
  proveedor() === "claude" ? "Claude Opus 5.5" : (process.env.IA_MODELO || MODELO_PREDETERMINADO);

/** Responde una pregunta en lenguaje natural consultando la base con el rol ia_lectura. */
export function preguntarAlAsistente(pregunta: string): Promise<RespuestaAsistente> {
  return proveedor() === "claude" ? preguntarAClaude(pregunta) : preguntarAModeloAbierto(pregunta);
}
