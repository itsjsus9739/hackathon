"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { cambiosInvitados, esRolCde, leerQrAsistencia, TIPOS_EVENTO } from "@/lib/eventos";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";

export type ResultadoEvento = { error?: string; id?: string };

// RLS decide quién crea, edita, invita y responde (0019_calendario_eventos.sql)
const traducir = (mensaje: string) => {
  if (mensaje.includes("cupos")) return "El evento ya no tiene cupos disponibles.";
  if (mensaje.includes("row-level security")) return "Tu rol no tiene permiso para hacer esto con esta actividad.";
  if (mensaje.includes("eventos_fin_check")) return "La hora de fin debe ser posterior al inicio.";
  return "No se pudo guardar. Inténtalo de nuevo.";
};

const esquemaEvento = z
  .object({
    id: z.uuid().optional(),
    nombre: z.string().trim().min(3, "Escribe un título").max(200),
    tipo: z.enum(TIPOS_EVENTO.map((t) => t.tipo) as [string, ...string[]], "Tipo de actividad no válido"),
    inicio: z.iso.datetime({ offset: true }),
    fin: z.iso.datetime({ offset: true }),
    lugar: z.string().trim().max(200).optional().default(""),
    descripcion: z.string().trim().max(4000).optional().default(""),
    cupo: z.number().int().positive().max(10000).nullable().optional(),
    // Puntos de gamificación al asistir: solo los fija el CDE (la base los pone en 0 para los demás)
    puntos: z.number().int().min(0).max(500).optional(),
    invitados: z.array(z.uuid()).max(500).default([]),
  })
  .refine((d) => Date.parse(d.fin) > Date.parse(d.inicio), { message: "La hora de fin debe ser posterior al inicio", path: ["fin"] });

export async function guardarEvento(entrada: z.input<typeof esquemaEvento>): Promise<ResultadoEvento> {
  const datos = esquemaEvento.safeParse(entrada);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Datos no válidos." };
  const sesion = await obtenerSesion();
  if (!sesion) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  const d = datos.data;
  const supabase = await crearClienteServidor();

  const fila = {
    nombre: d.nombre,
    tipo: d.tipo,
    fecha: d.inicio,
    fin: d.fin,
    lugar: d.lugar || null,
    descripcion: d.descripcion || null,
    cupo: d.cupo ?? null,
    ...(d.puntos !== undefined && esRolCde(sesion.rol) ? { puntos_gamificacion: d.puntos } : {}),
  };
  const guardado = d.id
    ? await supabase.from("eventos").update(fila).eq("id", d.id).select("id, creado_por").maybeSingle()
    : await supabase.from("eventos").insert(fila).select("id, creado_por").single();
  if (guardado.error) return { error: traducir(guardado.error.message) };
  if (!guardado.data) return { error: "Solo quien la organiza o el CDE pueden editar esta actividad." };
  const id = guardado.data.id;

  // Invitados: se agregan los nuevos (pendiente + aviso en la campana) y se quitan los que ya no están
  const { data: actuales, error: errorActuales } = await supabase
    .from("inscripciones_eventos")
    .select("id_usuario, invitado_por")
    .eq("id_evento", id);
  if (errorActuales) return { error: traducir(errorActuales.message), id };
  const organizador = guardado.data.creado_por ?? sesion.id;
  const { invitar, quitar } = cambiosInvitados(actuales ?? [], d.invitados, organizador);
  if (invitar.length) {
    const { error } = await supabase
      .from("inscripciones_eventos")
      .insert(invitar.map((id_usuario) => ({ id_evento: id, id_usuario, estado: "pendiente", invitado_por: sesion.id })));
    if (error) return { error: `La actividad se guardó, pero no se pudo invitar a todos: ${traducir(error.message)}`, id };
  }
  if (quitar.length) {
    const { error } = await supabase.from("inscripciones_eventos").delete().eq("id_evento", id).in("id_usuario", quitar);
    if (error) return { error: `La actividad se guardó, pero no se pudo quitar a todos los invitados.`, id };
  }
  revalidatePath("/eventos");
  return { id };
}

const esquemaMover = z.object({ id: z.uuid(), inicio: z.iso.datetime({ offset: true }), fin: z.iso.datetime({ offset: true }) });

