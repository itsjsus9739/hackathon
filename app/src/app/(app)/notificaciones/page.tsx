import type { Metadata } from "next";
import { BellOff } from "lucide-react";

import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ListaNotificaciones, type NotificacionVista } from "./lista";

export const metadata: Metadata = { title: "Notificaciones · CDE Conecta" };

export default async function PaginaNotificaciones() {
  const sesion = await obtenerSesion();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("notificaciones")
    .select("id, tipo, titulo, cuerpo, enlace, leida_en, creado_en, id_referencia")
    .order("creado_en", { ascending: false })
    .limit(50);
  if (error) throw new Error(`No se pudieron consultar las notificaciones: ${error.message}`);

  // Estado actual de las personas que se registraron como docentes (para saber si ya se resolvió)
  const conPersona = (t: string) => t === "registro_docente" || t === "solicitud_acceso";
  const ids = [...new Set((data ?? []).filter((n) => conPersona(n.tipo) && n.id_referencia).map((n) => n.id_referencia!))];
  const [perfiles, solicitudes] = ids.length
    ? await Promise.all([
        supabase.from("perfiles").select("id, nombre, rol, estado_acceso").in("id", ids),
        supabase.from("solicitudes_acceso").select("id_perfil, estado").in("id_perfil", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const perfilPor = new Map((perfiles.data ?? []).map((p) => [p.id, p]));
  const solicitudPor = new Map((solicitudes.data ?? []).map((s) => [s.id_perfil, s.estado]));

  const formato = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
  const notificaciones: NotificacionVista[] = (data ?? []).map(({ creado_en, id_referencia, ...n }) => {
    const perfil = id_referencia ? perfilPor.get(id_referencia) : undefined;
    return {
      ...n,
      fecha: formato.format(new Date(creado_en)),
      docente:
        conPersona(n.tipo) && id_referencia
          ? {
              idPerfil: id_referencia,
              rol: perfil?.rol ?? null,
              estadoAcceso: perfil?.estado_acceso ?? null,
              solicitud: solicitudPor.get(id_referencia) ?? null,
            }
          : null,
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notificaciones</h1>
        <p className="text-muted-foreground text-sm">
          Solicitudes de acceso, avances de proyectos y planes, invitaciones, insignias y avisos del CDE.
        </p>
      </div>
      {notificaciones.length ? (
        <ListaNotificaciones notificaciones={notificaciones} esAdmin={sesion?.rol === "admin_cde"} />
      ) : (
        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center text-sm">
          <BellOff className="size-6" aria-hidden />
          No tienes notificaciones todavía.
        </div>
      )}
    </div>
  );
}
