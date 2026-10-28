"use server";

import { z } from "zod";

import { asistenteConfigurado, preguntarAlAsistente, type RespuestaAsistente } from "@/lib/ia/asistente";
import { obtenerSesion } from "@/lib/sesion";

const esquema = z.string().trim().min(5, "Escribe una pregunta un poco más completa").max(500, "La pregunta es muy larga");

export async function preguntar(entrada: string): Promise<RespuestaAsistente> {
  const sesion = await obtenerSesion();
  // El asistente lee toda la base con ia_lectura: solo lo usa el equipo del CDE
  if (!sesion || sesion.estadoAcceso !== "aprobado" || !["cde", "admin_cde"].includes(sesion.rol)) {
    return { ok: false, error: "El asistente es solo para el equipo del CDE.", consultas: [] };
  }
  if (!asistenteConfigurado()) {
    return { ok: false, error: "El asistente aún no está configurado en el servidor.", consultas: [] };
  }
  const pregunta = esquema.safeParse(entrada);
  if (!pregunta.success) return { ok: false, error: pregunta.error.issues[0].message, consultas: [] };

  try {
    return await preguntarAlAsistente(pregunta.data);
  } catch (e) {
    console.error("[asistente]", e);
    return { ok: false, error: "No se pudo consultar la base. Inténtalo de nuevo en un momento.", consultas: [] };
  }
}
