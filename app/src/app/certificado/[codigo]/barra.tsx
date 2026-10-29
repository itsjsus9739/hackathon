"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, Printer } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";

/** Barra (no se imprime): volver y guardar como PDF. El certificado siempre se ve en claro. */
export function BarraCertificado({ anulado }: { anulado: boolean }) {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-[#f7faf8] px-4 py-2 text-sm text-[#0b3d2a] print:hidden">
      <span>
        {anulado ? (
          <b className="text-red-700">Este certificado fue anulado por el CDE.</b>
        ) : (
          <>
            Tu certificado · en el diálogo de impresión elige <b>Guardar como PDF</b> y orientación <b>horizontal</b>.
          </>
        )}
      </span>
      <span className="flex gap-2">
        <Link href="/formacion" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ArrowLeft aria-hidden /> Volver
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer aria-hidden /> Descargar PDF
        </Button>
      </span>
    </div>
  );
}
