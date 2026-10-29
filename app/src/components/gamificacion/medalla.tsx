import { Award, BookOpen, Briefcase, CalendarCheck, Code2, Lock, Palette, Sparkles, Star, type LucideIcon } from "lucide-react";

import { medalla } from "@/lib/gamificacion";
import { cn } from "@/lib/utils";

// Ícono por área (insignias de aportes) o por criterio (las generales)
const POR_AREA: Record<string, LucideIcon> = {
  programación: Code2,
  diseño: Palette,
  teoría: BookOpen,
  negocios: Briefcase,
};
const POR_CRITERIO: Record<string, LucideIcon> = {
  puntos: Star,
  eventos_asistidos: CalendarCheck,
  onboarding: Sparkles,
  manual: Award,
};

export function iconoInsignia(criterio: string, area?: string | null): LucideIcon {
  return (area && POR_AREA[area.toLowerCase()]) || POR_CRITERIO[criterio] || Award;
}

type Props = {
  nivel: number;
  criterio: string;
  area?: string | null;
  bloqueada?: boolean;
  tamano?: "sm" | "md" | "lg";
  className?: string;
};

const TAMANOS = {
  sm: { caja: "size-9", interior: "inset-[3px]", icono: "size-4" },
  md: { caja: "size-14", interior: "inset-1", icono: "size-6" },
  lg: { caja: "size-20", interior: "inset-1.5", icono: "size-9" },
};

/** Medalla de una insignia: aro de bronce, plata u oro con el ícono del área o del criterio. */
export function Medalla({ nivel, criterio, area, bloqueada = false, tamano = "md", className }: Props) {
  const m = medalla(nivel);
  const t = TAMANOS[tamano];
  const Icono = iconoInsignia(criterio, area);
  return (
    <span
      className={cn("relative inline-block shrink-0 rounded-full bg-gradient-to-br shadow-sm", m.aro, t.caja, bloqueada && "opacity-45 grayscale", className)}
      aria-hidden
    >
      <span className={cn("absolute flex items-center justify-center rounded-full bg-white", t.interior)}>
        <Icono className={cn(t.icono, m.texto)} strokeWidth={2.2} />
      </span>
      {bloqueada && (
        <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full border bg-white">
          <Lock className="text-muted-foreground size-3" />
        </span>
      )}
    </span>
  );
}
