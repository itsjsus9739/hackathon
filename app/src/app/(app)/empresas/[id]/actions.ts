"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { crearClienteServidor } from "@/lib/supabase/server";

export type ResultadoBrecha = { error?: string };

// RLS: registran y cierran brechas el CDE y los docentes/estudiantes del proyecto de aula de la empresa
const traducir = (mensaje: string) => {
  if (mensaje.includes("row-level security")) return "Solo el CDE o el equipo del proyecto de aula pueden registrar brechas de esta empresa.";
  if (mensaje.includes("duplicate key")) return "Esa brecha ya está registrada para este semestre.";
  return "No se pudo guardar. Inténtalo de nuevo.";
};

const esquemaNueva = z.object({
  id_empresa: z.uuid(),
  id_brecha: z.uuid("Elige una brecha"),
  semestre: z.string().regex(/^\d{4}-[12]$/, "Semestre no válido"),
});

export async function registrarBrecha(entrada: z.input<typeof esquemaNueva>): Promise<ResultadoBrecha> {
  const datos = esquemaNueva.safeParse(entrada);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("brechas_empresa").insert(datos.data);
  if (error) return { error: traducir(error.message) };
  revalidatePath(`/empresas/${datos.data.id_empresa}`);
  return {};
}

const esquemaCierre = z.object({
  id: z.uuid(),
  id_empresa: z.uuid(),
  evidencia: z.string().trim().min(5, "Describe la evidencia del cierre (mínimo 5 caracteres)").max(2000),
});

/** Impacto logrado: la brecha se cierra con la evidencia de lo que cambió. */
export async function cerrarBrecha(entrada: z.input<typeof esquemaCierre>): Promise<ResultadoBrecha> {
  const datos = esquemaCierre.safeParse(entrada);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const { data, error } = await supabase
    .from("brechas_empresa")
    .update({ cerrada_en: hoy, evidencia: datos.data.evidencia })
    .eq("id", datos.data.id)
    .select("id");
  if (error) return { error: traducir(error.message) };
  if (!data?.length) return { error: traducir("row-level security") };
  revalidatePath(`/empresas/${datos.data.id_empresa}`);
  return {};
}

export async function reabrirBrecha(entrada: { id: string; id_empresa: string }): Promise<ResultadoBrecha> {
  if (!z.uuid().safeParse(entrada.id).success || !z.uuid().safeParse(entrada.id_empresa).success) return { error: "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("brechas_empresa").update({ cerrada_en: null }).eq("id", entrada.id).select("id");
  if (error) return { error: traducir(error.message) };
  if (!data?.length) return { error: traducir("row-level security") };
  revalidatePath(`/empresas/${entrada.id_empresa}`);
  return {};
}
