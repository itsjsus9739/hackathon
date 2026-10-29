"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MODULOS, type RutaModulo } from "@/lib/navegacion";
import { cn } from "@/lib/utils";
import { estaActivo, ICONO_MODULO } from "./iconos";

// Mismas opciones de MODULOS, agrupadas como en el diseño
const GRUPOS: { titulo?: string; rutas: RutaModulo[] }[] = [
  { rutas: ["/"] },
  { titulo: "Gestión", rutas: ["/empresas", "/importar", "/planes"] },
  { titulo: "Actividades", rutas: ["/citas", "/eventos", "/coworking"] },
  { titulo: "Aprendizaje", rutas: ["/formacion", "/conocimiento", "/asistente", "/portal"] },
];

const ETIQUETA = Object.fromEntries(MODULOS.map((m) => [m.href, m.etiqueta])) as Record<RutaModulo, string>;

/** Enlaces del menú lateral por grupo, con ícono y el módulo actual resaltado. */
export function MenuLateral() {
  const ruta = usePathname();
  return (
    <>
      {GRUPOS.map((g) => (
        <div key={g.titulo ?? "inicio"} className="flex flex-col gap-0.5">
          {g.titulo && (
            <p className="mt-4 mb-1 px-3 text-[11px] font-semibold tracking-wider text-[#8ba597] uppercase">{g.titulo}</p>
          )}
          {g.rutas.map((href) => {
            const Icono = ICONO_MODULO[href];
            const activo = estaActivo(ruta, href);
            return (
              <Link
                key={href}
                href={href}
                data-recorrido={`nav:${href}`}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium text-[var(--tinta-suave)] transition-colors hover:bg-[var(--verde-suave)]",
                  activo && "bg-[var(--verde-suave)] font-semibold text-[var(--primario-texto)]",
                )}
              >
                <Icono className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
                {ETIQUETA[href]}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}
