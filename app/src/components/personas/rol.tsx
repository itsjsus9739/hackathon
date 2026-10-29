import type { Enums } from "@/lib/supabase/database.types";
import { COLOR_ROL, ETIQUETA_ROL, iniciales } from "@/lib/roles";
import { cn } from "@/lib/utils";

type Rol = Enums<"rol_usuario">;

/** Etiqueta del rol con su color. */
export function EtiquetaRol({ rol, className }: { rol: Rol; className?: string }) {
  const c = COLOR_ROL[rol];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", c.fondo, c.texto, className)}>
      <span className={cn("size-1.5 rounded-full", c.punto)} aria-hidden />
      {ETIQUETA_ROL[rol]}
    </span>
  );
}

/** Círculo con las iniciales, del color del rol. */
export function AvatarRol({ nombre, rol, className }: { nombre: string; rol: Rol; className?: string }) {
  const c = COLOR_ROL[rol];
  return (
    <span
      className={cn("grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold", c.fondo, c.texto, className)}
      aria-hidden
    >
      {iniciales(nombre) || "?"}
    </span>
  );
}
