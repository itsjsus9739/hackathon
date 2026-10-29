import "server-only";

import { Resend } from "resend";

import { crearClienteServicio } from "@/lib/supabase/server";

const escapar = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Avisa por correo a los miembros y admins del CDE de un registro que deben revisar: alguien que se registró
 * como docente (para confirmar el rol) o una solicitud de acceso con correo externo (para aprobarla).
 * La notificación dentro de la app la crea la base (trigger); este correo es adicional y no bloquea el registro:
 * sin RESEND_API_KEY o sin SUPABASE_SERVICE_ROLE_KEY simplemente no se envía.
 */
export async function avisarRegistroAlCde(p: { nombre: string; correo: string; rol: string; institucional: boolean; origen: string }) {
  if (!process.env.RESEND_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const { data, error } = await crearClienteServicio().rpc("correos_cde");
    if (error) throw error;
    const destinatarios = [...new Set((data ?? []).map((d) => d.correo))];
    if (!destinatarios.length) return;

    const nombre = escapar(p.nombre);
    const correo = escapar(p.correo);
    const rol = escapar(p.rol);
    const esDocente = p.rol === "docente";
    const estado = p.institucional
      ? "Usó su correo institucional, así que ya tiene acceso al confirmar su correo."
      : "Usó un correo externo: su solicitud de acceso queda pendiente hasta que el CDE la apruebe.";
    const { error: errorEnvio } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: process.env.CORREO_REMITENTE ?? "CDE UNAB <onboarding@resend.dev>",
      to: destinatarios,
      subject: esDocente ? `Confirma un registro como docente: ${p.nombre}` : `Nueva solicitud de acceso: ${p.nombre}`,
      html: `<p>Hola, equipo del CDE:</p>
<p><b>${nombre}</b> (${correo}) se acaba de registrar en CDE Nest como <b>${rol}</b>.</p>
<p>${estado}</p>
<p>${esDocente ? "Si no es docente de la UNAB, cambia su rol o rechaza su solicitud." : "Revísala en la campana de notificaciones para aprobarla o rechazarla."}</p>
<p><a href="${escapar(p.origen)}/notificaciones">Revisar en CDE Nest</a></p>
<p>Centro de Desarrollo Empresarial · UNAB</p>`,
    });
    if (errorEnvio) throw errorEnvio;
  } catch (e) {
    console.error("[avisos] no se pudo enviar el aviso de registro al CDE", e);
  }
}
