import "server-only";

import { headers } from "next/headers";
import QRCode from "qrcode";

/** Código con el formato de la base: CDE-XXXX-XXXX (sin I ni O). */
export const CODIGO_CERTIFICADO = /^CDE-[0-9A-HJ-NP-Z]{4}-[0-9A-HJ-NP-Z]{4}$/;

export const normalizarCodigo = (codigo: string) => decodeURIComponent(codigo).trim().toUpperCase();

/** URL pública de verificación con el dominio por el que se entró (Vercel, local…). */
export async function urlVerificacion(codigo: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}/verificar/${codigo}`;
}

export const qrVerificacion = (url: string) => QRCode.toDataURL(url, { width: 300, margin: 1, color: { dark: "#0b3d2a" } });
