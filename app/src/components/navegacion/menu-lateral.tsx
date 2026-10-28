"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Armchair,
  Building2,
  CalendarClock,
  CalendarDays,
  FileUp,
  GraduationCap,
  House,
  Lightbulb,
  ListChecks,
  Rocket,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { MODULOS, type RutaModulo } from "@/lib/navegacion";
import { cn } from "@/lib/utils";

const ICONOS: Record<RutaModulo, LucideIcon> = {
  "/": House,
  "/empresas": Building2,
  "/importar": FileUp,
  "/planes": ListChecks,
  "/citas": CalendarClock,
  "/eventos": CalendarDays,
  "/formacion": GraduationCap,
  "/conocimiento": Lightbulb,
  "/asistente": Sparkles,
  "/coworking": Armchair,
  "/portal": Rocket,
};

/** Enlaces del menú lateral con ícono y el módulo actual resaltado. */
export function MenuLateral() {
  const ruta = usePathname();
  return (
    <>
      {MODULOS.map((m) => {
        const Icono = ICONOS[m.href];
        const activo = m.href === "/" ? ruta === "/" : ruta.startsWith(m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            data-recorrido={`nav:${m.href}`}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-full px-3 py-2 text-sm text-[var(--tinta-suave)] transition-colors hover:bg-[var(--verde-suave)]",
              activo && "bg-[var(--verde-suave)] font-semibold text-[var(--primario-texto)]",
            )}
          >
            <Icono className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
            {m.etiqueta}
          </Link>
        );
      })}
    </>
  );
}
