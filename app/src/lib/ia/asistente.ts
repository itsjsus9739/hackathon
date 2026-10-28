import "server-only";

import { MODELO_PREDETERMINADO, preguntarAModeloAbierto } from "./abierto";
import { preguntarAClaude } from "./claude";
import type { RespuestaAsistente } from "./comun";

export type { ConsultaHecha, RespuestaAsistente } from "./comun";

// Selector de proveedor: IA_PROVEEDOR=abierto (predeterminado, modelo abierto vía API compatible
// con OpenAI) o IA_PROVEEDOR=claude. Cambiar de proveedor no toca la base ni la interfaz.
const proveedor = () => (process.env.IA_PROVEEDOR === "claude" ? "claude" : "abierto");

export function asistenteConfigurado(): boolean {
  if (!process.env.IA_DATABASE_URL) return false;
  return proveedor() === "claude"
    ? Boolean(process.env.ANTHROPIC_API_KEY)
    : Boolean(process.env.IA_API_KEY || process.env.IA_BASE_URL);
}

/** Nombre del modelo en uso, para mostrarlo en la interfaz. */
export const modeloEnUso = () =>
  proveedor() === "claude" ? "Claude Opus 5.5" : (process.env.IA_MODELO || MODELO_PREDETERMINADO);

/** Responde una pregunta en lenguaje natural consultando la base con el rol ia_lectura. */
export function preguntarAlAsistente(pregunta: string): Promise<RespuestaAsistente> {
  return proveedor() === "claude" ? preguntarAClaude(pregunta) : preguntarAModeloAbierto(pregunta);
}
