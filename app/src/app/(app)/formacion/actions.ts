"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { esCde, recompensaParaRol } from "@/lib/gamificacion";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Resultado = { error?: string; aviso?: string; valores?: Record<string, string> } | undefined;

/** Lo que el usuario escribió, para devolverlo al formulario si hay un error (React lo vacía al enviar). */
const valoresDe = (formulario: FormData) =>
  Object.fromEntries([...formulario.entries()].filter(([k, v]) => !k.startsWith("$") && typeof v === "string")) as Record<string, string>;

// La base valida saldo, stock, autoría y permisos (triggers + RLS) y lanza mensajes en español:
// se muestran tal cual cuando son conocidos; el resto se traduce a algo genérico.
const MENSAJES_BASE = /Puntos insuficientes|agotada|no está disponible|propio aporte|solo puede validar|no se reabre/;
const traducir = (mensaje: string, generico: string) => {
  if (MENSAJES_BASE.test(mensaje)) return mensaje;
  if (mensaje.includes("row-level security") || mensaje.includes("permission denied")) return "No tienes permiso para hacer esto.";
  if (mensaje.includes("aportes_no_autovalidado")) return "Nadie puede validar su propio aporte.";
  return generico;
};

const refrescar = () => {
  revalidatePath("/formacion", "layout");
  revalidatePath("/", "layout"); // campana y celebraciones viven en el layout
};

async function sesionAprobada() {
  const sesion = await obtenerSesion();
  return sesion && sesion.estadoAcceso === "aprobado" ? sesion : null;
}

// ---------------------------------------------------------------------
// Canjes
// ---------------------------------------------------------------------
export async function solicitarCanje(idRecompensa: string): Promise<Resultado> {
  const sesion = await sesionAprobada();
  if (!sesion) return { error: "Tu sesión no es válida." };
  if (!z.uuid().safeParse(idRecompensa).success) return { error: "Recompensa no válida." };

  const supabase = await crearClienteServidor();
  // El público («Para: …») solo vive en la descripción: la base no lo valida, se hace aquí
  const { data: recompensa } = await supabase.from("recompensas").select("descripcion").eq("id", idRecompensa).maybeSingle();
  if (!recompensa) return { error: "La recompensa no está disponible" };
  if (!esCde(sesion.rol) && !recompensaParaRol(recompensa.descripcion, sesion.rol)) return { error: "Esta recompensa no es para tu rol." };

  const { error } = await supabase.from("canjes").insert({ id_recompensa: idRecompensa, id_usuario: sesion.id });
  if (error) return { error: traducir(error.message, "No pudimos registrar el canje. Inténtalo de nuevo.") };
  refrescar();
  return { aviso: "¡Listo! Tu canje quedó solicitado y el CDE te confirmará la entrega." };
}

const esquemaResolverCanje = z.object({
  id: z.uuid(),
  estado: z.enum(["Entregado", "Rechazado"]),
  comentario: z.string().trim().max(300).optional(),
});

export async function resolverCanje(entrada: z.input<typeof esquemaResolverCanje>): Promise<Resultado> {
  const sesion = await sesionAprobada();
  if (!sesion || !esCde(sesion.rol)) return { error: "Solo el equipo del CDE resuelve canjes." };
  const datos = esquemaResolverCanje.safeParse(entrada);
  if (!datos.success) return { error: "Datos no válidos." };
  const { id, estado, comentario } = datos.data;

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("canjes")
    .update({ estado, comentario: comentario || null })
    .eq("id", id)
    .eq("estado", "Solicitado")
    .select("id");
  if (error) return { error: traducir(error.message, "No se pudo resolver el canje.") };
  if (!data?.length) return { error: "Este canje ya fue resuelto." };
  refrescar();
}

// ---------------------------------------------------------------------
// Aportes: el estudiante propone, el docente del proyecto (o el CDE) valida
// ---------------------------------------------------------------------
const esquemaAporte = z.object({
  id_proyecto: z.uuid({ error: "Elige el proyecto." }),
  id_area: z.uuid({ error: "Elige el área." }),
  descripcion: z.string().trim().min(10, "Describe tu aporte en al menos 10 caracteres.").max(2000),
  evidencia_url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https?:\/\//i.test(v), "El enlace debe empezar por http:// o https://")
    .optional(),
});

export async function registrarAporte(_: Resultado, formulario: FormData): Promise<Resultado> {
  const sesion = await sesionAprobada();
  if (!sesion || sesion.rol !== "estudiante") return { error: "Solo los estudiantes registran aportes." };
  const valores = valoresDe(formulario);
  const datos = esquemaAporte.safeParse(valores);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Datos no válidos.", valores };
  const { evidencia_url, ...resto } = datos.data;

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("aportes")
    .insert({ ...resto, evidencia_url: evidencia_url || null, id_usuario: sesion.id });
  if (error) return { error: traducir(error.message, "No se pudo registrar el aporte."), valores };
  refrescar();
  return { aviso: "Aporte enviado. Tu docente lo revisará y, al validarlo, sumarás puntos." };
}

const esquemaRevision = z.object({
  id: z.uuid(),
  estado: z.enum(["Validado", "Rechazado"]),
  comentario: z.string().trim().max(500).optional(),
});

