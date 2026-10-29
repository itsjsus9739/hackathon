"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Building2, Check, CheckCheck, GraduationCap, Loader2, Trash2, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  borrarNotificacion,
  marcarLeida,
  marcarTodasLeidas,
  resolverRegistroDocente,
  resolverSolicitud,
  resolverSolicitudEmpresa,
  type Resultado,
} from "./actions";

export type NotificacionVista = {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  enlace: string | null;
  leida_en: string | null;
  /** Fecha ya formateada en el servidor (el formato de Intl varía entre Node y el navegador) */
  fecha: string;
  /** Persona a la que se refiere (registro como docente o solicitud de acceso), con su estado actual */
  docente: { idPerfil: string; rol: string | null; estadoAcceso: string | null; solicitud: string | null } | null;
  /** Registro de una empresa por un emprendedor, con su estado actual */
  empresa: { solicitud: string; estado: string | null } | null;
};

export function ListaNotificaciones({ notificaciones, esAdmin }: { notificaciones: NotificacionVista[]; esAdmin: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const sinLeer = notificaciones.filter((n) => !n.leida_en).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">{sinLeer ? `${sinLeer} sin leer` : "Todo al día"}</p>
        {sinLeer > 0 && (
          <Button variant="outline" size="sm" disabled={pendiente} onClick={() => iniciar(async () => void (await marcarTodasLeidas()))}>
            <CheckCheck aria-hidden /> Marcar todas como leídas
          </Button>
        )}
      </div>
      <ul className="space-y-2">
        {notificaciones.map((n) => (
          <Notificacion key={n.id} n={n} esAdmin={esAdmin} />
        ))}
      </ul>
    </div>
  );
}

