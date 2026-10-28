import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListChecks, Plus } from "lucide-react";

import { CabeceraEmpresa } from "@/components/empresas/cabecera-empresa";
import { DiagnosticoMadurez } from "@/components/empresas/diagnostico-madurez";
import { LineaTiempo } from "@/components/empresas/linea-tiempo";
import { buttonVariants } from "@/components/ui/button";
import { obtenerFicha } from "@/lib/empresas";
import { obtenerSesion } from "@/lib/sesion";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const ficha = await obtenerFicha(id);
  return { title: ficha ? `${ficha.empresa.nombre} · Ficha 360° · CDE Conecta` : "Empresa no encontrada · CDE Conecta" };
}

// Ficha 360°: perfil de la empresa y todo su recorrido con el CDE.
// Los datos se leen con la sesión del usuario, así que RLS decide qué ve cada rol.
export default async function FichaEmpresaPage({ params }: Props) {
  const { id } = await params;
  const [ficha, sesion] = await Promise.all([obtenerFicha(id), obtenerSesion()]);
  if (!ficha) notFound();
  const esCde = sesion?.rol === "cde" || sesion?.rol === "admin_cde";
  const tienePlanes = ficha.hitos.some((h) => h.tipo === "plan_accion");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/empresas" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
          <ArrowLeft className="size-4" aria-hidden /> Empresas
        </Link>
        <div className="flex flex-wrap gap-2">
          {tienePlanes && (
            <Link href={`/planes?empresa=${id}&vista=todos`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ListChecks aria-hidden /> Ver planes de acción
            </Link>
          )}
          {esCde && (
            <Link href={`/planes/nuevo?empresa=${id}`} className={buttonVariants({ size: "sm" })}>
              <Plus aria-hidden /> Nuevo plan de acción
            </Link>
          )}
        </div>
      </div>
      <CabeceraEmpresa empresa={ficha.empresa} hitos={ficha.hitos} postulaciones={ficha.postulaciones} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <LineaTiempo hitos={ficha.hitos} />
        <DiagnosticoMadurez diagnostico={ficha.diagnostico} />
      </div>
    </div>
  );
}
