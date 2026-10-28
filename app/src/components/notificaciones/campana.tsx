import Link from "next/link";
import { Bell } from "lucide-react";

import { crearClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/** Campana con el número de notificaciones sin leer (RLS: cada quien cuenta solo las suyas). */
export async function Campana({ className }: { className?: string }) {
  const supabase = await crearClienteServidor();
  const { count } = await supabase
    .from("notificaciones")
    .select("id", { count: "exact", head: true })
    .is("leida_en", null);
  const sinLeer = count ?? 0;

  return (
    <Link
      href="/notificaciones"
      data-recorrido="campana"
      aria-label={sinLeer ? `Notificaciones: ${sinLeer} sin leer` : "Notificaciones"}
      className={cn("relative inline-flex size-9 items-center justify-center rounded-md hover:bg-black/5", className)}
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
