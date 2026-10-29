import { NextResponse, type NextRequest } from "next/server";

import { bufferLibro, libroPortal, nombreArchivo } from "@/lib/exportar-portal";
import { cargarPortales, ErrorExportacion, leerPedido } from "@/lib/portal-servidor";
import { obtenerSesion } from "@/lib/sesion";

// Exportar varias empresas puede tomar varias consultas
export const maxDuration = 60;

/** Excel del portal: /portal/exportar?empresa=<id>[&empresa=<id>…] · CDE: &todas=1 o &q=<búsqueda> */
export async function GET(request: NextRequest) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.estadoAcceso !== "aprobado") return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  try {
    const lista = await cargarPortales(sesion, leerPedido(request.nextUrl.searchParams));
    const ahora = new Date();
    const archivo = bufferLibro(libroPortal(lista, { generadoPor: sesion.nombre, generadoEn: ahora }));
    const nombre = nombreArchivo(lista, ahora, "xlsx");
    return new NextResponse(new Uint8Array(archivo), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombre.normalize("NFD").replace(/[^\x20-\x7e]/g, "")}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof ErrorExportacion) return NextResponse.json({ error: e.message }, { status: e.estado });
    throw e;
  }
}
