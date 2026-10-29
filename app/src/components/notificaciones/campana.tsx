import Link from "next/link";
import { Bell } from "lucide-react";

import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/**
 * Campana con el número de notificaciones sin leer del usuario. Se filtra por usuario porque
 * RLS deja al CDE leer las de todos (cde_todo): sin el filtro, contaba las de toda la comunidad.
 */
export async function Campana({ className }: { className?: string }) {
  const [sesion, supabase] = await Promise.all([obtenerSesion(), crearClienteServidor()]);
  const { count } = sesion
    ? await supabase
        .from("notificaciones")
        .select("id", { count: "exact", head: true })
        .eq("id_usuario", sesion.id)
        .is("leida_en", null)
    : { count: 0 };
  const sinLeer = count ?? 0;

  return (
    <Link
      href="/notificaciones"
      data-recorrido="campana"
      aria-label={sinLeer ? `Notificaciones: ${sinLeer} sin leer` : "Notificaciones"}
      className={cn("relative inline-flex size-9 items-center justify-center rounded-md hover:bg-foreground/5", className)}
    >
      <Bell className="size-5" aria-hidden />
      {sinLeer > 0 && (
        <span className="bg-primario absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white tabular-nums">
          {sinLeer > 99 ? "99+" : sinLeer}
        </span>
      )}
    </Link>
  );
}
