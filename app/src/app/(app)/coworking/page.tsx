import type { Metadata } from "next";

import { SalaCoworking } from "@/components/coworking/sala";
import { normalizarAvatar, type MensajeChat } from "@/lib/coworking/tipos";
import { ETIQUETA_ROL, obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { guardarAvatar } from "./actions";

export const metadata: Metadata = { title: "Coworking · CDE Conecta" };

export default async function PaginaCoworking() {
  const sesion = (await obtenerSesion())!; // el layout ya exige sesión aprobada
  const supabase = await crearClienteServidor();
  const [perfil, canal, personas] = await Promise.all([
    supabase.from("perfiles").select("avatar").eq("id", sesion.id).maybeSingle(),
    supabase.from("canales").select("id").eq("tipo", "foro").eq("nombre", "Coworking").maybeSingle(),
    supabase.rpc("directorio"),
  ]);
  if (canal.error || !canal.data) throw new Error("No se encontró el canal de Coworking.");

  const nombres = new Map((personas.data ?? []).map((p) => [p.id, p.nombre]));
  const { data: ultimos } = await supabase
    .from("mensajes")
    .select("id, id_autor, contenido, creado_en")
    .eq("id_canal", canal.data.id)
    .order("creado_en", { ascending: false })
    .limit(50);
  const historial: MensajeChat[] = (ultimos ?? []).reverse().map((m) => ({
    id: m.id,
    idAutor: m.id_autor,
    autor: nombres.get(m.id_autor) ?? "Miembro",
    texto: m.contenido,
    fecha: m.creado_en,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Coworking</h1>
        <p className="text-muted-foreground text-sm">
          Muévete por la sala, escribe en el chat y únete a la voz para hablar con quien esté cerca, como en una oficina de
          verdad.
        </p>
      </div>
      <SalaCoworking
        yo={{ id: sesion.id, nombre: sesion.nombre, rol: ETIQUETA_ROL[sesion.rol] }}
        avatarInicial={normalizarAvatar(perfil.data?.avatar)}
        historial={historial}
        modo={{ tipo: "supabase", idCanal: canal.data.id, nombres: [...nombres] }}
        guardarAvatar={guardarAvatar}
      />
    </div>
  );
}
