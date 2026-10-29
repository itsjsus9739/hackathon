"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MODULOS } from "@/lib/navegacion";
import { cn } from "@/lib/utils";
import { estaActivo, ICONO_MODULO } from "./iconos";

/** Enlaces del menú lateral (escritorio), con el módulo actual resaltado. */
export function EnlacesModulos() {
  const ruta = usePathname();
  return (
    <>
      {MODULOS.map((m) => {
        const Icono = ICONO_MODULO[m.href];
        const activo = estaActivo(ruta, m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            data-recorrido={`nav:${m.href}`}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-black/5",
              activo && "bg-black/[0.07] font-medium",
            )}
          >
            <Icono className="text-muted-foreground size-4 shrink-0" aria-hidden />
            {m.etiqueta}
          </Link>
        );
      })}
    </>
  );
}
