"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function Pestanas({ pestanas }: { pestanas: { href: string; etiqueta: string; contador?: number }[] }) {
  const ruta = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Secciones de formación y recompensas">
      {pestanas.map((p) => {
        const activa = ruta === p.href;
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition",
              activa ? "border-[var(--primario)] text-[var(--tinta)]" : "text-muted-foreground border-transparent hover:text-[var(--tinta)]",
            )}
          >
            {p.etiqueta}
            {!!p.contador && (
              <span className="rounded-full bg-[var(--primario)] px-1.5 text-[11px] leading-5 font-semibold text-white tabular-nums">
                {p.contador}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
