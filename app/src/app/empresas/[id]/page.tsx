import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CabeceraEmpresa } from "@/components/empresas/cabecera-empresa";
import { LineaTiempo } from "@/components/empresas/linea-tiempo";
import { obtenerFicha } from "@/lib/empresas";

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
  const ficha = await obtenerFicha(id);
  if (!ficha) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/empresas" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" aria-hidden /> Empresas
      </Link>
      <CabeceraEmpresa empresa={ficha.empresa} hitos={ficha.hitos} />
      <LineaTiempo hitos={ficha.hitos} />
    </div>
  );
}
