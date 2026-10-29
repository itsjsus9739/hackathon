"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, LogOut, X } from "lucide-react";

import { cerrarSesion } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { MODULOS, modulosPara, type RutaModulo } from "@/lib/navegacion";
import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { estaActivo, ICONO_MODULO } from "./iconos";

// Celular: barra inferior con los módulos de uso diario (al alcance del pulgar) y "Menú",
// que abre una hoja con todos los módulos, el usuario y el cierre de sesión.
const PRINCIPALES: RutaModulo[] = ["/", "/empresas", "/eventos", "/coworking"];
const CORTOS: Partial<Record<RutaModulo, string>> = { "/": "Inicio" };

export function BarraMovil({ nombre, rol, etiquetaRol }: { nombre: string; rol: Enums<"rol_usuario">; etiquetaRol: string }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);

  // Al navegar se cierra la hoja
  useEffect(() => setAbierto(false), [ruta]);

  // Mientras la hoja está abierta: Esc la cierra y la página de fondo no se desplaza
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    const desborde = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = desborde;
      window.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  const enOtroModulo = !PRINCIPALES.some((h) => estaActivo(ruta, h));

  return (
    <>
      <nav
        data-recorrido="menu"
        aria-label="Módulos"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-[var(--panel)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-5">
          {PRINCIPALES.map((href) => {
            const m = MODULOS.find((x) => x.href === href)!;
            const Icono = ICONO_MODULO[href];
            const activo = estaActivo(ruta, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  data-recorrido={`nav:${href}`}
                  aria-current={activo ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px]",
                    activo ? "font-semibold text-[var(--primario-texto)]" : "text-muted-foreground",
                  )}
                >
                  <Icono className="size-5" aria-hidden />
                  {CORTOS[href] ?? m.etiqueta}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setAbierto(true)}
              aria-expanded={abierto}
              aria-controls="menu-movil"
              className={cn(
                "flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px]",
                enOtroModulo ? "font-semibold text-[var(--primario-texto)]" : "text-muted-foreground",
              )}
            >
              <LayoutGrid className="size-5" aria-hidden />
              Menú
            </button>
          </li>
        </ul>
      </nav>

      {abierto && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menú" id="menu-movil">
          <button type="button" aria-label="Cerrar el menú" className="absolute inset-0 bg-black/40" onClick={() => setAbierto(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/15" aria-hidden />
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{nombre}</p>
                <p className="text-muted-foreground text-xs">{etiquetaRol}</p>
              </div>
              <button type="button" className="text-muted-foreground p-2" onClick={() => setAbierto(false)} aria-label="Cerrar">
                <X className="size-5" />
              </button>
            </div>
            <ul className="grid grid-cols-3 gap-2">
              {modulosPara(rol).map((m) => {
                const Icono = ICONO_MODULO[m.href];
                const activo = estaActivo(ruta, m.href);
                return (
                  <li key={m.href}>
                    <Link
                      href={m.href}
                      aria-current={activo ? "page" : undefined}
                      onClick={() => setAbierto(false)}
                      className={cn(
                        "flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border px-1 text-center text-xs leading-tight",
                        activo ? "border-[var(--primario)] bg-[var(--verde-suave)] font-semibold text-[var(--primario-texto)]" : "active:bg-muted",
                      )}
                    >
                      <Icono className="size-5" aria-hidden />
                      {m.etiqueta}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <form action={cerrarSesion} className="mt-4 border-t pt-3">
              <Button type="submit" variant="ghost" className="w-full justify-center">
                <LogOut aria-hidden /> Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