function Notificacion({ n, esAdmin }: { n: NotificacionVista; esAdmin: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ejecutar = (accion: () => Promise<Resultado>) =>
    iniciar(async () => {
      setError(null);
      const r = await accion();
      if (r?.error) setError(r.error);
    });

  return (
    <li className={cn("rounded-lg border p-4", !n.leida_en && "border-primario/30 bg-primario/[0.03]")}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.leida_en ? "bg-transparent" : "bg-primario")} aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {n.tipo === "registro_docente" && <GraduationCap className="size-4" aria-hidden />}
            {n.tipo === "solicitud_acceso" && <UserPlus className="size-4" aria-hidden />}
            {n.tipo === "solicitud_empresa" && <Building2 className="size-4" aria-hidden />}
            {n.titulo}
            {!n.leida_en && <span className="sr-only">(sin leer)</span>}
          </p>
          {n.cuerpo && <p className="text-muted-foreground text-sm">{n.cuerpo}</p>}
          <p className="text-muted-foreground text-xs">{n.fecha}</p>

          {n.docente && n.tipo === "registro_docente" && <AccionesDocente n={n} esAdmin={esAdmin} ejecutar={ejecutar} pendiente={pendiente} />}
          {n.docente && n.tipo === "solicitud_acceso" && <AccionesSolicitud n={n} ejecutar={ejecutar} pendiente={pendiente} />}
          {n.empresa && <AccionesEmpresa n={n} esAdmin={esAdmin} ejecutar={ejecutar} pendiente={pendiente} />}
          {n.enlace && (
            <Link href={n.enlace} className="text-sm font-medium underline underline-offset-4" onClick={() => !n.leida_en && void marcarLeida(n.id)}>
              Ver
            </Link>
          )}
          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {pendiente && <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />}
          {!n.leida_en && (
            <Button variant="ghost" size="icon" aria-label="Marcar como leída" disabled={pendiente} onClick={() => ejecutar(() => marcarLeida(n.id))}>
              <Check aria-hidden />
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Borrar notificación" disabled={pendiente} onClick={() => ejecutar(() => borrarNotificacion(n.id))}>
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
    </li>
  );
}

function AccionesDocente({
  n,
  esAdmin,
  ejecutar,
  pendiente,
}: {
  n: NotificacionVista;
  esAdmin: boolean;
  ejecutar: (a: () => Promise<Resultado>) => void;
  pendiente: boolean;
}) {
  const d = n.docente!;
  const base = { idNotificacion: n.id, idPerfil: d.idPerfil };

  // Estado actual de la persona: así se ve si otro miembro del CDE ya lo resolvió
  const estado =
    d.rol === null
      ? "La cuenta ya no existe."
      : d.rol !== "docente"
        ? `Ahora tiene el rol ${d.rol}.`
        : d.solicitud === "pendiente"
          ? "Solicitud pendiente de aprobación."
          : d.solicitud === "rechazado" || d.estadoAcceso === "rechazado"
            ? "Solicitud rechazada."
            : "Tiene acceso como docente.";

  return (
    <div className="space-y-2 pt-1">
      <Badge variant="outline">{estado}</Badge>
      {d.rol === "docente" && (
        <div className="flex flex-wrap gap-2">
          {d.solicitud === "pendiente" ? (
            <>
              <Button size="sm" disabled={pendiente} onClick={() => ejecutar(() => resolverRegistroDocente({ ...base, accion: "aprobar" }))}>
                Aprobar como docente
              </Button>
              <Button size="sm" variant="outline" disabled={pendiente} onClick={() => ejecutar(() => resolverRegistroDocente({ ...base, accion: "rechazar" }))}>
                Rechazar
              </Button>
            </>
          ) : (
            !n.leida_en && (
              <Button size="sm" disabled={pendiente} onClick={() => ejecutar(() => resolverRegistroDocente({ ...base, accion: "confirmar" }))}>
                <Check aria-hidden /> Confirmar docente
              </Button>
            )
          )}
          {esAdmin && d.solicitud !== "pendiente" && (
            <>
              <Button size="sm" variant="outline" disabled={pendiente} onClick={() => ejecutar(() => resolverRegistroDocente({ ...base, accion: "cambiar_rol", rol: "estudiante" }))}>
                No es docente: dejar como estudiante
              </Button>
              <Button size="sm" variant="ghost" disabled={pendiente} onClick={() => ejecutar(() => resolverRegistroDocente({ ...base, accion: "cambiar_rol", rol: "emprendedor" }))}>
                Dejar como emprendedor
              </Button>
            </>
          )}
        </div>
      )}
      {!esAdmin && d.rol === "docente" && d.solicitud !== "pendiente" && (
        <p className="text-muted-foreground text-xs">Si no es docente, un administrador del CDE puede cambiar su rol.</p>
      )}
    </div>
  );
}

/** Solicitud de acceso con correo externo: el CDE la aprueba o la rechaza aquí mismo. */
function AccionesSolicitud({
  n,
  ejecutar,
  pendiente,
}: {
  n: NotificacionVista;
  ejecutar: (a: () => Promise<Resultado>) => void;
  pendiente: boolean;
}) {
  const d = n.docente!;
  const base = { idNotificacion: n.id, idPerfil: d.idPerfil };
  const estado =
    d.rol === null
      ? "La cuenta ya no existe."
      : d.solicitud === "pendiente"
        ? "Pendiente de revisión."
        : d.solicitud === "aprobado" || d.estadoAcceso === "aprobado"
          ? "Aprobada: ya tiene acceso."
          : "Rechazada.";

  return (
    <div className="space-y-2 pt-1">
      <Badge variant="outline">{estado}</Badge>
      {d.solicitud === "pendiente" && d.rol !== null && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pendiente} onClick={() => ejecutar(() => resolverSolicitud({ ...base, accion: "aprobar" }))}>
            <Check aria-hidden /> Aprobar acceso
          </Button>
          <Button size="sm" variant="outline" disabled={pendiente} onClick={() => ejecutar(() => resolverSolicitud({ ...base, accion: "rechazar" }))}>
            Rechazar
          </Button>
        </div>
      )}
    </div>
  );
}

function AccionesEmpresa({
  n,
  esAdmin,
  ejecutar,
  pendiente,
}: {
  n: NotificacionVista;
  esAdmin: boolean;
  ejecutar: (a: () => Promise<Resultado>) => void;
  pendiente: boolean;
}) {
  const [comentario, setComentario] = useState("");
  const e = n.empresa!;
  const estado =
    e.estado === "pendiente" ? "Por confirmar." : e.estado === "aprobada" ? "Confirmada: ya está vinculada." : e.estado === "rechazada" ? "No aprobada." : "La solicitud ya no existe.";

  return (
    <div className="space-y-2 pt-1">
      <Badge variant="outline">{estado}</Badge>
      {e.estado === "pendiente" && esAdmin && (
        <>
          <Input
            value={comentario}
            onChange={(ev) => setComentario(ev.target.value)}
            maxLength={1000}
            placeholder="Comentario para el emprendedor (opcional)"
            aria-label="Comentario de la revisión"
            className="h-8 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pendiente} onClick={() => ejecutar(() => resolverSolicitudEmpresa({ solicitud: e.solicitud, aprobar: true, comentario }))}>
              <Check aria-hidden /> Confirmar empresa
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pendiente}
              onClick={() => ejecutar(() => resolverSolicitudEmpresa({ solicitud: e.solicitud, aprobar: false, comentario }))}
            >
              Rechazar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
