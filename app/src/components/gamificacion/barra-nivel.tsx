import Link from "next/link";
import { Trophy } from "lucide-react";

import { calcularNivel } from "@/lib/gamificacion";
import { cn } from "@/lib/utils";

/** Nivel actual y cuánto falta para el siguiente, siempre a la vista (menú lateral y menú del celular). */
export function BarraNivel({ puntos, className }: { puntos: number; className?: string }) {
  const { actual, siguiente, progreso, faltan } = calcularNivel(puntos);
  return (
    <Link
      href="/formacion"
      data-recorrido="barra-nivel"
      className={cn("group block rounded-2xl border bg-[var(--verde-suave)]/60 p-3 transition hover:bg-[var(--verde-suave)]", className)}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-[var(--tinta)]">
          <Trophy className="size-3.5 text-[#d4a017]" aria-hidden />
          Nivel {actual.nivel} · {actual.nombre}
        </span>
        <span className="font-semibold text-[var(--primario-texto)] tabular-nums" data-contador-puntos>
          {puntos} pts
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/10"
        role="progressbar"
        aria-valuenow={progreso}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso hacia el siguiente nivel"
      >
        <div className="h-full rounded-full bg-[var(--primario)] transition-[width] duration-1000 ease-out" style={{ width: `${progreso}%` }} />
      </div>
      <p className="text-muted-foreground mt-1.5 text-[11px] leading-tight">
        {siguiente ? (
          <>
            {faltan <= 20 ? "¡Casi! " : ""}Te faltan <b className="text-foreground">{faltan} pts</b> para {siguiente.nombre}
          </>
        ) : (
          "¡Llegaste al nivel más alto!"
        )}
      </p>
    </Link>
  );
}
