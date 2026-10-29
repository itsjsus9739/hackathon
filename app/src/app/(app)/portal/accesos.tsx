"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, KeyRound, Loader2, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { otorgarAccesoPortal, resolverAccesoPortal, revocarAccesoPortal, solicitarAccesoPortal, type Resultado } from "./actions";

function Mensaje({ estado }: { estado: Resultado }) {
  if (estado?.error)
    return (
      <p className="text-destructive text-sm" role="alert">
        {estado.error}
      </p>
    );
  if (estado?.ok)
    return (
      <p className="text-sm font-medium text-[var(--primario-texto)]" role="status">
        {estado.ok}
      </p>
    );
  return null;
}

/** El estudiante pide al CDE ver el portal de una empresa de sus proyectos. */
export function SolicitarAcceso({ empresas }: { empresas: { id: string; nombre: string }[] }) {
  const [estado, accion, pendiente] = useActionState(solicitarAccesoPortal, undefined);
  if (!empresas.length) {
    return <p className="text-muted-foreground text-sm">No estás en ningún proyecto de aula con una empresa. Cuando tu docente te asigne, podrás pedir acceso.</p>;
  }
  return (
    <form action={accion} className="space-y-3 text-left">
      <div className="space-y-1.5">
        <Label htmlFor="acceso-empresa">Empresa</Label>
        <NativeSelect id="acceso-empresa" name="empresa" required defaultValue={empresas.length === 1 ? empresas[0].id : ""}>
          <option value="" disabled>
            Elige la empresa de tu proyecto
          </option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="acceso-motivo">¿Para qué lo necesitas? (opcional)</Label>
        <Textarea id="acceso-motivo" name="motivo" rows={2} maxLength={500} placeholder="Ej.: preparar la intervención de mi asignatura" />
      </div>
      <Button type="submit" disabled={pendiente}>
        {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />} Pedir acceso al CDE
      </Button>
      <Mensaje estado={estado} />
    </form>
  );
}

type Acceso = { id: string; estudiante: string; estado: string; motivo: string | null };

/** Panel del CDE: estudiantes con acceso al portal de esta empresa (aprobar, rechazar, revocar u otorgar). */
export function AccesosEstudiantes({ empresa, accesos, estudiantes }: { empresa: string; accesos: Acceso[]; estudiantes: { id: string; nombre: string }[] }) {
  const [estado, accion, otorgando] = useActionState(otorgarAccesoPortal, undefined);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ejecutar = (f: () => Promise<Resultado>) =>
    iniciar(async () => {
      setError(null);
      const r = await f();
      if (r?.error) setError(r.error);
    });
  const conAcceso = new Set(accesos.filter((a) => a.estado === "aprobado" || a.estado === "pendiente").map((a) => a.estudiante));
  const vigentes = accesos.filter((a) => a.estado === "pendiente" || a.estado === "aprobado");

  return (
    <div className="space-y-4">
      {vigentes.length ? (
        <ul className="divide-y text-sm">
          {vigentes.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{a.estudiante}</span>
                {a.motivo && <span className="text-muted-foreground block text-xs">«{a.motivo}»</span>}
              </span>
              {a.estado === "pendiente" ? (
                <>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Pide acceso</span>
                  <Button size="sm" disabled={pendiente} onClick={() => ejecutar(() => resolverAccesoPortal({ acceso: a.id, aprobar: true }))}>
                    <Check aria-hidden /> Aprobar
                  </Button>
                  <Button size="sm" variant="outline" disabled={pendiente} onClick={() => ejecutar(() => resolverAccesoPortal({ acceso: a.id, aprobar: false }))}>
                    <X aria-hidden /> Rechazar
                  </Button>
                </>
              ) : (
                <>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Con acceso</span>
                  <Button size="sm" variant="outline" disabled={pendiente} onClick={() => ejecutar(() => revocarAccesoPortal(a.id))}>
                    Revocar
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Ningún estudiante tiene acceso a este portal.</p>
      )}
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <form action={accion} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="empresa" value={empresa} />
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="otorgar-estudiante">Dar acceso directo a un estudiante</Label>
          <NativeSelect id="otorgar-estudiante" name="estudiante" required defaultValue="">
            <option value="" disabled>
              Elige el estudiante
            </option>
            {estudiantes
              .filter((s) => !conAcceso.has(s.nombre))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline" disabled={otorgando}>
          {otorgando ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />} Dar acceso
        </Button>
        <div className="w-full">
          <Mensaje estado={estado} />
        </div>
      </form>
    </div>
  );
}
