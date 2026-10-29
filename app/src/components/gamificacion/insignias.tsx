"use client";

import { useState } from "react";

import { Medalla } from "@/components/gamificacion/medalla";
import { medalla, type EstadoInsignia } from "@/lib/gamificacion";
import { cn } from "@/lib/utils";

export type InsigniaVista = {
  id: string;
  nombre: string;
  descripcion: string;
  nivel: number;
  criterio: string;
  area: string | null;
  estado: EstadoInsignia;
  progreso: { actual: number; meta: number } | null;
  otorgadaEn: string | null;
};

const FILTROS = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "ganadas", etiqueta: "Ganadas" },
  { valor: "por_ganar", etiqueta: "Por ganar" },
] as const;

const FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" });

export function MisInsignias({ insignias }: { insignias: InsigniaVista[] }) {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["valor"]>("todas");
  const ganadas = insignias.filter((i) => i.estado === "ganada").length;
  const visibles = insignias.filter((i) =>
    filtro === "todas" ? true : filtro === "ganadas" ? i.estado === "ganada" : i.estado !== "ganada",
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Tienes <b className="text-foreground">{ganadas}</b> de {insignias.length}
        </p>
        <div className="flex gap-1 rounded-lg border bg-card p-1" role="group" aria-label="Filtrar insignias">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              aria-pressed={filtro === f.valor}
              onClick={() => setFiltro(f.valor)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition",
                filtro === f.valor ? "bg-[var(--primario-texto)] text-white" : "text-muted-foreground hover:bg-foreground/5",
              )}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {visibles.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibles.map((i) => (
            <TarjetaInsignia key={i.id} insignia={i} />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          {filtro === "ganadas" ? "Aún no tienes insignias. ¡La primera está a un paso!" : "¡Las tienes todas!"}
        </p>
      )}
    </div>
  );
}

function TarjetaInsignia({ insignia: i }: { insignia: InsigniaVista }) {
  const ganada = i.estado === "ganada";
  return (
    <li
      className={cn(
        "flex flex-col items-center rounded-xl border p-3 text-center",
        ganada ? "bg-card shadow-sm" : i.estado === "secreta" ? "border-dashed bg-[var(--muted)]/60" : "bg-[var(--muted)]/60",
      )}
    >
      <Medalla nivel={i.nivel} criterio={i.estado === "secreta" ? "secreta" : i.criterio} area={i.area} bloqueada={!ganada} />
      <p className="mt-2 text-sm leading-tight font-semibold text-balance">{i.nombre}</p>
      <p className="text-muted-foreground mt-0.5 text-xs text-pretty">{i.descripcion}</p>
      <div className="mt-auto w-full pt-2">
        {ganada ? (
          <p className="text-xs font-medium text-[var(--primario-texto)]">
            {medalla(i.nivel).nombre} · {i.otorgadaEn ? FECHA.format(new Date(i.otorgadaEn)) : "Ganada"}
          </p>
        ) : i.estado === "manual" ? (
          <p className="text-muted-foreground text-xs italic">La otorga el CDE</p>
        ) : i.estado === "secreta" ? (
          <p className="text-muted-foreground text-xs italic">¿Qué será? 🤫</p>
        ) : (
          i.progreso && (
            <div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-foreground/10"
                role="progressbar"
                aria-valuenow={i.progreso.actual}
                aria-valuemin={0}
                aria-valuemax={i.progreso.meta}
                aria-label={`Progreso de ${i.nombre}`}
              >
                <div className="h-full rounded-full bg-[var(--primario)]" style={{ width: `${(i.progreso.actual / i.progreso.meta) * 100}%` }} />
              </div>
              <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                {i.progreso.actual} / {i.progreso.meta}
              </p>
            </div>
          )
        )}
      </div>
    </li>
  );
}
