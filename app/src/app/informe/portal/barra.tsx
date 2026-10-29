"use client";

import { useEffect } from "react";
import { ArrowLeft, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Barra (no se imprime) y apertura automática del diálogo «Guardar como PDF». */
export function BarraInforme({ cantidad }: { cantidad: number }) {
  useEffect(() => {
    // El informe se imprime siempre en claro, aunque la app esté en modo oscuro
    document.documentElement.classList.remove("dark");
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-[#f7faf8] px-4 py-2 text-sm text-[#0b3d2a] print:hidden">
      <span>
        {cantidad === 1 ? "Informe del portal" : `Informe de ${cantidad} empresas`} · en el diálogo de impresión elige <b>Guardar como PDF</b>.
      </span>
      <span className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft aria-hidden /> Volver
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer aria-hidden /> Guardar como PDF
        </Button>
      </span>
    </div>
  );
}
