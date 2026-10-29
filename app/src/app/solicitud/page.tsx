import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Clock, LogOut, MailCheck, XCircle } from "lucide-react";

import { cerrarSesion } from "@/app/login/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioSolicitud } from "./formulario-solicitud";

export const metadata: Metadata = { title: "Solicitud de acceso · CDE Nest" };

export default async function PaginaSolicitud() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.estadoAcceso === "aprobado") redirect("/");

  const supabase = await crearClienteServidor();
  const { data: solicitud } = await supabase
    .from("solicitudes_acceso")
    .select("estado, rol_solicitado, motivo, comentario_revision, creado_en, revisado_en")
    .eq("id_perfil", sesion.id)
    .maybeSingle();

  const fecha = (iso: string) =>
    new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(new Date(iso));

  let contenido: React.ReactNode;
  if (!solicitud) {
    // Correo @unab.edu.co aún sin confirmar: no hay solicitud, solo falta la confirmación
    contenido = (
      <div className="flex gap-3">
        <MailCheck className="text-primario mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="text-sm">
          Confirma tu correo <b>{sesion.correo}</b> con el enlace que te enviamos y tu acceso se activará automáticamente.
        </p>
      </div>
    );
  } else if (solicitud.estado === "rechazado") {
    contenido = (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <XCircle className="text-destructive size-5" aria-hidden />
          <p className="font-medium">El CDE no aprobó tu solicitud</p>
        </div>
        {solicitud.comentario_revision && (
          <p className="text-muted-foreground text-sm">Motivo: {solicitud.comentario_revision}</p>
        )}
        <p className="text-sm">Si crees que es un error, escribe al CDE (@cdeunab) indicando tu correo.</p>
      </div>
    );
  } else {
    contenido = (
      <div className="space-y-6">
        <div className="flex gap-3">
          <Clock className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
          <p className="text-sm">
            Tu solicitud está <b>en revisión</b> desde el {fecha(solicitud.creado_en)}. Mientras tanto puedes completar tu
            información para que el CDE la apruebe más rápido.
          </p>
        </div>
        <FormularioSolicitud rol={solicitud.rol_solicitado} motivo={solicitud.motivo ?? ""} />
      </div>
    );
  }

  return (
    <main className="bg-[var(--panel)] flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <p className="text-primario text-sm font-semibold">CDE Nest · UNAB</p>
          <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
            Solicitud de acceso
            <Badge variant={solicitud?.estado === "rechazado" ? "destructive" : "secondary"}>
              {solicitud?.estado === "rechazado" ? "Rechazada" : solicitud ? "Pendiente" : "Confirma tu correo"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {sesion.nombre} · {sesion.correo}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {contenido}
          <form action={cerrarSesion} className="border-t pt-4">
            <Button type="submit" variant="ghost" size="sm" className="-ml-2">
              <LogOut aria-hidden /> Cerrar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
