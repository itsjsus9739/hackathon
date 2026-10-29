"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Constants } from "@/lib/supabase/database.types";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoMiEmpresa = { error?: string; ok?: string } | undefined;

const vacio = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : null);

const esquema = z.object({
  empresa: z.uuid(),
  sector: z.string().max(120).nullable(),
  tamano: z.enum(Constants.public.Enums.tamano_empresa).nullable(),
  municipio: z.string().max(120).nullable(),
  formalizacion: z.enum(["Formal", "En proceso", "Informal"]).nullable(),
  descripcion: z.string().max(2000).nullable(),
  nit: z
    .string()
    .regex(/^[\d.\s-]{6,20}$/, "El NIT solo lleva números")
    .nullable(),
});

/** El emprendedor actualiza los datos de su empresa; la base valida que sea suya y avisa al CDE. */
export async function actualizarMiEmpresa(_: EstadoMiEmpresa, formulario: FormData): Promise<EstadoMiEmpresa> {
  const datos = esquema.safeParse({
    empresa: formulario.get("empresa"),
    sector: vacio(formulario.get("sector")),
    tamano: vacio(formulario.get("tamano")),
    municipio: vacio(formulario.get("municipio")),
    formalizacion: vacio(formulario.get("formalizacion")),
    descripcion: vacio(formulario.get("descripcion")),
    nit: vacio(formulario.get("nit")),
  });
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("actualizar_mi_empresa", {
    empresa: d.empresa,
    nuevo_sector: d.sector,
    nuevo_tamano: d.tamano,
    nuevo_municipio: d.municipio,
    nueva_formalizacion: d.formalizacion,
    nueva_descripcion: d.descripcion,
    nuevo_nit: d.nit,
  });
  if (error) {
    if (error.message.includes("NIT ya registrado")) return { error: "El NIT ya registrado solo lo puede cambiar el CDE." };
    if (error.message.includes("Solo puedes")) return { error: "Solo puedes actualizar los datos de tu empresa." };
    if (error.message.includes("nit_solo_digitos")) return { error: "El NIT debe tener entre 6 y 15 dígitos." };
    return { error: "No se pudieron guardar los datos. Inténtalo de nuevo." };
  }
  revalidatePath("/mi-empresa");
  revalidatePath(`/empresas/${d.empresa}`);
  return { ok: "Datos actualizados. El CDE recibió un aviso." };
}
