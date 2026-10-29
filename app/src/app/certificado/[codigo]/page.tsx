import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PantallaBuho } from "@/components/buho/pantalla-buho";
import { Certificado, type DatosCertificado } from "@/components/certificado/certificado";
import { CODIGO_CERTIFICADO, normalizarCodigo, qrVerificacion, urlVerificacion } from "@/lib/certificados";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { BarraCertificado } from "./barra";

export const metadata: Metadata = { title: "Certificado · CDE Nest" };

// Fuera del grupo (app): sin menú, para que el PDF salga limpio. Lo ven su dueño y el CDE (RLS).
export default async function PaginaCertificado({ params }: { params: Promise<{ codigo: string }> }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  const codigo = normalizarCodigo((await params).codigo);

  const supabase = await crearClienteServidor();
  const { data } = CODIGO_CERTIFICADO.test(codigo)
    ? await supabase.from("certificados").select("codigo, datos, emitido_en, anulado_en").eq("codigo", codigo).maybeSingle()
    : { data: null };
  if (!data) {
    return (
      <PantallaBuho
        sprite="acceso-denegado"
        titulo="Certificado no disponible"
        descripcion={<p>No existe un certificado con ese código o no te pertenece.</p>}
        acciones={[{ href: "/formacion", etiqueta: "Ir a Formación y recompensas" }]}
      />
    );
  }

  const url = await urlVerificacion(data.codigo);
  const qr = await qrVerificacion(url);

  return (
    <div className="min-h-screen bg-[#eef6f1] print:bg-white">
      <style>{`@page { size: A4 landscape; margin: 0; } @media print { html, body { background: #fff !important; } .certificado { width: 297mm; height: 210mm; max-width: none; } }`}</style>
      <BarraCertificado anulado={Boolean(data.anulado_en)} />
      <div className="p-4 sm:p-8 print:p-0">
        <Certificado
          datos={data.datos as unknown as DatosCertificado}
          codigo={data.codigo}
          emitidoEn={data.emitido_en}
          qr={qr}
          urlVerificacion={url}
          anulado={Boolean(data.anulado_en)}
        />
      </div>
    </div>
  );
}
