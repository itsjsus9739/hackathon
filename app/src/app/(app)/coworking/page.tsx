import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SalaCoworking } from "@/components/coworking/sala";
import { normalizarAvatar, ultimoReinicioChat, type MensajeChat } from "@/lib/coworking/tipos";
import { esUuid } from "@/lib/empresas";
import { ETIQUETA_ROL, obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { guardarAvatar } from "./actions";
import { Vestibulo, type SalaLista } from "./vestibulo";

export const metadata: Metadata = { title: "Coworking · CDE Nest" };

export default async function PaginaCoworking({ searchParams }: { searchParams: Promise<{ sala?: string }> }) {
  const { sala: salaPedida } = await searchParams;
  const sesion = (await obtenerSesion())!; // el layout ya exige sesión aprobada
  const esCde = sesion.rol === "cde" || sesion.rol === "admin_cde";
  const supabase = await crearClienteServidor();
  const [salas, personas] = await Promise.all([
    supabase.from("salas_coworking_lista").select("id, nombre, creada_por, tiene_clave, soy_miembro, miembros").order("creado_en", { ascending: false }),
    supabase.rpc("directorio"),
  ]);
  const nombres = new Map((personas.data ?? []).map((p) => [p.id, p.nombre]));
  const lista: SalaLista[] = (salas.data ?? [])
    .filter((s) => s.id && s.nombre)
    .map((s) => ({
      id: s.id!,
      nombre: s.nombre!,
      tieneClave: Boolean(s.tiene_clave),
      soyMiembro: Boolean(s.soy_miembro),
      miembros: s.miembros ?? 0,
      creador: (s.creada_por && nombres.get(s.creada_por)) || "un miembro",
      puedoBorrar: esCde || s.creada_por === sesion.id,
    }));

  const encabezado = (
    <div>
      <h1 className="text-2xl font-semibold">Coworking</h1>
      <p className="text-muted-foreground text-sm">
        Entra a una sala, muévete, escribe en el chat y únete a la voz para hablar con quien esté cerca.
      </p>
    </div>
  );

  // Sin sala elegida (o sin permiso para la pedida): vestíbulo con la lista de salas
  const sala = salaPedida === "principal" ? null : lista.find((s) => s.id === salaPedida);
  const puedeEntrar = salaPedida === "principal" || Boolean(sala?.soyMiembro);
  if (!salaPedida || !puedeEntrar || (salaPedida !== "principal" && !esUuid(salaPedida))) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        {encabezado}
        <Vestibulo salas={lista} error={salaPedida && !puedeEntrar ? "Para entrar a esa sala necesitas su contraseña." : undefined} />
      </div>
    );
  }

  const [perfil, canal] = await Promise.all([
    supabase.from("perfiles").select("avatar").eq("id", sesion.id).maybeSingle(),
    salaPedida === "principal"
      ? supabase.from("canales").select("id").eq("tipo", "foro").eq("nombre", "Coworking").maybeSingle()
      : supabase.from("canales").select("id").eq("id_sala", salaPedida).maybeSingle(),
  ]);
  if (canal.error || !canal.data) throw new Error("No se encontró el chat de la sala.");
  const { data: ultimos } = await supabase
    .from("mensajes")
    .select("id, id_autor, contenido, creado_en")
    .eq("id_canal", canal.data.id)
    .gte("creado_en", ultimoReinicioChat().toISOString()) // el chat se reinicia cada día a las 4:00 a. m.
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
      <Link href="/coworking" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" aria-hidden /> Salas
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{sala?.nombre ?? "Sala principal"}</h1>
        <p className="text-muted-foreground text-sm">Camina, siéntate en un escritorio y acércate a alguien para hablar por voz.</p>
      </div>
      <SalaCoworking
        key={salaPedida}
        sala={salaPedida}
        yo={{ id: sesion.id, nombre: sesion.nombre, rol: ETIQUETA_ROL[sesion.rol] }}
        avatarInicial={normalizarAvatar(perfil.data?.avatar)}
        historial={historial}
        modo={{ tipo: "supabase", idCanal: canal.data.id, nombres: [...nombres] }}
        guardarAvatar={guardarAvatar}
      />
    </div>
  );
}
