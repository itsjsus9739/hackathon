import type { Metadata } from "next";
import Image from "next/image";
import { ExternalLink } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { esCde } from "@/lib/gamificacion";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { FormularioAporte, RevisionAporte } from "./formularios";

export const metadata: Metadata = { title: "Aportes · CDE Conecta" };

const FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" });
const ESTADO: Record<string, string> = {
  Pendiente: "bg-amber-100 text-amber-900",
  Validado: "bg-emerald-100 text-emerald-800",
  Rechazado: "bg-red-100 text-red-800",
};

const CAMPOS = "id, descripcion, evidencia_url, estado, comentario_revision, creado_en, id_usuario, proyectos_aula (nombre), areas (nombre, puntos_por_aporte)";

export default async function PaginaAportes() {
  const sesion = await obtenerSesion();
  if (!sesion) return null;
  const revisa = esCde(sesion.rol) || sesion.rol === "docente";
  if (!revisa && sesion.rol !== "estudiante") {
    return <p className="text-muted-foreground text-sm">Los aportes son de los proyectos de aula: los registran los estudiantes y los validan sus docentes.</p>;
  }
  const supabase = await crearClienteServidor();

  if (!revisa) {
    // Estudiante: sus proyectos (RLS), las áreas y sus aportes
    const [proyectos, areas, mios] = await Promise.all([
      supabase.from("proyectos_aula").select("id, nombre").order("nombre"),
      supabase.from("areas").select("id, nombre, puntos_por_aporte").eq("activa", true).order("nombre"),
      supabase.from("aportes").select(CAMPOS).eq("id_usuario", sesion.id).order("creado_en", { ascending: false }).limit(30),
    ]);
    for (const r of [proyectos, areas, mios]) if (r.error) throw new Error(`No se pudieron cargar los aportes: ${r.error.message}`);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <Image src="/buho/buho-lista-verificacion.png" alt="" width={397} height={382} className="hidden h-auto w-20 sm:block" />
            <div>
              <CardTitle>Registrar un aporte</CardTitle>
              <CardDescription>Cuéntale a tu docente qué hiciste en el proyecto. Cuando lo valide, ganas puntos e insignias del área.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {proyectos.data?.length ? (
              <FormularioAporte
                proyectos={proyectos.data}
                areas={(areas.data ?? []).map((a) => ({ id: a.id, nombre: a.nombre, puntos: a.puntos_por_aporte }))}
              />
            ) : (
              <p className="text-muted-foreground text-sm">Aún no estás en un proyecto de aula. Cuando tu docente te asigne a uno, podrás registrar aportes.</p>
            )}
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--tinta)]">Mis aportes</h2>
          {mios.data?.length ? (
            <ul className="space-y-2">
              {mios.data.map((a) => (
                <TarjetaAporte key={a.id} aporte={a} />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">Todavía no has registrado aportes.</p>
          )}
        </section>
      </div>
    );
  }

  // Docente (sus proyectos) o CDE (todos): pendientes de otros y los últimos revisados
  const [pendientes, revisados, directorio] = await Promise.all([
    supabase.from("aportes").select(CAMPOS).eq("estado", "Pendiente").neq("id_usuario", sesion.id).order("creado_en").limit(50),
    supabase.from("aportes").select(CAMPOS).neq("estado", "Pendiente").order("validado_en", { ascending: false }).limit(10),
    supabase.rpc("directorio"),
  ]);
  for (const r of [pendientes, revisados, directorio]) if (r.error) throw new Error(`No se pudieron cargar los aportes: ${r.error.message}`);
  const nombres = new Map((directorio.data ?? []).map((p) => [p.id, p.nombre]));

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--tinta)]">Por validar</h2>
          <p className="text-muted-foreground text-sm">
            {esCde(sesion.rol) ? "Aportes de todos los proyectos de aula." : "Aportes de los estudiantes de tus proyectos."} Al validar, la base suma los puntos y
            avisa al estudiante.
          </p>
        </div>
        {pendientes.data?.length ? (
          <ul className="space-y-2">
            {pendientes.data.map((a) => (
              <TarjetaAporte key={a.id} aporte={a} autor={nombres.get(a.id_usuario)}>
                <RevisionAporte id={a.id} puntos={a.areas?.puntos_por_aporte ?? 10} />
              </TarjetaAporte>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed p-6 text-center">
            <Image src="/buho/buho-guardado.png" alt="" width={397} height={382} className="h-auto w-24" />
            <p className="text-muted-foreground mt-2 text-sm">¡Todo al día! No hay aportes pendientes.</p>
          </div>
        )}
      </section>

      {!!revisados.data?.length && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--tinta)]">Revisados recientemente</h2>
          <ul className="space-y-2">
            {revisados.data.map((a) => (
              <TarjetaAporte key={a.id} aporte={a} autor={nombres.get(a.id_usuario)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type Aporte = {
  id: string;
  descripcion: string;
  evidencia_url: string | null;
  estado: string;
  comentario_revision: string | null;
  creado_en: string;
  proyectos_aula: { nombre: string } | null;
  areas: { nombre: string; puntos_por_aporte: number } | null;
};

function TarjetaAporte({ aporte: a, autor, children }: { aporte: Aporte; autor?: string; children?: React.ReactNode }) {
  return (
    <li className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="min-w-0 space-y-1">
        <p className="text-muted-foreground text-xs">
          {autor && <b className="text-foreground">{autor} · </b>}
          {a.proyectos_aula?.nombre ?? "Proyecto"} · {a.areas?.nombre ?? "Área"} · {FECHA.format(new Date(a.creado_en))}
        </p>
        <p className="text-sm text-pretty">{a.descripcion}</p>
        {a.evidencia_url && (
          <a
            href={a.evidencia_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primario-texto)] underline underline-offset-4"
          >
            Ver evidencia <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
        {a.comentario_revision && <p className="text-muted-foreground text-xs italic">«{a.comentario_revision}»</p>}
      </div>
      <div className="space-y-2 sm:w-72 sm:text-right">
        {!children && (
          <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-semibold", ESTADO[a.estado])}>
            {a.estado}
            {a.estado === "Validado" && a.areas && ` · +${a.areas.puntos_por_aporte}`}
          </span>
        )}
        {children}
      </div>
    </li>
  );
}
