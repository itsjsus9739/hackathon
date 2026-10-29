"use client";

import { useState, useTransition } from "react";
import { Loader2, MessageSquarePlus, NotebookPen } from "lucide-react";

import { reportarAvancePlan } from "@/app/(app)/planes/actions";
import { AvatarRol, EtiquetaRol } from "@/components/personas/rol";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Enums } from "@/lib/supabase/database.types";

export type AvanceVista = { id: string; texto: string; fecha: string; autor: string; rol: Enums<"rol_usuario"> | null };

const VISIBLES = 3;

/** Bitácora del plan: lo que reporta el docente (o el CDE / el responsable), visible para la empresa. */
export function AvancesPlan({ idPlan, avances, puedeReportar }: { idPlan: string; avances: AvanceVista[]; puedeReportar: boolean }) {
  const [todos, setTodos] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  if (!avances.length && !puedeReportar) return null;
  const mostrados = todos ? avances : avances.slice(0, VISIBLES);

  return (
    <section className="mt-3 border-t pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold">
          <NotebookPen className="size-4" aria-hidden /> Avances reportados
          {avances.length > 0 && <span className="text-muted-foreground font-normal whitespace-nowrap">· {avances.length}</span>}
        </h4>
        {puedeReportar && !escribiendo && (
          <Button variant="outline" size="sm" onClick={() => setEscribiendo(true)}>
            <MessageSquarePlus aria-hidden /> Reportar avance
          </Button>
        )}
      </div>

      {escribiendo && (
        <form
          className="mb-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            iniciar(async () => {
              const r = await reportarAvancePlan({ id_plan: idPlan, texto });
              if (r?.error) setError(r.error);
              else {
                setTexto("");
                setEscribiendo(false);
              }
            });
          }}
        >
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            maxLength={2000}
            required
            placeholder="Ej.: Los estudiantes entregaron el flujo de caja; la empresa ya lo usa para sus compras."
            aria-label="Avance"
          />
          {error && <p className="text-destructive text-xs">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={ocupado}>
              {ocupado && <Loader2 className="animate-spin" />} Publicar avance
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setEscribiendo(false)}>
              Cancelar
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">La empresa y el responsable del plan reciben un aviso.</p>
        </form>
      )}

      {avances.length === 0 ? (
        !escribiendo && <p className="text-muted-foreground text-xs">Aún no hay avances reportados.</p>
      ) : (
        <ol className="space-y-3">
          {mostrados.map((a) => (
            <li key={a.id} className="flex gap-3">
              {a.rol ? (
                <AvatarRol nombre={a.autor} rol={a.rol} className="size-7 text-[10px]" />
              ) : (
                <span className="bg-muted size-7 shrink-0 rounded-full" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="font-semibold">{a.autor}</span>
                  {a.rol && <EtiquetaRol rol={a.rol} />}
                  <span className="text-muted-foreground">{a.fecha}</span>
                </p>
                <p className="mt-0.5 text-sm whitespace-pre-wrap">{a.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {avances.length > VISIBLES && (
        <Button variant="link" size="sm" className="mt-1 px-0" onClick={() => setTodos(!todos)}>
          {todos ? "Ver menos" : `Ver los ${avances.length} avances`}
        </Button>
      )}
    </section>
  );
}
