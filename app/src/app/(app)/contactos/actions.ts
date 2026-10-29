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

// ---------------------------------------------------------------------
// Empresas vinculadas a la asignatura (proyectos de aula) y su equipo de estudiantes
// ---------------------------------------------------------------------

/** Búsqueda acotada (mínimo 3 letras, máximo 8 resultados): el docente no lista todo el directorio. */
export async function buscarEmpresas(texto: string): Promise<{ id: string; nombre: string; municipio: string | null }[]> {
  const limpio = texto.trim().slice(0, 80);
  if (limpio.length < 3) return [];
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("buscar_empresas_para_vincular", { texto: limpio });
  return data ?? [];
}

const esquemaVinculo = z.object({ id_asignatura: z.uuid(), semestre, id_empresa: z.uuid("Elige una empresa") });

export async function vincularEmpresa(entrada: z.input<typeof esquemaVinculo>): Promise<ResultadoContactos> {
  const datos = esquemaVinculo.safeParse(entrada);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("vincular_empresa_asignatura", {
    asignatura: datos.data.id_asignatura,
    sem: datos.data.semestre,
    empresa: datos.data.id_empresa,
  });
  if (error) {
    return { error: error.message.includes("Solo el docente") ? "Solo el docente que dicta la asignatura puede vincular empresas." : "No se pudo vincular la empresa." };
  }
  revalidatePath("/contactos");
  return {};
}

/** Quitar la empresa de la asignatura: el proyecto queda cancelado (se conserva su historia). */
export async function desvincularEmpresa(idProyecto: string): Promise<ResultadoContactos> {
  if (!z.uuid().safeParse(idProyecto).success) return { error: "Proyecto no válido." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("proyectos_aula").update({ estado: "Cancelado" }).eq("id", idProyecto).select("id");
  if (error || !data?.length) return { error: "Solo el docente del proyecto puede quitar la empresa." };
  revalidatePath("/contactos");
  return {};
}

const esquemaEquipo = z.object({ id_proyecto: z.uuid(), id_estudiante: z.uuid("Elige un estudiante") });

export async function asignarEstudianteProyecto(entrada: z.input<typeof esquemaEquipo>): Promise<ResultadoContactos> {
  const datos = esquemaEquipo.safeParse(entrada);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("proyecto_estudiantes").insert(datos.data);
  if (error) return { error: traducir(error.message) };
  revalidatePath("/contactos");
  return {};
}

export async function retirarEstudianteProyecto(entrada: z.input<typeof esquemaEquipo>): Promise<ResultadoContactos> {
  const datos = esquemaEquipo.safeParse(entrada);
  if (!datos.success) return { error: "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("proyecto_estudiantes")
    .delete()
    .eq("id_proyecto", datos.data.id_proyecto)
    .eq("id_estudiante", datos.data.id_estudiante)
    .select("id_estudiante");
  if (error || !data?.length) return { error: "Solo el docente del proyecto puede retirar estudiantes." };
  revalidatePath("/contactos");
  return {};
}
