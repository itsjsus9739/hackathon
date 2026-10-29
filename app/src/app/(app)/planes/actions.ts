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
  revalidatePath("/", "layout"); // un compromiso cumplido da puntos: barra de nivel y «+30 pts»
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
          id: z.uuid().nullable(),   // null = compromiso nuevo
          descripcion: z.string().trim().min(3, "Cada compromiso necesita una descripción").max(500),
          id_responsable: z.uuid().nullable(),
          fecha_limite: fecha,
        }),
      )
      .min(1, "Agrega al menos un compromiso")
      .max(20),
    estudiantes: z.array(z.uuid()).max(50),
  })
  .refine((p) => !p.fecha_limite || p.fecha_limite >= p.fecha_inicio, {
    message: "La fecha límite no puede ser anterior al inicio",
    path: ["fecha_limite"],
  });

type CompromisoFormulario = z.infer<typeof esquemaPlan>["compromisos"][number];
const aFila = (c: CompromisoFormulario, idPlan: string) => ({
  id_plan: idPlan,
  descripcion: c.descripcion,
  id_responsable: c.id_responsable,
  fecha_limite: c.fecha_limite,
});

function leerFormulario(formulario: FormData) {
  const vacio = (v: FormDataEntryValue | null | undefined) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const ids = formulario.getAll("compromiso_id");
  const descripciones = formulario.getAll("compromiso_descripcion");
  const responsables = formulario.getAll("compromiso_responsable");
  const fechas = formulario.getAll("compromiso_fecha");
  return esquemaPlan.safeParse({
    id_empresa: vacio(formulario.get("id_empresa")),
    titulo: formulario.get("titulo") ?? "",
    objetivo: vacio(formulario.get("objetivo")),
    area: vacio(formulario.get("area")),
    id_diagnostico: vacio(formulario.get("id_diagnostico")),
    id_responsable: vacio(formulario.get("id_responsable")),
    fecha_inicio: vacio(formulario.get("fecha_inicio")),
    fecha_limite: vacio(formulario.get("fecha_limite")),
    estudiantes: [...new Set(formulario.getAll("estudiantes").filter((v): v is string => typeof v === "string" && v !== ""))],
    compromisos: descripciones
      .map((d, i) => ({
        id: vacio(ids[i]),
        descripcion: d,
        id_responsable: vacio(responsables[i]),
        fecha_limite: vacio(fechas[i]),
      }))
      .filter((c) => typeof c.descripcion === "string" && c.descripcion.trim()),
  });
}

/** Deja el equipo del plan igual a la lista pedida (agrega y quita estudiantes). Devuelve el error, si hubo. */
async function sincronizarEquipo(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  idPlan: string,
  estudiantes: string[],
): Promise<string | null> {
  const { data: actuales, error } = await supabase.from("plan_estudiantes").select("id_estudiante").eq("id_plan", idPlan);
  if (error) return "no se pudo leer el equipo de estudiantes.";
  const ya = new Set((actuales ?? []).map((a) => a.id_estudiante));
  const pedidos = new Set(estudiantes);
  const nuevos = estudiantes.filter((id) => !ya.has(id));
  const quitados = [...ya].filter((id) => !pedidos.has(id));
  if (nuevos.length) {
    const { error: e } = await supabase.from("plan_estudiantes").insert(nuevos.map((id_estudiante) => ({ id_plan: idPlan, id_estudiante })));
    if (e) return "no se pudo asignar a todos los estudiantes.";
  }
  if (quitados.length) {
    const { error: e } = await supabase.from("plan_estudiantes").delete().eq("id_plan", idPlan).in("id_estudiante", quitados);
    if (e) return "no se pudo quitar a todos los estudiantes.";
  }
  return null;
}

export async function crearPlan(_: EstadoAccion, formulario: FormData): Promise<EstadoAccion> {
  const datos = leerFormulario(formulario);
  if (!datos.success) return { error: datos.error.issues[0].message };

  const { compromisos, estudiantes, ...plan } = datos.data;
  const supabase = await crearClienteServidor();
  const { data: creado, error } = await supabase.from("planes_accion").insert(plan).select("id").single();
  if (error) return { error: traducir(error.message) };

  const { error: errorCompromisos } = await supabase
    .from("compromisos")
    .insert(compromisos.map((c) => aFila(c, creado.id)));
  if (errorCompromisos) {
    // Sin compromisos el plan queda incompleto: se deshace para no dejar basura
    await supabase.from("planes_accion").delete().eq("id", creado.id);
    return { error: traducir(errorCompromisos.message) };
  }
  const errorEquipo = await sincronizarEquipo(supabase, creado.id, estudiantes);
  if (errorEquipo) return { error: `El plan se creó, pero ${errorEquipo}` };

  revalidatePath("/planes");
  revalidatePath(`/empresas/${plan.id_empresa}`);
  redirect(`/planes?empresa=${plan.id_empresa}`);
}

