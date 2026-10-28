"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoFormulario = { error?: string; aviso?: string } | undefined;

const esInstitucional = (correo: string) => /^[^@\s]+@unab\.edu\.co$/i.test(correo.trim());

const esquemaIngreso = z.object({
  correo: z.string().trim().email("Escribe un correo válido"),
  contrasena: z.string().min(1, "Escribe tu contraseña"),
});

const esquemaRegistro = z
  .object({
    nombre: z.string().trim().min(3, "Escribe tu nombre completo").max(120),
    correo: z.string().trim().toLowerCase().email("Escribe un correo válido"),
    contrasena: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    rol_solicitado: z.enum(["emprendedor", "docente", "estudiante"]),
    motivo: z.string().trim().max(2000).optional(),
  })
  // Sin correo institucional, el CDE necesita saber quién es para aprobar la solicitud
  .refine((d) => esInstitucional(d.correo) || (d.motivo?.length ?? 0) >= 20, {
    message: "Cuéntale al CDE quién eres y para qué necesitas acceso (mínimo 20 caracteres)",
    path: ["motivo"],
  });

export async function iniciarSesion(_: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const entrada = esquemaIngreso.safeParse(Object.fromEntries(datos));
  if (!entrada.success) return { error: entrada.error.issues[0].message };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: entrada.data.correo,
    password: entrada.data.contrasena,
  });
  if (error) {
    if (error.code === "email_not_confirmed") return { error: "Primero confirma tu correo con el enlace que te enviamos." };
    return { error: "Correo o contraseña incorrectos." };
  }
  // El layout de la aplicación decide: acceso aprobado → inicio; pendiente → /solicitud
  redirect("/");
}

export async function registrarse(_: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const entrada = esquemaRegistro.safeParse(Object.fromEntries(datos));
  if (!entrada.success) return { error: entrada.error.issues[0].message };
  const { nombre, correo, contrasena, rol_solicitado, motivo } = entrada.data;

  const origen = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: contrasena,
    options: {
      emailRedirectTo: `${origen}/auth/confirm`,
      // El trigger de la base usa estos datos para la solicitud de acceso; el rol real lo asigna el CDE
      data: { nombre, rol_solicitado, motivo },
    },
  });
  if (error) {
    if (error.code === "weak_password") return { error: "Elige una contraseña más segura." };
    if (error.code === "over_email_send_rate_limit") return { error: "Demasiados intentos. Espera unos minutos." };
    return { error: "No pudimos crear la cuenta. Inténtalo de nuevo." };
  }
  if (data.session) redirect("/"); // proyecto sin confirmación de correo

  return {
    aviso: esInstitucional(correo)
      ? "Te enviamos un correo de confirmación. Al confirmarlo podrás ingresar con tu cuenta UNAB."
      : "Te enviamos un correo de confirmación. Después de confirmarlo, el CDE revisará tu solicitud de acceso.",
  };
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
