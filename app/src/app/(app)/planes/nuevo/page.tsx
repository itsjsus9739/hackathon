import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { esUuid, mayorBrecha, type Diagnostico } from "@/lib/empresas";
import { hoyBogota } from "@/lib/planes";
import { ETIQUETA_ROL, obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioPlan } from "./formulario-plan";

export const metadata: Metadata = { title: "Nuevo plan de acción · CDE Conecta" };

export default async function PaginaNuevoPlan({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa } = await searchParams;
  const sesion = await obtenerSesion();
  if (!sesion || !["cde", "admin_cde"].includes(sesion.rol)) {
    return (
      <Alert className="mx-auto max-w-xl">
        <ShieldAlert aria-hidden />
        <AlertTitle>Solo para el equipo del CDE</AlertTitle>
        <AlertDescription>Los planes de acción los crea el CDE con la empresa.</AlertDescription>
      </Alert>
    );
  }

  const idEmpresa = empresa && esUuid(empresa) ? empresa : null;
  const supabase = await crearClienteServidor();
  const [empresas, personas, diagnostico] = await Promise.all([
    supabase.from("empresas").select("id, nombre").order("nombre"),
    supabase.rpc("directorio"),
    idEmpresa
      ? supabase
          .from("diagnosticos")
          .select(
            "id, fecha, tipo_iniciativa, estrategia, mercadeo_ventas, financiera, normativa_legal, productividad, transformacion_digital, promedio, nivel",
          )
          .eq("id_empresa", idEmpresa)
          .order("fecha", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  for (const r of [empresas, personas, diagnostico]) {
    if (r.error) throw new Error(`No se pudo preparar el formulario: ${r.error.message}`);
  }

  const diag = diagnostico.data as (Diagnostico & { id: string }) | null;
  const brecha = diag ? mayorBrecha(diag) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={idEmpresa ? `/empresas/${idEmpresa}` : "/planes"}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {idEmpresa ? "Ficha de la empresa" : "Planes de acción"}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Nuevo plan de acción</CardTitle>
          <CardDescription>
            {brecha
              ? `Sugerido a partir del diagnóstico: la mayor brecha es ${brecha.nombre}. Puedes cambiar todo.`
              : "Define el objetivo, el responsable y los compromisos con su fecha."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioPlan
            empresas={empresas.data ?? []}
            personas={(personas.data ?? []).map((p) => ({ id: p.id, etiqueta: `${p.nombre} · ${ETIQUETA_ROL[p.rol]}` }))}
            inicial={{
              idEmpresa,
              idResponsable: sesion.id,
              area: brecha?.campo ?? null,
              idDiagnostico: diag?.id ?? null,
              hoy: hoyBogota(),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
