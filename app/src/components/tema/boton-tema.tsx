"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { LLAVE_TEMA } from "@/lib/tema";
import { cn } from "@/lib/utils";

/** Alterna entre modo claro y oscuro. Mientras la persona no elija, sigue el modo del sistema. */
export function BotonTema({ className }: { className?: string }) {
  const [oscuro, setOscuro] = useState<boolean | null>(null);

  useEffect(() => {
    setOscuro(document.documentElement.classList.contains("dark"));
    const sistema = matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = (e: MediaQueryListEvent) => {
      let elegido: string | null = null;
      try {
        elegido = localStorage.getItem(LLAVE_TEMA);
      } catch {}
      if (elegido) return;
      document.documentElement.classList.toggle("dark", e.matches);
      setOscuro(e.matches);
    };
    sistema.addEventListener("change", alCambiar);
    return () => sistema.removeEventListener("change", alCambiar);
  }, []);

  function alternar() {
    const siguiente = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", siguiente);
    try {
      localStorage.setItem(LLAVE_TEMA, siguiente ? "oscuro" : "claro");
    } catch {}
    setOscuro(siguiente);
  }

  const etiqueta = oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(
        "text-muted-foreground hover:text-foreground flex size-9 items-center justify-center rounded-full transition hover:bg-foreground/5",
        className,
      )}
    >
      {/* Antes de hidratar no se sabe el tema: se muestran los dos íconos según la clase .dark */}
      {oscuro === null ? (
        <>
          <Moon className="size-[18px] dark:hidden" aria-hidden />
          <Sun className="hidden size-[18px] dark:block" aria-hidden />
        </>
      ) : oscuro ? (
        <Sun className="size-[18px]" aria-hidden />
      ) : (
        <Moon className="size-[18px]" aria-hidden />
      )}
    </button>
  );
}
