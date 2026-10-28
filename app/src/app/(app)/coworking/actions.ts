"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { normalizarAvatar, type Avatar } from "@/lib/coworking/tipos";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoSala = { error?: string } | undefined;

export async function guardarAvatar(avatar: Avatar): Promise<{ error?: string } | undefined> {
  const supabase = await crearClienteServidor();
  // guardar_avatar (SECURITY DEFINER) solo cambia el avatar de quien llama
  const { error } = await supabase.rpc("guardar_avatar", { avatar: normalizarAvatar(avatar) });
  if (error) return { error: "No se pudo guardar el avatar." };
}

const esquemaSala = z.object({
  nombre: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").max(60),
  clave: z
    .string()
    .max(72)
    .refine((c) => c === "" || c.length >= 4, "La contraseña debe tener al menos 4 caracteres (o déjala vacía para una sala abierta)"),
});

export async function crearSala(_: EstadoSala, formulario: FormData): Promise<EstadoSala> {
  const datos = esquemaSala.safeParse({ nombre: formulario.get("nombre") ?? "", clave: formulario.get("clave") ?? "" });
  if (!datos.success) return { error: datos.error.issues[0].message };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("crear_sala", { nombre: datos.data.nombre, clave: datos.data.clave || undefined });
  if (error || !data) return { error: "No se pudo crear la sala." };
  revalidatePath("/coworking");
  redirect(`/coworking?sala=${data}`);
}

export async function unirseSala(_: EstadoSala, formulario: FormData): Promise<EstadoSala> {
  const id = z.uuid().safeParse(formulario.get("sala"));
  if (!id.success) return { error: "Sala no válida." };
  const clave = String(formulario.get("clave") ?? "");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("unirse_sala", { sala: id.data, clave: clave || undefined });
  if (error) return { error: "No se pudo entrar a la sala." };
  if (!data) return { error: "Contraseña incorrecta." };
  redirect(`/coworking?sala=${id.data}`);
}

export async function borrarSala(id: string): Promise<EstadoSala> {
  if (!z.uuid().safeParse(id).success) return { error: "Sala no válida." };
  const supabase = await crearClienteServidor();
  // RLS: solo quien la creó o el CDE
  const { data, error } = await supabase.from("salas_coworking").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: "Solo quien creó la sala o el CDE pueden borrarla." };
  revalidatePath("/coworking");
}