export async function revisarAporte(entrada: z.input<typeof esquemaRevision>): Promise<Resultado> {
  const sesion = await sesionAprobada();
  if (!sesion || !(esCde(sesion.rol) || sesion.rol === "docente")) return { error: "Solo docentes y el CDE validan aportes." };
  const datos = esquemaRevision.safeParse(entrada);
  if (!datos.success) return { error: "Datos no válidos." };
  const { id, estado, comentario } = datos.data;

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("aportes")
    .update({ estado, comentario_revision: comentario || null })
    .eq("id", id)
    .eq("estado", "Pendiente")
    .select("id_usuario, areas (puntos_por_aporte)")
    .maybeSingle();
  if (error) return { error: traducir(error.message, "No se pudo guardar la revisión.") };
  if (!data) return { error: "Este aporte ya fue revisado o no es de tus proyectos." };
  refrescar();
  return { aviso: estado === "Validado" ? `+${data.areas?.puntos_por_aporte ?? 10} puntos para el estudiante` : "Aporte rechazado" };
}

// ---------------------------------------------------------------------
// Panel del CDE: insignias manuales y ajustes de puntos
// ---------------------------------------------------------------------
const esquemaInsignia = z.object({ id_usuario: z.uuid({ error: "Elige la persona." }), id_insignia: z.uuid({ error: "Elige la insignia." }) });

export async function otorgarInsignia(_: Resultado, formulario: FormData): Promise<Resultado> {
  const sesion = await sesionAprobada();
  if (!sesion || !esCde(sesion.rol)) return { error: "Solo el equipo del CDE otorga insignias." };
  const valores = valoresDe(formulario);
  const datos = esquemaInsignia.safeParse(valores);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Datos no válidos.", valores };

  const supabase = await crearClienteServidor();
  const [insignia, persona] = await Promise.all([
    supabase.from("insignias").select("roles").eq("id", datos.data.id_insignia).eq("criterio", "manual").maybeSingle(),
    supabase.from("perfiles").select("rol").eq("id", datos.data.id_usuario).maybeSingle(),
  ]);
  if (!insignia.data) return { error: "Solo se otorgan a mano las insignias de reconocimiento.", valores };
  if (!persona.data) return { error: "No encontramos a esa persona.", valores };
  if (insignia.data.roles && !insignia.data.roles.includes(persona.data.rol)) return { error: "Esa insignia no es para el rol de esta persona.", valores };

  const { error } = await supabase.from("insignias_usuario").insert(datos.data);
  if (error) {
    if (error.code === "23505" || error.message.includes("duplicate key")) return { error: "Esa persona ya tiene la insignia.", valores };
    return { error: traducir(error.message, "No se pudo otorgar la insignia."), valores };
  }
  refrescar();
  return { aviso: "Insignia otorgada. La persona recibirá un aviso." };
}

const esquemaAjuste = z.object({
  id_usuario: z.uuid({ error: "Elige la persona." }),
  puntos: z.coerce
    .number({ error: "Escribe los puntos." })
    .int("Usa un número entero.")
    .refine((n) => n !== 0 && Math.abs(n) <= 1000, "Entre -1000 y 1000, distinto de 0."),
  motivo: z.string().trim().min(3, "Escribe el motivo.").max(200),
});

export async function ajustarPuntos(_: Resultado, formulario: FormData): Promise<Resultado> {
  const sesion = await sesionAprobada();
  if (!sesion || !esCde(sesion.rol)) return { error: "Solo el equipo del CDE ajusta puntos." };
  const valores = valoresDe(formulario);
  const datos = esquemaAjuste.safeParse(valores);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Datos no válidos.", valores };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("puntos_movimientos").insert({ ...datos.data, origen_tipo: "ajuste" });
  if (error) return { error: traducir(error.message, "No se pudo ajustar los puntos."), valores };
  refrescar();
  return { aviso: `Ajuste registrado (${datos.data.puntos > 0 ? "+" : ""}${datos.data.puntos} puntos).` };
}

// ---------------------------------------------------------------------
// Recorrido del búho completado → la base suma 20 puntos y la insignia Bienvenida (una sola vez)
// ---------------------------------------------------------------------
export async function completarRecorrido(pasos: string[]): Promise<Resultado> {
  const sesion = await sesionAprobada();
  if (!sesion) return;
  const lista = z.array(z.string().max(40)).max(30).safeParse(pasos);
  if (!lista.success) return;

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("progreso_onboarding").upsert(
    {
      id_usuario: sesion.id,
      paso_actual: lista.data.length,
      pasos_completados: lista.data,
      completado_en: new Date().toISOString(),
    },
    { onConflict: "id_usuario" },
  );
  if (error) return { error: "No se pudo guardar tu recorrido." };
  refrescar();
}

/** Las celebraciones ya mostradas se marcan como leídas. */
export async function marcarCelebradas(ids: string[]): Promise<Resultado> {
  const sesion = await sesionAprobada();
  const validos = ids.filter((id) => z.uuid().safeParse(id).success).slice(0, 20);
  if (!sesion || !validos.length) return;
  const supabase = await crearClienteServidor();
  // El CDE puede modificar los avisos de todos (RLS): se limita a los propios
  await supabase.from("notificaciones").update({ leida_en: new Date().toISOString() }).in("id", validos).eq("id_usuario", sesion.id);
  revalidatePath("/", "layout");
}
