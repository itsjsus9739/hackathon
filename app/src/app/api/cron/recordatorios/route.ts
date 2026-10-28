import { NextResponse } from "next/server";
import { Resend } from "resend";
import { crearClienteServicio } from "@/lib/supabase/server";

// Recordatorios automáticos (Vercel Cron, diario): citas agendadas para las próximas 24 horas.
// Elimina el trabajo manual de "enviar recordatorios" que hoy hace el equipo del CDE.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const db = crearClienteServicio();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const de = process.env.CORREO_REMITENTE ?? "CDE UNAB <onboarding@resend.dev>";
  const ahora = new Date();
  const manana = new Date(ahora.getTime() + 24 * 3600 * 1000);

  const { data: citas, error } = await db
    .from("citas")
    .select("id, motivo, fecha_hora, solicitada_por, empresas(nombre)")
    .eq("estado", "Agendada")
    .is("recordatorio_enviado_en", null)
    .gte("fecha_hora", ahora.toISOString())
    .lte("fecha_hora", manana.toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let enviados = 0;
  for (const cita of citas ?? []) {
    if (!cita.solicitada_por || !cita.fecha_hora) continue;
    // El correo vive en auth.users; solo la llave de servicio puede leerlo
    const { data: usuario } = await db.auth.admin.getUserById(cita.solicitada_por);
    const correo = usuario?.user?.email;
    if (!correo) continue;
    const hora = new Date(cita.fecha_hora).toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      dateStyle: "full",
      timeStyle: "short",
    });
    const empresa = cita.empresas?.nombre ?? "tu empresa";
    await resend.emails.send({
      from: de,
      to: correo,
      subject: `Recordatorio: tu asesoría con el CDE es ${hora}`,
      html: `<p>Hola,</p><p>Te recordamos la asesoría <b>${cita.motivo}</b> de <b>${empresa}</b> el <b>${hora}</b>.</p><p>Centro de Desarrollo Empresarial · UNAB</p>`,
    });
    await db.from("citas").update({ recordatorio_enviado_en: new Date().toISOString() }).eq("id", cita.id);
    enviados++;
  }

  return NextResponse.json({ recordatoriosCitas: enviados });
}
