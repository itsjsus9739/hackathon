import { NextResponse } from "next/server";

import { ultimoReinicioChat } from "@/lib/coworking/tipos";
import { crearClienteServicio } from "@/lib/supabase/server";

// Reinicio diario del chat del coworking (Vercel Cron, 4:00 a. m. de Colombia = 09:00 UTC).
// Borra los mensajes anteriores al último reinicio, SOLO de los canales del coworking (sala principal y
// salas creadas); los canales de los proyectos de aula no se tocan. La sala ya oculta esos mensajes a
// las 4:00 en punto: esto es la limpieza (Vercel puede ejecutar el cron unos minutos tarde).
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const db = crearClienteServicio();
  const { data: canales, error } = await db
    .from("canales")
    .select("id")
    .or("id_sala.not.is.null,and(tipo.eq.foro,nombre.eq.Coworking)");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (canales ?? []).map((c) => c.id);
  if (!ids.length) return NextResponse.json({ borrados: 0 });

  const { error: errorBorrado, count } = await db
    .from("mensajes")
    .delete({ count: "exact" })
    .in("id_canal", ids)
    .lt("creado_en", ultimoReinicioChat().toISOString());
  if (errorBorrado) return NextResponse.json({ error: errorBorrado.message }, { status: 500 });
  return NextResponse.json({ canales: ids.length, borrados: count ?? 0 });
}
