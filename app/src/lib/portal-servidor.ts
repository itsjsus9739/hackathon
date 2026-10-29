import "server-only";

import { esRolCde } from "@/lib/navegacion";
import type { PortalDatos } from "@/lib/portal";
import type { Sesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAXIMO_EXPORTACION = 300;

export type Pedido = { empresas: string[]; todas: boolean; q: string | null };

/** Lee ?empresa=…&empresa=… (o ?todas=1, ?q=… para el CDE) de la URL. */
export function leerPedido(params: URLSearchParams): Pedido {
  const empresas = [...new Set(params.getAll("empresa").flatMap((v) => v.split(",")).filter((v) => UUID.test(v)))];
  return { empresas, todas: params.get("todas") === "1", q: params.get("q")?.trim() || null };
}

export class ErrorExportacion extends Error {
  constructor(
    mensaje: string,
    readonly estado: number,
  ) {
    super(mensaje);
  }
}

/**
 * Datos del portal de una o varias empresas para exportar. El permiso de cada empresa lo valida
 * la base en portal_datos; exportar varias a la vez es solo del equipo del CDE.
 */
export async function cargarPortales(sesion: Sesion, pedido: Pedido): Promise<PortalDatos[]> {
  const cde = esRolCde(sesion.rol);
  const supabase = await crearClienteServidor();
  let ids = pedido.empresas;

  if (pedido.todas || (!ids.length && pedido.q)) {
    if (!cde) throw new ErrorExportacion("Solo el equipo del CDE exporta varias empresas a la vez.", 403);
    if (pedido.q) {
      const { data, error } = await supabase.rpc("portal_empresas", { texto: pedido.q });
      if (error) throw new ErrorExportacion("No se pudo consultar las empresas.", 500);
      ids = (data ?? []).map((e) => e.id);
    } else {
      const { data, error } = await supabase.from("empresas").select("id").order("nombre").limit(MAXIMO_EXPORTACION);
      if (error) throw new ErrorExportacion("No se pudo consultar las empresas.", 500);
      ids = (data ?? []).map((e) => e.id);
    }
  }
  if (!ids.length) throw new ErrorExportacion("Elige al menos una empresa.", 400);
  if (ids.length > 1 && !cde) throw new ErrorExportacion("Solo el equipo del CDE exporta varias empresas a la vez.", 403);
  if (ids.length > MAXIMO_EXPORTACION) throw new ErrorExportacion(`Se exportan como máximo ${MAXIMO_EXPORTACION} empresas a la vez.`, 400);

  // De a 8 consultas en paralelo para no saturar la base
  const resultado: PortalDatos[] = [];
  for (let i = 0; i < ids.length; i += 8) {
    const lote = await Promise.all(ids.slice(i, i + 8).map((empresa) => supabase.rpc("portal_datos", { empresa })));
    for (const r of lote) {
      if (r.error) {
        if (r.error.message.includes("No tienes acceso")) throw new ErrorExportacion("No tienes acceso al portal de una de estas empresas.", 403);
        throw new ErrorExportacion("No se pudieron cargar los datos del portal.", 500);
      }
      resultado.push(r.data as unknown as PortalDatos);
    }
  }
  return resultado.sort((a, b) => a.empresa.nombre.localeCompare(b.empresa.nombre, "es"));
}
