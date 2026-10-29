import "server-only";

import { cache } from "react";

import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Puntos del usuario y sus últimos movimientos. El layout los pide varias veces (barra de nivel,
 * celebraciones, puntos flotantes): `cache` hace una sola consulta por petición.
 */
export const obtenerProgreso = cache(async (idUsuario: string) => {
  const supabase = await crearClienteServidor();
  const [resumen, movimientos] = await Promise.all([
    supabase.from("puntos_usuario").select("puntos, saldo").eq("id_usuario", idUsuario).maybeSingle(),
    supabase
      .from("puntos_movimientos")
      .select("id, puntos, motivo")
      .eq("id_usuario", idUsuario) // el CDE puede leer los de todos (RLS): solo los propios
      .order("id", { ascending: false })
      .limit(6),
  ]);
  // Si falla, la gamificación simplemente no se muestra: no debe tumbar la página
  return {
    puntos: resumen.data?.puntos ?? 0,
    saldo: resumen.data?.saldo ?? 0,
    movimientos: movimientos.data ?? [],
  };
});
