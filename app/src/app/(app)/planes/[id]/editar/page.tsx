import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { esUuid } from "@/lib/empresas";
import { hoyBogota } from "@/lib/planes";
import { ETIQUETA_ROL, obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioPlan } from "../../nuevo/formulario-plan";

export const metadata: Metadata = { title: "Editar plan de acción · CDE Conecta" };

export default async function PaginaEditarPlan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const sesion = await obtenerSesion();
  if (!sesion || !["cde", "admin_cde"].includes(sesion.rol)) {
    return (
      <Alert className="mx-auto max-w-xl">
        <ShieldAlert aria-hidden />
        <AlertTitle>Solo para el equipo del CDE</AlertTitle>
        <AlertDescription>Los responsables, fechas y compromisos de un plan los cambia el CDE.</AlertDescription>
      </Alert>
    );
  }

  const supabase = await crearClienteServidor();
  const [plan, empresas, personas] = await Promise.all([
    supabase
      .from("planes_accion")
      .select(
        "id, id_empresa, id_diagnostico, titulo, objetivo, area, id_responsable, fecha_inicio, fecha_limite, compromisos (id, descripcion, id_responsable, fecha_limite, creado_en)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("empresas").select("id, nombre").order("nombre"),
    supabase.rpc("directorio"),
  ]);
  for (const r of [plan, empresas, personas]) {
    if (r.error) throw new Error(`No se pudo cargar el plan: ${r.error.message}`);
  }
  if (!plan.data) notFound();
  const p = plan.data;
  const compromisos = [...p.compromisos].sort(
    (a, b) => (a.fecha_limite ?? "9999").localeCompare(b.fecha_limite ?? "9999") || a.creado_en.localeCompare(b.creado_en),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/planes?empresa=${p.id_empresa}&vista=todos`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> Planes de la empresa
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Editar plan de acción</CardTitle>
          <CardDescription>
            Cambia responsables, fechas y compromisos. El avance que ya se reportó se conserva; quitar un compromiso lo borra
            del plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioPlan
            empresas={empresas.data ?? []}
            personas={(personas.data ?? []).map((x) => ({ id: x.id, etiqueta: `${x.nombre} · ${ETIQUETA_ROL[x.rol]}` }))}
            inicial={{
              idEmpresa: p.id_empresa,
              idResponsable: p.id_responsable,
              area: p.area,
              idDiagnostico: p.id_diagnostico,
              hoy: hoyBogota(),
            }}
            plan={{
              id: p.id,
              titulo: p.titulo,
              objetivo: p.objetivo,
              area: p.area,
              id_responsable: p.id_responsable,
              fecha_inicio: p.fecha_inicio,
              fecha_limite: p.fecha_limite,
              compromisos,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