/**
 * Editar un plan (solo CDE, lo exige RLS): datos del plan, responsables y fechas;
 * los compromisos existentes se actualizan, los nuevos se crean y los quitados se borran.
 * El avance reportado no se toca.
 */
export async function editarPlan(_: EstadoAccion, formulario: FormData): Promise<EstadoAccion> {
  const idPlan = z.uuid().safeParse(formulario.get("id_plan"));
  if (!idPlan.success) return { error: "Plan no válido." };
  const datos = leerFormulario(formulario);
  if (!datos.success) return { error: datos.error.issues[0].message };

  // La empresa y el diagnóstico de origen no cambian al editar
  const { compromisos, estudiantes, titulo, objetivo, area, id_responsable, fecha_inicio, fecha_limite } = datos.data;
  const cambios = { titulo, objetivo, area, id_responsable, fecha_inicio, fecha_limite };
  const supabase = await crearClienteServidor();
  const { data: actual, error: errorPlan } = await supabase
    .from("planes_accion")
    .update(cambios)
    .eq("id", idPlan.data)
    .select("id_empresa")
    .maybeSingle();
  if (errorPlan) return { error: traducir(errorPlan.message) };
  if (!actual) return { error: "No tienes permiso para editar este plan." };

  const { data: previos, error: errorPrevios } = await supabase.from("compromisos").select("id").eq("id_plan", idPlan.data);
  if (errorPrevios) return { error: traducir(errorPrevios.message) };
  const existentes = new Set((previos ?? []).map((c) => c.id));
  const conservados = compromisos.filter((c) => c.id && existentes.has(c.id));
  const nuevos = compromisos.filter((c) => !c.id || !existentes.has(c.id));
  const quitados = [...existentes].filter((id) => !conservados.some((c) => c.id === id));

  for (const c of conservados) {
    const { error } = await supabase
      .from("compromisos")
      .update({ descripcion: c.descripcion, id_responsable: c.id_responsable, fecha_limite: c.fecha_limite })
      .eq("id", c.id!)
      .eq("id_plan", idPlan.data);
    if (error) return { error: traducir(error.message) };
  }
  if (nuevos.length) {
    const { error } = await supabase
      .from("compromisos")
      .insert(nuevos.map((c) => aFila(c, idPlan.data)));
    if (error) return { error: traducir(error.message) };
  }
  if (quitados.length) {
    const { error } = await supabase.from("compromisos").delete().in("id", quitados).eq("id_plan", idPlan.data);
    if (error) return { error: traducir(error.message) };
  }

  const errorEquipo = await sincronizarEquipo(supabase, idPlan.data, estudiantes);
  if (errorEquipo) return { error: `Los cambios se guardaron, pero ${errorEquipo}` };

  revalidatePath("/planes");
  revalidatePath(`/empresas/${actual.id_empresa}`);
  redirect(`/planes?empresa=${actual.id_empresa}&vista=todos`);
}

const esquemaAvancePlan = z.object({
  id_plan: z.uuid(),
  texto: z.string().trim().min(5, "Cuenta qué se avanzó (mínimo 5 caracteres)").max(2000),
});

/** El docente (o el CDE, o el responsable) deja constancia de un avance; la empresa recibe el aviso. */
export async function reportarAvancePlan(entrada: z.input<typeof esquemaAvancePlan>): Promise<EstadoAccion> {
  const datos = esquemaAvancePlan.safeParse(entrada);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("avances_plan").insert(datos.data);
  if (error) {
    return {
      error: error.message.includes("row-level security")
        ? "Solo el docente del proyecto de aula, el responsable o el CDE pueden reportar avances de este plan."
        : "No se pudo guardar el avance. Inténtalo de nuevo.",
    };
  }
  revalidatePath("/planes");
}
