"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { actualizarCompromiso, actualizarEstadoPlan } from "@/app/(app)/planes/actions";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { ESTADOS_PLAN, type EstadoPlan } from "@/lib/planes";

const PASOS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/** El responsable reporta el % o marca el compromiso como cumplido. */
export function ControlAvance({ id, avance, estado }: { id: string; avance: number; estado: string }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cerrado = estado === "Cumplido" || estado === "Cancelado";

  const guardar = (nuevo: number, cumplido = false) =>
    iniciar(async () => {
      setError(null);
      const r = await actualizarCompromiso({ id, avance: nuevo, estado: cumplido ? "Cumplido" : undefined });
      if (r?.error) setError(r.error);
    });

  if (cerrado) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        aria-label="Avance del compromiso"
        className="h-8 w-24"
        value={avance}
        disabled={pendiente}
        onChange={(e) => guardar(Number(e.target.value))}
      >
        {PASOS.map((p) => (
          <option key={p} value={p}>
            {p} %
          </option>
        ))}
      </NativeSelect>
      <Button size="sm" variant="outline" className="h-8" disabled={pendiente} onClick={() => guardar(100, true)}>
        {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} Cumplido
      </Button>
      {error && <p className="text-destructive w-full text-xs">{error}</p>}
    </div>
  );
}

export function SelectorEstadoPlan({ id, estado }: { id: string; estado: string }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <NativeSelect
        aria-label="Estado del plan"
        className="h-8 w-36"
        value={estado}
        disabled={pendiente}
        onChange={(e) =>
          iniciar(async () => {
            setError(null);
            const r = await actualizarEstadoPlan({ id, estado: e.target.value as EstadoPlan });
            if (r?.error) setError(r.error);
          })
        }
      >
        {ESTADOS_PLAN.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </NativeSelect>
      {pendiente && <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
