"use client";

import { useState, useTransition } from "react";
import { Gift, Loader2 } from "lucide-react";

import { solicitarCanje } from "@/app/(app)/formacion/actions";
import { Button } from "@/components/ui/button";

/** Canjear una recompensa. Deshabilitado si el saldo no alcanza; la base valida saldo y stock de nuevo. */
export function BotonCanjear({ id, costo, saldo, agotada }: { id: string; costo: number; saldo: number; agotada: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<{ error?: string; aviso?: string } | null>(null);
  const faltan = costo - saldo;

  if (resultado?.aviso) return <p className="text-sm font-medium text-[var(--primario-texto)]">{resultado.aviso}</p>;

  return (
    <div className="space-y-1">
      <Button
        className="w-full"
        disabled={pendiente || agotada || faltan > 0}
        onClick={() =>
          iniciar(async () => {
            setResultado((await solicitarCanje(id)) ?? null);
          })
        }
      >
        {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : <Gift aria-hidden />}
        {agotada ? "Agotada" : faltan > 0 ? `Te faltan ${faltan} puntos` : "Canjear"}
      </Button>
      {resultado?.error && (
        <p className="text-destructive text-xs" role="alert">
          {resultado.error}
        </p>
      )}
    </div>
  );
}
