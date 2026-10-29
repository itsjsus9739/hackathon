import type { Metadata } from "next";
import Image from "next/image";

import { PantallaBuho } from "@/components/buho/pantalla-buho";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { esCde } from "@/lib/gamificacion";
import { ETIQUETA_ROL, ORDEN_ROL } from "@/lib/roles";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioAjuste, FormularioInsignia, ResolverCanje } from "./controles";

export const metadata: Metadata = { title: "Gestión de recompensas · CDE Nest" };

const FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

export default async function PaginaGestion() {
  const sesion = await obtenerSesion();
  if (!sesion || !esCde(sesion.rol)) {
    return (
      <PantallaBuho
        sprite="acceso-denegado"
        titulo="Solo para el equipo del CDE"
        descripcion={<p>Aquí el CDE entrega canjes, otorga insignias y ajusta puntos.</p>}
        acciones={[{ href: "/formacion", etiqueta: "Volver a mis logros" }]}
      />
    );
  }
  const supabase = await crearClienteServidor();

  const [canjes, manuales, directorio] = await Promise.all([
    supabase
      .from("canjes")
      .select("id, puntos, creado_en, id_usuario, recompensas (nombre, stock)")
      .eq("estado", "Solicitado")
      .order("creado_en"),
    supabase.from("insignias").select("id, nombre").eq("criterio", "manual").eq("activa", true).order("nombre"),
    supabase.rpc("directorio"),
  ]);
  for (const r of [canjes, manuales, directorio]) if (r.error) throw new Error(`No se pudo cargar la gestión: ${r.error.message}`);

  const personasDir = directorio.data ?? [];
  const nombres = new Map(personasDir.map((p) => [p.id, p]));
  const personas = [...personasDir]
    .sort((a, b) => ORDEN_ROL.indexOf(a.rol) - ORDEN_ROL.indexOf(b.rol) || a.nombre.localeCompare(b.nombre, "es"))
    .map((p) => ({ id: p.id, etiqueta: `${p.nombre} · ${ETIQUETA_ROL[p.rol]}` }));

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--tinta)]">Canjes por entregar</h2>
          <p className="text-muted-foreground text-sm">Al rechazar un canje, la base devuelve los puntos y avisa a la persona.</p>
        </div>
        {canjes.data?.length ? (
          <ul className="space-y-2">
            {canjes.data.map((c) => {
              const persona = nombres.get(c.id_usuario);
              return (
                <li key={c.id} className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[1fr_20rem] sm:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <Image src="/buho/buho-canjear-premio.png" alt="" width={397} height={382} className="hidden h-auto w-12 sm:block" />
                    <div className="min-w-0">
                      <p className="font-semibold">{c.recompensas?.nombre ?? "Recompensa"}</p>
                      <p className="text-muted-foreground text-sm">
                        {persona ? `${persona.nombre} · ${ETIQUETA_ROL[persona.rol]}` : "Persona"} · {c.puntos} pts · {FECHA.format(new Date(c.creado_en))}
                      </p>
                    </div>
                  </div>
                  <ResolverCanje id={c.id} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">No hay canjes pendientes.</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Otorgar una insignia</CardTitle>
            <CardDescription>Insignias de reconocimiento que no se ganan solas (por ejemplo, Capacitado o Mentor destacado).</CardDescription>
          </CardHeader>
          <CardContent>
            {manuales.data?.length ? (
              <FormularioInsignia personas={personas} insignias={manuales.data} />
            ) : (
              <p className="text-muted-foreground text-sm">No hay insignias manuales activas. Aplica la migración 0025.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ajustar puntos</CardTitle>
            <CardDescription>Suma o resta puntos a mano. Queda en el historial de la persona con el motivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormularioAjuste personas={personas} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
