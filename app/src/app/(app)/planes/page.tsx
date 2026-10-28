import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { TarjetaPlan, type PlanVista } from "@/components/planes/tarjeta-plan";
import { buttonVariants } from "@/components/ui/button";
import { esUuid } from "@/lib/empresas";
import { estaVencido, hoyBogota } from "@/lib/planes";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Planes de acción · CDE Conecta" };

type Filtros = { vista?: string; mios?: string; empresa?: string };

const VISTAS = [
  { valor: "activos", etiqueta: "Activos" },
  { valor: "vencidos", etiqueta: "Con vencidos" },
  { valor: "completados", etiqueta: "Completados" },
  { valor: "todos", etiqueta: "Todos" },
] as const;

export default async function PaginaPlanes({ searchParams }: { searchParams: Promise<Filtros> }) {
  const filtros = await searchParams;
  const vista = VISTAS.find((v) => v.valor === filtros.vista)?.valor ?? "activos";
  const soloMios = filtros.mios === "1";
  const empresa = filtros.empresa && esUuid(filtros.empresa) ? filtros.empresa : null;
  const sesion = await obtenerSesion();
  const esCde = sesion?.rol === "cde" || sesion?.rol === "admin_cde";
  const supabase = await crearClienteServidor();

  // RLS: cada quien recibe solo los planes que le corresponden
  let consultaPlanes = supabase.from("avance_planes").select("*").order("fecha_limite", { ascending: true, nullsFirst: false });
  if (empresa) consultaPlanes = consultaPlanes.eq("id_empresa", empresa);
  const [planes, compromisos, ejemplos, editables, directorio] = await Promise.all([
    consultaPlanes,
    supabase
      .from("compromisos")
      .select("id, id_plan, descripcion, id_responsable, fecha_limite, estado, avance")
      .order("fecha_limite", { ascending: true, nullsFirst: false }),
    supabase.from("planes_accion").select("id").eq("es_ejemplo", true),
    supabase.rpc("compromisos_editables"),
    supabase.rpc("directorio"),
  ]);
  for (const r of [planes, compromisos, ejemplos, editables, directorio]) {
    if (r.error) throw new Error(`No se pudieron consultar los planes: ${r.error.message}`);
  }

  const hoy = hoyBogota();
  const nombres = new Map((directorio.data ?? []).map((p) => [p.id, p.nombre]));
  const puedeEditar = new Set(editables.data ?? []);
  const esEjemplo = new Set((ejemplos.data ?? []).map((p) => p.id));

  const todos: (PlanVista & { esMio: boolean })[] = (planes.data ?? [])
    .filter((p) => p.id && p.id_empresa)
    .map((p) => {
      const propios = (compromisos.data ?? []).filter((c) => c.id_plan === p.id);
      return {
        id: p.id!,
        id_empresa: p.id_empresa!,
        empresa: p.empresa ?? "Empresa",
        titulo: p.titulo ?? "Plan de acción",
        area: p.area,
        estado: p.estado ?? "Pendiente",
        fecha_limite: p.fecha_limite,
        responsable: p.responsable,
        avance: p.avance ?? 0,
        // Vencidos con el día de Bogotá (la vista usa la misma regla)
        vencidos: propios.filter((c) => estaVencido(c, hoy)).length,
        es_ejemplo: esEjemplo.has(p.id!),
        esMio: p.id_responsable === sesion?.id || propios.some((c) => c.id_responsable === sesion?.id),
        editableEstado: esCde || p.id_responsable === sesion?.id,
        editablePlan: esCde,
        compromisos: propios.map((c) => ({
          id: c.id,
          descripcion: c.descripcion,
          responsable: c.id_responsable ? (nombres.get(c.id_responsable) ?? null) : null,
          fecha_limite: c.fecha_limite,
          estado: c.estado,
          avance: c.avance,
          editable: esCde || puedeEditar.has(c.id),
        })),
      };
    });

  const visibles = todos
    .filter((p) =>
      vista === "activos"
        ? p.estado === "Pendiente" || p.estado === "En curso"
        : vista === "vencidos"
          ? p.vencidos > 0
          : vista === "completados"
            ? p.estado === "Completado"
            : true,
    )
    .filter((p) => !soloMios || p.esMio)
    // Primero lo urgente: más vencidos, luego menor avance
    .sort((a, b) => b.vencidos - a.vencidos || a.avance - b.avance);

  const abiertos = todos.filter((p) => p.estado === "Pendiente" || p.estado === "En curso");
  const totalCompromisos = abiertos.reduce((s, p) => s + p.compromisos.length, 0);
  const totalVencidos = todos.reduce((s, p) => s + p.vencidos, 0);
  const avancePromedio = abiertos.length ? Math.round(abiertos.reduce((s, p) => s + p.avance, 0) / abiertos.length) : 0;
  const nombreEmpresa = empresa ? todos[0]?.empresa : null;

  const enlace = (cambios: Partial<Filtros>) => {
    const p = new URLSearchParams();
    const final = { vista, mios: soloMios ? "1" : undefined, empresa: empresa ?? undefined, ...cambios };
    for (const [k, v] of Object.entries(final)) if (v) p.set(k, v);
    return `/planes?${p}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Planes de acción</h1>
          <p className="text-muted-foreground text-sm">
            {nombreEmpresa ? (
              <>
                Planes de <b className="text-foreground">{nombreEmpresa}</b> ·{" "}
                <Link href={enlace({ empresa: undefined })} className="underline underline-offset-4">
                  ver todas las empresas
                </Link>
              </>
            ) : (
              "Compromisos con responsable, fecha y avance. Los vencidos se marcan solos."
            )}
          </p>
        </div>
        {esCde && (
          <Link href={empresa ? `/planes/nuevo?empresa=${empresa}` : "/planes/nuevo"} className={buttonVariants()}>
            <Plus aria-hidden /> Nuevo plan
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="Planes activos" valor={abiertos.length} />
        <Indicador etiqueta="Compromisos abiertos" valor={totalCompromisos} />
        <Indicador etiqueta="Avance promedio" valor={`${avancePromedio} %`} />
        <Indicador etiqueta="Compromisos vencidos" valor={totalVencidos} alerta={totalVencidos > 0} />
      </div>

      <nav className="flex flex-wrap items-center gap-2" aria-label="Filtrar planes">
        {VISTAS.map((v) => (
          <Link
            key={v.valor}
            href={enlace({ vista: v.valor })}
            aria-current={vista === v.valor ? "page" : undefined}
            className={cn(buttonVariants({ variant: vista === v.valor ? "default" : "outline", size: "sm" }))}
          >
            {v.etiqueta}
          </Link>
        ))}
        <Link
          href={enlace({ mios: soloMios ? undefined : "1" })}
          aria-pressed={soloMios}
          className={cn(buttonVariants({ variant: soloMios ? "secondary" : "ghost", size: "sm" }), "ml-auto")}
        >
          {soloMios ? "✓ Solo donde soy responsable" : "Solo donde soy responsable"}
        </Link>
      </nav>

      {visibles.length ? (
        <div className="space-y-4">
          {visibles.map((p) => (
            <TarjetaPlan key={p.id} plan={p} hoy={hoy} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          No hay planes en esta vista.
          {esCde && " Crea uno desde la Ficha 360° de una empresa o con «Nuevo plan»."}
        </p>
      )}
    </div>
  );
}

function Indicador({ etiqueta, valor, alerta = false }: { etiqueta: string; valor: number | string; alerta?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", alerta && "border-destructive/40")}>
      <p className="text-muted-foreground text-xs">{etiqueta}</p>
      <p className={cn("text-2xl font-semibold tabular-nums", alerta && "text-destructive")}>{valor}</p>
    </div>
  );
}
