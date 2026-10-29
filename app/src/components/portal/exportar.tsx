"use client";

import Link from "next/link";
import { useState } from "react";
import { Database, FileSpreadsheet, FileText } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Botones de exportar el portal de una empresa (Excel editable y PDF). */
export function ExportarPortal({ empresa }: { empresa: string }) {
  return (
    <div className="flex flex-wrap gap-2" data-recorrido="portal-exportar">
      <a href={`/portal/exportar?empresa=${empresa}`} className={buttonVariants({ size: "sm", variant: "outline" })} download>
        <FileSpreadsheet aria-hidden /> Excel
      </a>
      <a href={`/informe/portal?empresa=${empresa}`} target="_blank" rel="noopener" className={buttonVariants({ size: "sm", variant: "outline" })}>
        <FileText aria-hidden /> PDF
      </a>
    </div>
  );
}

type Empresa = { id: string; nombre: string; municipio: string | null; representante: string | null };

/** Lista del CDE con selección múltiple para exportar varias empresas a la vez. */
export function ListaExportable({ lista, q }: { lista: Empresa[]; q: string }) {
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const todas = elegidas.size === lista.length && lista.length > 0;
  const alternar = (id: string) =>
    setElegidas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <form method="get" className="space-y-3">
      <div className="bg-card flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm">
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            className="size-4 accent-[var(--primario)]"
            checked={todas}
            onChange={() => setElegidas(todas ? new Set() : new Set(lista.map((e) => e.id)))}
          />
          {elegidas.size ? `${elegidas.size} seleccionada${elegidas.size > 1 ? "s" : ""}` : "Seleccionar todas"}
        </label>
        <span className="ml-auto flex flex-wrap gap-2">
          <Button type="submit" size="sm" variant="outline" formAction="/portal/exportar" disabled={!elegidas.size}>
            <FileSpreadsheet aria-hidden /> Excel
          </Button>
          <Button type="submit" size="sm" variant="outline" formAction="/informe/portal" formTarget="_blank" disabled={!elegidas.size}>
            <FileText aria-hidden /> PDF
          </Button>
          <a
            href={q ? `/portal/exportar?q=${encodeURIComponent(q)}` : "/portal/exportar?todas=1"}
            className={buttonVariants({ size: "sm", variant: "ghost" })}
            download
            title={q ? "Todas las empresas que coinciden con la búsqueda" : "Todas las empresas de la base (máximo 300)"}
          >
            <Database aria-hidden /> {q ? "Excel de toda la búsqueda" : "Excel de toda la base"}
          </a>
        </span>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {lista.map((e) => (
          <li key={e.id} className={cn("bg-card flex items-start gap-3 rounded-xl border p-3 transition", elegidas.has(e.id) && "border-[var(--primario)]")}>
            <input
              type="checkbox"
              name="empresa"
              value={e.id}
              checked={elegidas.has(e.id)}
              onChange={() => alternar(e.id)}
              className="mt-1 size-4 shrink-0 accent-[var(--primario)]"
              aria-label={`Seleccionar ${e.nombre}`}
            />
            <Link href={`/portal?empresa=${e.id}`} className="min-w-0 flex-1 hover:underline">
              <span className="block font-semibold">{e.nombre}</span>
              <span className="text-muted-foreground text-xs">
                {[e.municipio, e.representante ? `Emprendedor: ${e.representante}` : "Sin emprendedor con cuenta"].filter(Boolean).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </form>
  );
}
