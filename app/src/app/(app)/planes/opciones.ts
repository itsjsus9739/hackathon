import "server-only";

import type { Sesion } from "@/lib/sesion";
import { ETIQUETA_ROL } from "@/lib/roles";
import { crearClienteServidor } from "@/lib/supabase/server";

/** Quién puede crear planes: el CDE y los docentes (RLS lo vuelve a exigir). */
export const puedeCrearPlanes = (rol: Sesion["rol"]) => rol === "cde" || rol === "admin_cde" || rol === "docente";

/**
 * Opciones del formulario de planes. El CDE elige cualquier responsable; el docente queda como responsable
 * y reparte los compromisos entre él y sus estudiantes.
 */
export async function opcionesFormularioPlan(sesion: Sesion) {
  const supabase = await crearClienteServidor();
  const esCde = sesion.rol === "cde" || sesion.rol === "admin_cde";
  const [empresas, directorio, comunidad] = await Promise.all([
    supabase.rpc("empresas_para_planes"),
    esCde ? supabase.rpc("directorio") : Promise.resolve({ data: [], error: null }),
    supabase.rpc("personas_comunidad"),
  ]);
  for (const r of [empresas, directorio, comunidad]) {
    if (r.error) throw new Error(`No se pudo preparar el formulario: ${r.error.message}`);
  }
  const estudiantes = (comunidad.data ?? []).filter((p) => p.rol === "estudiante").map(({ id, nombre }) => ({ id, nombre }));
  const base = esCde ? (directorio.data ?? []) : [{ id: sesion.id, nombre: sesion.nombre, rol: sesion.rol }];
  const vistos = new Set(base.map((p) => p.id));
  const personas = [
    ...base.map((p) => ({ id: p.id, etiqueta: `${p.nombre} · ${ETIQUETA_ROL[p.rol]}` })),
    ...estudiantes.filter((e) => !vistos.has(e.id)).map((e) => ({ id: e.id, etiqueta: `${e.nombre} · Estudiante` })),
  ];
  return { empresas: empresas.data ?? [], personas, estudiantes, responsableFijo: !esCde };
}
