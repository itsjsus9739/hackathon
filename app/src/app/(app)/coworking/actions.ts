"use server";

import { normalizarAvatar, type Avatar } from "@/lib/coworking/tipos";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function guardarAvatar(avatar: Avatar): Promise<{ error?: string } | undefined> {
  const supabase = await crearClienteServidor();
  // guardar_avatar (SECURITY DEFINER) solo cambia el avatar de quien llama
  const { error } = await supabase.rpc("guardar_avatar", { avatar: normalizarAvatar(avatar) });
  if (error) return { error: "No se pudo guardar el avatar." };
}
