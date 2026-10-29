import type { Metadata } from "next";
import { BellOff } from "lucide-react";

import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ListaNotificaciones, type NotificacionVista } from "./lista";

export const metadata: Metadata = { title: "Notificaciones · CDE Nest" };

export default async function PaginaNotificaciones() {
  const sesion = await obtenerSesion();
  if (!sesion) return null; // el layout ya redirige a /login
  const supabase = await crearClienteServidor();
  // Solo las propias: RLS deja al CDE leer las de todos
  const { data, error } = await supabase
    .from("notificaciones")
    .select("id, tipo, titulo, cuerpo, enlace, leida_en, creado_en, id_referencia")
    .eq("id_usuario", sesion.id)
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
  // Solicitudes de empresa de los emprendedores (el CDE las lee; el admin las resuelve)
  const idsEmpresa = [...new Set((data ?? []).filter((n) => n.tipo === "solicitud_empresa" && n.id_referencia).map((n) => n.id_referencia!))];
  const { data: solicitudesEmpresa } = idsEmpresa.length
    ? await supabase.from("solicitudes_empresa").select("id, estado, id_empresa_existente").in("id", idsEmpresa)
    : { data: [] };
  const solicitudEmpresaPor = new Map((solicitudesEmpresa ?? []).map((s) => [s.id, s]));
  const solicitudPor = new Map((solicitudes.data ?? []).map((s) => [s.id_perfil, s.estado]));

  const formato = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
  const notificaciones: NotificacionVista[] = (data ?? []).map(({ creado_en, id_referencia, ...n }) => {
    const perfil = id_referencia ? perfilPor.get(id_referencia) : undefined;
    return {
      ...n,
      fecha: formato.format(new Date(creado_en)),
      empresa:
        n.tipo === "solicitud_empresa" && id_referencia && solicitudEmpresaPor.has(id_referencia)
          ? {
              idSolicitud: id_referencia,
              estado: solicitudEmpresaPor.get(id_referencia)!.estado,
              existente: Boolean(solicitudEmpresaPor.get(id_referencia)!.id_empresa_existente),
            }
          : null,
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
