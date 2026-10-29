import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type Sesion = {
  id: string;
  correo: string;
  correoConfirmado: boolean;
  nombre: string;
  rol: Enums<"rol_usuario">;
  estadoAcceso: Enums<"estado_acceso">;
};

export { ETIQUETA_ROL } from "./roles";

/** Usuario autenticado + su perfil. null si no hay sesión. Se cachea por petición. */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await crearClienteServidor();
  // getUser() valida el token con Supabase (getSession() solo lee la cookie)
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, rol, estado_acceso")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    id: data.user.id,
    correo: data.user.email ?? "",
    correoConfirmado: Boolean(data.user.email_confirmed_at),
    nombre: perfil?.nombre ?? data.user.email ?? "",
    rol: perfil?.rol ?? "emprendedor",
    estadoAcceso: perfil?.estado_acceso ?? "pendiente",
  };
});
