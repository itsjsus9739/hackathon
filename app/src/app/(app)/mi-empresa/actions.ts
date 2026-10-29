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
  revalidatePath("/", "layout"); // puntos ganados por completar el perfil: barra de nivel y «+10 pts»
  return { ok: "Datos actualizados. El CDE recibió un aviso." };
}

const esquemaSolicitud = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre de tu empresa").max(200),
  nit: z
    .string()
    .regex(/^[\d.\s-]{6,20}$/, "El NIT solo lleva números")
    .nullable(),
  sector: z.string().max(120).nullable(),
  tamano: z.enum(Constants.public.Enums.tamano_empresa).nullable(),
  municipio: z.string().max(120).nullable(),
  descripcion: z.string().max(2000).nullable(),
  cargo: z.string().max(120).nullable(),
});

/** El emprendedor registra su empresa: queda pendiente hasta que un admin del CDE confirme que le pertenece. */
export async function solicitarEmpresa(_: EstadoMiEmpresa, formulario: FormData): Promise<EstadoMiEmpresa> {
  const datos = esquemaSolicitud.safeParse({
    nombre: formulario.get("nombre") ?? "",
    nit: vacio(formulario.get("nit")),
    sector: vacio(formulario.get("sector")),
    tamano: vacio(formulario.get("tamano")),
    municipio: vacio(formulario.get("municipio")),
    descripcion: vacio(formulario.get("descripcion")),
    cargo: vacio(formulario.get("cargo")),
  });
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("solicitar_empresa", datos.data);
  if (error) {
    if (error.message.includes("Ya enviaste")) return { error: "Ya enviaste una solicitud para esta empresa: el CDE la está revisando." };
    if (error.message.includes("ya está vinculada")) return { error: "Esa empresa ya está vinculada a tu cuenta." };
    if (error.message.includes("Solo los emprendedores")) return { error: "Solo los emprendedores registran su empresa." };
    if (error.message.includes("solicitudes_empresa_nit_check")) return { error: "El NIT debe tener entre 6 y 15 dígitos." };
    return { error: "No se pudo enviar la solicitud. Inténtalo de nuevo." };
  }
  revalidatePath("/mi-empresa");
  return { ok: "Enviamos tu empresa al CDE. Un administrador confirmará que te pertenece y te avisaremos en la campana." };
}

export type EmpresaEncontrada = {
  id: string;
  nombre: string;
  nit: string | null;
  municipio: string | null;
  sector: string | null;
  tiene_representante: boolean;
  vinculada: boolean;
  solicitud_pendiente: boolean;
};

/** Antes de registrar: ¿la empresa ya está en la base? (por NIT o nombre; la base devuelve solo datos mínimos) */
export async function buscarEmpresaRegistro(texto: string): Promise<{ error?: string; resultados?: EmpresaEncontrada[] }> {
  const t = texto.trim().slice(0, 120);
  if (t.length < 3) return { error: "Escribe el NIT o al menos 3 letras del nombre." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("buscar_empresa_registro", { texto: t });
  if (error) return { error: "No se pudo buscar. Inténtalo de nuevo." };
  return { resultados: data ?? [] };
}

/** Unirse a una empresa que ya existe: un admin del CDE la confirma (representante si no tiene, si no miembro). */
export async function unirseAEmpresa(_: EstadoMiEmpresa, formulario: FormData): Promise<EstadoMiEmpresa> {
  const datos = z
    .object({ empresa: z.uuid(), cargo: z.string().trim().max(120).nullable() })
    .safeParse({ empresa: formulario.get("empresa"), cargo: vacio(formulario.get("cargo")) });
  if (!datos.success) return { error: "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("solicitar_union_empresa", { empresa: datos.data.empresa, cargo: datos.data.cargo });
  if (error) {
    if (error.message.includes("Ya enviaste")) return { error: "Ya pediste unirte a esta empresa: el CDE la está revisando." };
    if (error.message.includes("ya está vinculada")) return { error: "Esa empresa ya está vinculada a tu cuenta." };
    if (error.message.includes("Solo los emprendedores")) return { error: "Solo los emprendedores se unen a una empresa." };
    return { error: "No se pudo enviar la solicitud. Inténtalo de nuevo." };
  }
  revalidatePath("/mi-empresa");
  return { ok: "Listo: pediste unirte. Un administrador del CDE lo confirmará y te avisaremos en la campana." };
}
