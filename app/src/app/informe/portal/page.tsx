import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PantallaBuho } from "@/components/buho/pantalla-buho";
import { InformePortal } from "@/components/portal/informe-portal";
import { cargarPortales, ErrorExportacion, leerPedido } from "@/lib/portal-servidor";
import { obtenerSesion } from "@/lib/sesion";
import { BarraInforme } from "./barra";

export const metadata: Metadata = { title: "Informe del portal · CDE Nest" };
export const maxDuration = 60;

// Fuera del grupo (app): sin menú ni barras, para que el PDF salga limpio. La sesión y el
// permiso se validan aquí y en la base (portal_datos), igual que en el portal.
export default async function PaginaInforme({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.estadoAcceso !== "aprobado") redirect("/solicitud");

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) for (const x of [v].flat()) if (x) params.append(k, x);

  let lista;
  try {
    lista = await cargarPortales(sesion, leerPedido(params));
  } catch (e) {
    if (!(e instanceof ErrorExportacion)) throw e;
    return (
      <PantallaBuho
        sprite="acceso-denegado"
        titulo="No se pudo generar el informe"
        descripcion={<p>{e.message}</p>}
        acciones={[{ href: "/portal", etiqueta: "Volver al portal" }]}
      />
    );
  }
  const ahora = new Date();

  return (
    <div className="min-h-screen bg-[#eef6f1] print:bg-white">
      {/* A4 con márgenes; cada empresa empieza en una página nueva */}
      <style>{`@page { size: A4; margin: 14mm 12mm; } @media print { html, body { background: #fff !important; } .informe + .informe { break-before: page; } }`}</style>
      <BarraInforme cantidad={lista.length} />
      <div className="space-y-6 py-6 print:space-y-0 print:py-0">
        {lista.map((datos) => (
          <InformePortal key={datos.empresa.id} datos={datos} generadoPor={sesion.nombre} generadoEn={ahora} />
        ))}
      </div>
    </div>
  );
}
