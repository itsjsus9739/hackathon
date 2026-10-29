"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { crearClienteServidor } from "@/lib/supabase/server";

export type ResultadoContactos = { error?: string };

const semestre = z.string().regex(/^\d{4}-[12]$/, "Semestre no válido");

// RLS y las funciones de la base exigen que quien hace el cambio dicte la asignatura (0021_contactos_y_avances.sql)
const traducir = (mensaje: string) => {
  if (mensaje.includes("Solo los docentes")) return "Solo los docentes registran asignaturas.";
  if (mensaje.includes("entre 3 y 120")) return "El nombre de la asignatura debe tener entre 3 y 120 caracteres.";
  if (mensaje.includes("no tiene rol estudiante")) return "Esa persona no está registrada como estudiante.";
  if (mensaje.includes("duplicate key")) return "Ese estudiante ya está en la asignatura.";
  if (mensaje.includes("row-level security")) return "Solo el docente que dicta la asignatura puede cambiar sus estudiantes.";
  return "No se pudo guardar. Inténtalo de nuevo.";
};

const esquemaAsignatura = z.object({ nombre: z.string().trim().min(3, "Escribe el nombre de la asignatura").max(120), semestre });

export async function crearAsignatura(entrada: z.input<typeof esquemaAsignatura>): Promise<ResultadoContactos> {
  const datos = esquemaAsignatura.safeParse(entrada);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("crear_asignatura_docente", datos.data);
  if (error) return { error: traducir(error.message) };
  revalidatePath("/contactos");
  return {};
}

const esquemaInscripcion = z.object({ id_asignatura: z.uuid(), semestre, id_estudiante: z.uuid("Elige un estudiante") });

export async function inscribirEstudiante(entrada: z.input<typeof esquemaInscripcion>): Promise<ResultadoContactos> {
  const datos = esquemaInscripcion.safeParse(entrada);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("asignatura_estudiantes").insert(datos.data);
  if (error) return { error: traducir(error.message) };
  revalidatePath("/contactos");
  return {};
}

export async function retirarEstudiante(entrada: z.input<typeof esquemaInscripcion>): Promise<ResultadoContactos> {
  const datos = esquemaInscripcion.safeParse(entrada);
  if (!datos.success) return { error: "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("asignatura_estudiantes")
    .delete()
    .eq("id_asignatura", datos.data.id_asignatura)
    .eq("semestre", datos.data.semestre)
    .eq("id_estudiante", datos.data.id_estudiante)
    .select("id_estudiante");
  if (error) return { error: traducir(error.message) };
  if (!data?.length) return { error: traducir("row-level security") };
  revalidatePath("/contactos");
  return {};
}

const esquemaDejar = z.object({ id_asignatura: z.uuid(), semestre });

/** El docente deja de figurar en la asignatura (no borra la asignatura del catálogo). */
export async function dejarAsignatura(entrada: z.input<typeof esquemaDejar>): Promise<ResultadoContactos> {
  const datos = esquemaDejar.safeParse(entrada);
  if (!datos.success) return { error: "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { data: usuario } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("asignatura_docentes")
    .delete()
    .eq("id_asignatura", datos.data.id_asignatura)
    .eq("semestre", datos.data.semestre)
    .eq("id_docente", usuario.user?.id ?? "");
  if (error) return { error: traducir(error.message) };
  revalidatePath("/contactos");
  return {};
}
