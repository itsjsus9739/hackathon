"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { crearClienteServidor } from "@/lib/supabase/server";

export type Resultado = { error?: string } | undefined;

const refrescar = () => revalidatePath("/", "layout"); // la campana vive en el layout

export async function marcarLeida(id: string): Promise<Resultado> {
  if (!z.uuid().safeParse(id).success) return { error: "Notificación no válida." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("notificaciones").update({ leida_en: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "No se pudo marcar como leída." };
  refrescar();
}

export async function marcarTodasLeidas(): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  // RLS limita la actualización a las notificaciones del usuario
  const { error } = await supabase.from("notificaciones").update({ leida_en: new Date().toISOString() }).is("leida_en", null);
  if (error) return { error: "No se pudieron marcar como leídas." };
  refrescar();
}

export async function borrarNotificacion(id: string): Promise<Resultado> {
  if (!z.uuid().safeParse(id).success) return { error: "Notificación no válida." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("notificaciones").delete().eq("id", id);
  if (error) return { error: "No se pudo borrar." };
  refrescar();
}

const esquemaDocente = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("confirmar"), idNotificacion: z.uuid(), idPerfil: z.uuid() }),
  z.object({ accion: z.literal("aprobar"), idNotificacion: z.uuid(), idPerfil: z.uuid() }),
  z.object({ accion: z.literal("rechazar"), idNotificacion: z.uuid(), idPerfil: z.uuid() }),
  z.object({
    accion: z.literal("cambiar_rol"),
    idNotificacion: z.uuid(),
    idPerfil: z.uuid(),
    rol: z.enum(["emprendedor", "estudiante"]),
  }),
]);

/**
 * Resolver un registro como docente desde la campana. La base decide los permisos:
 * aprobar/rechazar la solicitud es del CDE; cambiar el rol de una cuenta es solo del administrador.
 */
export async function resolverRegistroDocente(entrada: z.input<typeof esquemaDocente>): Promise<Resultado> {
  const datos = esquemaDocente.safeParse(entrada);
  if (!datos.success) return { error: "Datos no válidos." };
  const d = datos.data;
  const supabase = await crearClienteServidor();

  if (d.accion === "aprobar" || d.accion === "rechazar") {
    const { data, error } = await supabase
      .from("solicitudes_acceso")
      .update({
        estado: d.accion === "aprobar" ? "aprobado" : "rechazado",
        comentario_revision: d.accion === "aprobar" ? "Docente confirmado por el CDE" : "No se confirmó como docente",
      })
      .eq("id_perfil", d.idPerfil)
      .select("id");
    if (error || !data?.length) return { error: "No se pudo actualizar la solicitud." };
  }
  if (d.accion === "cambiar_rol") {
    const { data, error } = await supabase.from("perfiles").update({ rol: d.rol }).eq("id", d.idPerfil).select("id");
    if (error || !data?.length) return { error: "Solo un administrador del CDE puede cambiar el rol de una cuenta." };
  }

  await supabase.from("notificaciones").update({ leida_en: new Date().toISOString() }).eq("id", d.idNotificacion);
  refrescar();
}

const esquemaSolicitud = z.object({
  accion: z.enum(["aprobar", "rechazar"]),
  idNotificacion: z.uuid(),
  idPerfil: z.uuid(),
});

/**
 * Aprobar o rechazar una solicitud de acceso con correo externo (solo el CDE: RLS).
 * El trigger aplicar_decision_solicitud actualiza el acceso del perfil. Se marcan como leídas
 * las notificaciones de esa solicitud de quien la resolvió.
 */
export async function resolverSolicitud(entrada: z.input<typeof esquemaSolicitud>): Promise<Resultado> {
  const datos = esquemaSolicitud.safeParse(entrada);
  if (!datos.success) return { error: "Datos no válidos." };
  const d = datos.data;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("solicitudes_acceso")
    .update({
      estado: d.accion === "aprobar" ? "aprobado" : "rechazado",
      comentario_revision: d.accion === "aprobar" ? "Aprobada por el CDE desde las notificaciones" : "Rechazada por el CDE",
    })
    .eq("id_perfil", d.idPerfil)
    .eq("estado", "pendiente")
    .select("id");
  if (error) return { error: "No se pudo actualizar la solicitud. Solo el equipo del CDE puede revisarla." };
  if (!data?.length) return { error: "La solicitud ya fue revisada por otra persona del CDE." };
  await supabase.from("notificaciones").update({ leida_en: new Date().toISOString() }).eq("id_referencia", d.idPerfil).is("leida_en", null);
  refrescar();
}

const esquemaEmpresa = z.object({
  idSolicitud: z.uuid(),
  aprobar: z.boolean(),
  comentario: z.string().max(1000).optional(),
});

/** El admin confirma (vincula o crea la empresa) o rechaza la empresa que registró un emprendedor. */
export async function resolverSolicitudEmpresa(entrada: z.input<typeof esquemaEmpresa>): Promise<Resultado> {
  const datos = esquemaEmpresa.safeParse(entrada);
  if (!datos.success) return { error: "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("resolver_solicitud_empresa", {
    solicitud: datos.data.idSolicitud,
    aprobar: datos.data.aprobar,
    comentario: datos.data.comentario ?? null,
  });
  if (error) {
    if (error.message.includes("Solo un administrador")) return { error: "Solo un administrador del CDE confirma empresas." };
    if (error.message.includes("ya fue revisada")) return { error: "Otra persona del CDE ya revisó esta solicitud." };
    return { error: "No se pudo resolver la solicitud." };
  }
  refrescar();
  revalidatePath("/empresas");
}