export async function moverEvento(entrada: z.input<typeof esquemaMover>): Promise<ResultadoEvento> {
  const datos = esquemaMover.safeParse(entrada);
  if (!datos.success || Date.parse(datos.data.fin) <= Date.parse(datos.data.inicio)) return { error: "Horario no válido." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("eventos")
    .update({ fecha: datos.data.inicio, fin: datos.data.fin })
    .eq("id", datos.data.id)
    .select("id");
  if (error) return { error: traducir(error.message) };
  if (!data?.length) return { error: "Solo quien la organiza o el CDE pueden moverla." };
  revalidatePath("/eventos");
  return { id: datos.data.id };
}

export async function borrarEvento(id: string): Promise<ResultadoEvento> {
  if (!z.uuid().safeParse(id).success) return { error: "Actividad no válida." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("eventos").delete().eq("id", id).select("id");
  if (error) return { error: traducir(error.message) };
  if (!data?.length) return { error: "Solo quien la organiza o el CDE pueden eliminarla." };
  revalidatePath("/eventos");
  return {};
}

const esquemaRespuesta = z.object({ id: z.uuid(), estado: z.enum(["confirmado", "rechazado"]) });

/** Asistiré / No asistiré. En eventos públicos sin invitación, responder es inscribirse. */
export async function responderEvento(entrada: z.input<typeof esquemaRespuesta>): Promise<ResultadoEvento> {
  const datos = esquemaRespuesta.safeParse(entrada);
  if (!datos.success) return { error: "Respuesta no válida." };
  const sesion = await obtenerSesion();
  if (!sesion) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  const supabase = await crearClienteServidor();
  const { id, estado } = datos.data;

  const { data: actualizada, error } = await supabase
    .from("inscripciones_eventos")
    .update({ estado })
    .eq("id_evento", id)
    .eq("id_usuario", sesion.id)
    .select("id");
  if (error) return { error: traducir(error.message) };
  if (!actualizada?.length) {
    const { error: errorInscripcion } = await supabase
      .from("inscripciones_eventos")
      .insert({ id_evento: id, id_usuario: sesion.id, estado });
    if (errorInscripcion) {
      return {
        error: errorInscripcion.message.includes("row-level security")
          ? "Esta actividad es solo para invitados."
          : traducir(errorInscripcion.message),
      };
    }
  }
  revalidatePath("/eventos");
  return { id };
}

// ---------------------------------------------------------------------
// Asistencia real: la marca el CDE (a mano o escaneando el QR del participante).
// Al marcarla, la base suma los puntos del evento y revisa insignias (puntos_por_asistencia).
// ---------------------------------------------------------------------
export type ResultadoAsistencia = { error?: string; nombre?: string; evento?: string; puntos?: number; yaEstaba?: boolean };

const esquemaAsistencia = z.object({ idInscripcion: z.uuid(), asistio: z.boolean() });

export async function marcarAsistencia(entrada: z.input<typeof esquemaAsistencia>): Promise<ResultadoAsistencia> {
  const datos = esquemaAsistencia.safeParse(entrada);
  if (!datos.success) return { error: "Datos no válidos." };
  const sesion = await obtenerSesion();
  if (!sesion || sesion.estadoAcceso !== "aprobado" || !esRolCde(sesion.rol)) return { error: "Solo el equipo del CDE registra la asistencia." };
  const { idInscripcion, asistio } = datos.data;
  const supabase = await crearClienteServidor();

  const { data: antes } = await supabase
    .from("inscripciones_eventos")
    .select("asistio, id_usuario, eventos (nombre, puntos_gamificacion)")
    .eq("id", idInscripcion)
    .maybeSingle();
  if (!antes) return { error: "No encontramos esa inscripción." };

  const { error } = await supabase.from("inscripciones_eventos").update({ asistio }).eq("id", idInscripcion);
  if (error) return { error: traducir(error.message) };
  const { data: persona } = await supabase.rpc("directorio").eq("id", antes.id_usuario).maybeSingle();

  revalidatePath("/eventos", "layout");
  revalidatePath("/formacion");
  return {
    nombre: persona?.nombre ?? "Participante",
    evento: antes.eventos?.nombre ?? "Evento",
    puntos: asistio ? (antes.eventos?.puntos_gamificacion ?? 0) : 0,
    yaEstaba: antes.asistio === asistio,
  };
}

/** Lo que lee la cámara del CDE: el QR que el participante muestra en su teléfono. */
export async function registrarAsistenciaQr(texto: string): Promise<ResultadoAsistencia> {
  const idInscripcion = leerQrAsistencia(texto);
  if (!idInscripcion) return { error: "Este código no es un QR de asistencia de CDE Nest." };
  return marcarAsistencia({ idInscripcion, asistio: true });
}
