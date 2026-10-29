import { Celebracion } from "@/components/gamificacion/celebracion";
import { PuntosFlotantes } from "@/components/gamificacion/puntos-flotantes";
import { calcularNivel } from "@/lib/gamificacion";
import { obtenerProgreso } from "@/lib/progreso";
import { crearClienteServidor } from "@/lib/supabase/server";

/** Datos para la celebración global: insignias sin celebrar, nivel actual y puntos recién ganados. */
export async function Celebraciones({ idUsuario }: { idUsuario: string }) {
  const supabase = await crearClienteServidor();
  const [avisos, progreso] = await Promise.all([
    supabase
      .from("notificaciones")
      .select("id, cuerpo")
      .eq("id_usuario", idUsuario) // el CDE puede leer los avisos de todos (RLS): solo los propios
      .eq("tipo", "insignia")
      .is("leida_en", null)
      .order("creado_en", { ascending: false })
      .limit(5),
    obtenerProgreso(idUsuario),
  ]);
  // Si la consulta falla, simplemente no se celebra
  const insignias = (avisos.data ?? []).map((a) => ({ id: a.id, nombre: a.cuerpo ?? "Nueva insignia" }));
  const { actual } = calcularNivel(progreso.puntos);

  return (
    <>
      <PuntosFlotantes idUsuario={idUsuario} movimientos={progreso.movimientos} />
      <Celebracion idUsuario={idUsuario} insignias={insignias} nivel={{ numero: actual.nivel, nombre: actual.nombre }} />
    </>
  );
}
