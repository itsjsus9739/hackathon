import { Celebracion } from "@/components/gamificacion/celebracion";
import { calcularNivel } from "@/lib/gamificacion";
import { crearClienteServidor } from "@/lib/supabase/server";

/** Datos para la celebración global: insignias sin celebrar y nivel actual del usuario. */
export async function Celebraciones({ idUsuario }: { idUsuario: string }) {
  const supabase = await crearClienteServidor();
  const [avisos, resumen] = await Promise.all([
    supabase
      .from("notificaciones")
      .select("id, cuerpo")
      .eq("id_usuario", idUsuario) // el CDE puede leer los avisos de todos (RLS): solo los propios
      .eq("tipo", "insignia")
      .is("leida_en", null)
      .order("creado_en", { ascending: false })
      .limit(5),
    supabase.from("puntos_usuario").select("puntos").eq("id_usuario", idUsuario).maybeSingle(),
  ]);
  // Si la consulta falla, simplemente no se celebra
  const insignias = (avisos.data ?? []).map((a) => ({ id: a.id, nombre: a.cuerpo ?? "Nueva insignia" }));
  const { actual } = calcularNivel(resumen.data?.puntos ?? 0);

  return <Celebracion idUsuario={idUsuario} insignias={insignias} nivel={{ numero: actual.nivel, nombre: actual.nombre }} />;
}
