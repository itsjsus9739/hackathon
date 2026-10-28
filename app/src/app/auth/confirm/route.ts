import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { crearClienteServidor } from "@/lib/supabase/server";

// Destino del enlace del correo de confirmación. Soporta los dos formatos de Supabase:
// ?code= (flujo PKCE, plantilla por defecto) y ?token_hash=&type= (plantilla personalizada).
// ?next= indica a dónde seguir (p. ej. /restablecer tras "Olvidé mi contraseña").
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Solo rutas internas: "//otro.com" o "https://…" no deben convertirse en una redirección abierta
  const next = searchParams.get("next");
  const destino = next && /^\/(?![/\\])/.test(next) ? next : type === "recovery" ? "/restablecer" : "/";
  const supabase = await crearClienteServidor();

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Enlace sin código") };

  // Con sesión, el layout envía a cada quien a su pantalla (inicio o /solicitud)
  return NextResponse.redirect(error ? `${origin}/login?error=enlace` : `${origin}${destino}`);
}
