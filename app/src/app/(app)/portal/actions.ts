"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { crearClienteServidor } from "@/lib/supabase/server";

export type Resultado = { error?: string; ok?: string } | undefined;

// La base valida quién puede pedir, dar o quitar acceso (0029_portal_emprendedor.sql); aquí solo se traducen sus mensajes
const MENSAJES = /Solo los estudiantes|Ya pediste|Solo el equipo del CDE|Solo se da acceso|no existe/;
const traducir = (mensaje: string, generico: string) => (MENSAJES.test(mensaje) ? `${mensaje}.` : generico);

const refrescar = () => {
  revalidatePath("/portal");
  revalidatePath("/", "layout"); // campana
};

const esquemaSolicitud = z.object({ empresa: z.uuid({ error: "Elige la empresa." }), motivo: z.string().trim().max(500).optional() });

/** El estudiante pide ver el portal de una empresa; el CDE recibe el aviso en la campana. */
export async function solicitarAccesoPortal(_: Resultado, formulario: FormData): Promise<Resultado> {
  const datos = esquemaSolicitud.safeParse({ empresa: formulario.get("empresa"), motivo: formulario.get("motivo") ?? undefined });
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("solicitar_acceso_portal", { empresa: datos.data.empresa, motivo: datos.data.motivo || null });
  if (error) return { error: traducir(error.message, "No se pudo enviar la solicitud.") };
  refrescar();
  return { ok: "Solicitud enviada. Un miembro del CDE la revisará y te avisará en la campana." };
}

export async function resolverAccesoPortal(entrada: { acceso: string; aprobar: boolean }): Promise<Resultado> {
  const datos = z.object({ acceso: z.uuid(), aprobar: z.boolean() }).safeParse(entrada);
  if (!datos.success) return { error: "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("resolver_acceso_portal", datos.data);
  if (error) return { error: traducir(error.message, "No se pudo resolver la solicitud.") };
  refrescar();
  revalidatePath("/notificaciones");
}

export async function otorgarAccesoPortal(_: Resultado, formulario: FormData): Promise<Resultado> {
  const datos = z
    .object({ empresa: z.uuid(), estudiante: z.uuid({ error: "Elige el estudiante." }) })
    .safeParse({ empresa: formulario.get("empresa"), estudiante: formulario.get("estudiante") });
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("otorgar_acceso_portal", datos.data);
  if (error) return { error: traducir(error.message, "No se pudo dar el acceso.") };
  refrescar();
  return { ok: "Acceso otorgado. El estudiante recibió un aviso." };
}

export async function revocarAccesoPortal(acceso: string): Promise<Resultado> {
  if (!z.uuid().safeParse(acceso).success) return { error: "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("revocar_acceso_portal", { acceso });
  if (error) return { error: traducir(error.message, "No se pudo revocar el acceso.") };
  refrescar();
}
