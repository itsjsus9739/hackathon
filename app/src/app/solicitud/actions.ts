"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoSolicitud = { error?: string; aviso?: string } | undefined;

const esquema = z.object({
  rol_solicitado: z.enum(["emprendedor", "docente", "estudiante"]),
  motivo: z.string().trim().min(20, "Cuéntale al CDE quién eres (mínimo 20 caracteres)").max(2000),
});

// El usuario completa su solicitud mientras está pendiente. RLS impide que cambie el estado.
export async function actualizarSolicitud(_: EstadoSolicitud, datos: FormData): Promise<EstadoSolicitud> {
  const entrada = esquema.safeParse(Object.fromEntries(datos));
  if (!entrada.success) return { error: entrada.error.issues[0].message };

  const supabase = await crearClienteServidor();
  const { data: usuario } = await supabase.auth.getUser();
  if (!usuario.user) return { error: "Tu sesión expiró. Ingresa de nuevo." };

  const { data, error } = await supabase
    .from("solicitudes_acceso")
    .update(entrada.data)
    .eq("id_perfil", usuario.user.id)
    .eq("estado", "pendiente")
    .select("id");
  if (error || !data?.length) return { error: "No pudimos actualizar tu solicitud. Puede que ya haya sido revisada." };

  revalidatePath("/solicitud");
  return { aviso: "Solicitud actualizada. El CDE la verá en su bandeja de revisión." };
}
