import { NextResponse } from "next/server";
import { Resend } from "resend";
import { crearClienteServicio } from "@/lib/supabase/server";

// Recordatorios automáticos (Vercel Cron, diario): citas de mañana y compromisos que vencen en 3 días.
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
  const enTresDias = new Date(ahora.getTime() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const { data: citas, error } = await db
    .from("citas")
    .select("id, motivo, inicio, personas(nombre, correo), empresas(nombre)")
    .eq("estado", "agendada")
    .is("recordatorio_enviado_en", null)
    .gte("inicio", ahora.toISOString())
    .lte("inicio", manana.toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let enviados = 0;
  for (const c of citas ?? []) {
    const persona = c.personas as unknown as { nombre: string; correo: string | null } | null;
    if (!persona?.correo) continue;
    const hora = new Date(c.inicio!).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "full", timeStyle: "short" });
    await resend.emails.send({
      from: de,
      to: persona.correo,
      subject: `Recordatorio: tu asesoría con el CDE es ${hora}`,
      html: `<p>Hola ${persona.nombre},</p><p>Te recordamos tu cita <b>${c.motivo}</b> el <b>${hora}</b>.</p><p>Centro de Desarrollo Empresarial · UNAB</p>`,
    });
    await db.from("citas").update({ recordatorio_enviado_en: new Date().toISOString() }).eq("id", c.id);
    enviados++;
  }

  // Compromisos vencidos se marcan solos; los próximos a vencer se reportan
  await db.from("compromisos").update({ estado: "vencido" }).lt("fecha_limite", ahora.toISOString().slice(0, 10)).in("estado", ["pendiente", "en_progreso"]);
  const { count: porVencer } = await db
    .from("compromisos")
    .select("id", { count: "exact", head: true })
    .lte("fecha_limite", enTresDias)
    .in("estado", ["pendiente", "en_progreso"]);

  return NextResponse.json({ recordatoriosCitas: enviados, compromisosPorVencer: porVencer ?? 0 });
}
