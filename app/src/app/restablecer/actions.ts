"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import type { EstadoFormulario } from "@/app/login/actions";
import { crearClienteServidor } from "@/lib/supabase/server";

const esquema = z
  .object({
    contrasena: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
    confirmacion: z.string(),
  })
  .refine((d) => d.contrasena === d.confirmacion, { message: "Las contraseñas no coinciden", path: ["confirmacion"] });

export async function restablecerContrasena(_: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const entrada = esquema.safeParse(Object.fromEntries(datos));
  if (!entrada.success) return { error: entrada.error.issues[0].message };

  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "El enlace venció. Pide uno nuevo desde «¿Olvidaste tu contraseña?»." };

  const { error } = await supabase.auth.updateUser({ password: entrada.data.contrasena });
  if (error) {
    if (error.code === "same_password") return { error: "La nueva contraseña debe ser distinta de la anterior." };
    if (error.code === "weak_password") return { error: "Elige una contraseña más segura." };
    return { error: "No pudimos cambiar la contraseña. Inténtalo de nuevo." };
  }
  // El layout decide: acceso aprobado → inicio; pendiente → /solicitud
  redirect("/");
}
