"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { AREAS_PLAN, ESTADOS_COMPROMISO, ESTADOS_PLAN } from "@/lib/planes";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoAccion = { error?: string } | undefined;

// RLS decide quién puede cambiar qué (CDE, responsable o la empresa); los triggers
// impiden tocar otros campos y mantienen estado y avance coherentes.
const traducir = (mensaje: string) =>
  mensaje.includes("row-level security") || mensaje.includes("Solo el CDE") || mensaje.includes("solo puede")
    ? "No tienes permiso para hacer este cambio."
    : "No se pudo guardar. Inténtalo de nuevo.";

const esquemaAvance = z.object({
  id: z.uuid(),
  avance: z.number().int().min(0).max(100),
  estado: z.enum(ESTADOS_COMPROMISO).optional(),
});

export async function actualizarCompromiso(entrada: z.input<typeof esquemaAvance>): Promise<EstadoAccion> {
  const datos = esquemaAvance.safeParse(entrada);
  if (!datos.success) return { error: "Datos no válidos." };
  const { id, avance, estado } = datos.data;
  const supabase = await crearClienteServidor();
  const cambio = estado ? { avance, estado } : { avance, estado: avance === 0 ? ("Pendiente" as const) : ("En curso" as const) };
  const { data, error } = await supabase.from("compromisos").update(cambio).eq("id", id).select("id");
  if (error) return { error: traducir(error.message) };
  if (!data?.length) return { error: "No tienes permiso para actualizar este compromiso." };
  revalidatePath("/planes");
  revalidatePath("/empresas", "layout");
}

const esquemaEstadoPlan = z.object({ id: z.uuid(), estado: z.enum(ESTADOS_PLAN) });

export async function actualizarEstadoPlan(entrada: z.input<typeof esquemaEstadoPlan>): Promise<EstadoAccion> {
  const datos = esquemaEstadoPlan.safeParse(entrada);
  if (!datos.success) return { error: "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("planes_accion")
    .update({ estado: datos.data.estado })
    .eq("id", datos.data.id)
    .select("id");
  if (error) return { error: traducir(error.message) };
  if (!data?.length) return { error: "Solo el CDE o el responsable pueden cambiar el estado del plan." };
  revalidatePath("/planes");
  revalidatePath("/empresas", "layout");
}

const fecha = z.iso.date().nullable();

const esquemaPlan = z
  .object({
    id_empresa: z.uuid("Elige la empresa"),
    titulo: z.string().trim().min(3, "Escribe un título").max(150),
    objetivo: z.string().trim().max(1000).nullable(),
    area: z.enum(AREAS_PLAN.map((a) => a.campo) as [string, ...string[]]).nullable(),
    id_diagnostico: z.uuid().nullable(),
    id_responsable: z.uuid("Elige el responsable"),
    fecha_inicio: z.iso.date(),
    fecha_limite: fecha,
    compromisos: z
      .array(
        z.object({
          descripcion: z.string().trim().min(3).max(500),
          id_responsable: z.uuid().nullable(),
          fecha_limite: fecha,
        }),
      )
      .min(1, "Agrega al menos un compromiso")
      .max(20),
  })
  .refine((p) => !p.fecha_limite || p.fecha_limite >= p.fecha_inicio, {
    message: "La fecha límite no puede ser anterior al inicio",
    path: ["fecha_limite"],
  });

export async function crearPlan(_: EstadoAccion, formulario: FormData): Promise<EstadoAccion> {
  const vacio = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const descripciones = formulario.getAll("compromiso_descripcion");
  const responsables = formulario.getAll("compromiso_responsable");
  const fechas = formulario.getAll("compromiso_fecha");

  const datos = esquemaPlan.safeParse({
    id_empresa: vacio(formulario.get("id_empresa")),
    titulo: formulario.get("titulo") ?? "",
    objetivo: vacio(formulario.get("objetivo")),
    area: vacio(formulario.get("area")),
    id_diagnostico: vacio(formulario.get("id_diagnostico")),
    id_responsable: vacio(formulario.get("id_responsable")),
    fecha_inicio: vacio(formulario.get("fecha_inicio")),
    fecha_limite: vacio(formulario.get("fecha_limite")),
    compromisos: descripciones
      .map((d, i) => ({ descripcion: d, id_responsable: vacio(responsables[i]), fecha_limite: vacio(fechas[i]) }))
      .filter((c) => typeof c.descripcion === "string" && c.descripcion.trim()),
  });
  if (!datos.success) return { error: datos.error.issues[0].message };

  const { compromisos, ...plan } = datos.data;
  const supabase = await crearClienteServidor();
  const { data: creado, error } = await supabase.from("planes_accion").insert(plan).select("id").single();
  if (error) return { error: traducir(error.message) };

  const { error: errorCompromisos } = await supabase
    .from("compromisos")
    .insert(compromisos.map((c) => ({ ...c, id_plan: creado.id })));
  if (errorCompromisos) {
    // Sin compromisos el plan queda incompleto: se deshace para no dejar basura
    await supabase.from("planes_accion").delete().eq("id", creado.id);
    return { error: traducir(errorCompromisos.message) };
  }

  revalidatePath("/planes");
  revalidatePath(`/empresas/${plan.id_empresa}`);
  redirect(`/planes?empresa=${plan.id_empresa}`);
}
