"use server";

import { headers } from "next/headers";
import { z } from "zod";

import type { EstadoFormulario } from "@/app/login/actions";
import { crearClienteServidor } from "@/lib/supabase/server";

const esquema = z.object({ correo: z.string().trim().toLowerCase().email("Escribe un correo válido") });

export async function solicitarRecuperacion(_: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const entrada = esquema.safeParse(Object.fromEntries(datos));
  if (!entrada.success) return { error: entrada.error.issues[0].message };

  const origen = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(entrada.data.correo, {
    redirectTo: `${origen}/auth/confirm?next=/restablecer`,
  });
  if (error?.code === "over_email_send_rate_limit") return { error: "Demasiados intentos. Espera unos minutos." };

  // Mismo mensaje exista o no la cuenta: no revela qué correos están registrados
  return {
    aviso: "Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña. Ábrelo en este mismo navegador.",
  };
}
