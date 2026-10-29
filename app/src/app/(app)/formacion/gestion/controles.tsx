"use client";

import { useActionState, useState, useTransition } from "react";
import { Award, Check, Loader2, PlusCircle, X } from "lucide-react";

import { ajustarPuntos, otorgarInsignia, resolverCanje, type Resultado } from "@/app/(app)/formacion/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

type Persona = { id: string; etiqueta: string };

/** Entregar o rechazar un canje (rechazar devuelve los puntos). */
export function ResolverCanje({ id }: { id: string }) {
  const [pendiente, iniciar] = useTransition();
  const [comentario, setComentario] = useState("");
  const [resultado, setResultado] = useState<{ ok?: string; error?: string } | null>(null);

  if (resultado?.ok) return <p className="text-sm font-semibold text-[var(--primario-texto)]">{resultado.ok}</p>;

  const decidir = (estado: "Entregado" | "Rechazado") =>
    iniciar(async () => {
      const r = await resolverCanje({ id, estado, comentario });
      setResultado(r?.error ? { error: r.error } : { ok: estado === "Entregado" ? "Entregado" : "Rechazado · puntos devueltos" });
    });

  return (
    <div className="space-y-2">
      <Input
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        maxLength={300}
        placeholder="Comentario (opcional)"
        aria-label="Comentario para la persona"
        className="h-8 text-sm"
      />
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Button size="sm" disabled={pendiente} onClick={() => decidir("Entregado")}>
          {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} Entregar
        </Button>
        <Button size="sm" variant="outline" disabled={pendiente} onClick={() => decidir("Rechazado")}>
          <X aria-hidden /> Rechazar
        </Button>
      </div>
      {resultado?.error && (
        <p className="text-destructive text-xs" role="alert">
          {resultado.error}
        </p>
      )}
    </div>
  );
}

function Mensaje({ estado }: { estado: Resultado }) {
  if (estado?.error)
    return (
      <p className="text-destructive text-sm" role="alert">
        {estado.error}
      </p>
    );
  if (estado?.aviso)
    return (
      <p className="text-sm font-medium text-[var(--primario-texto)]" role="status">
        {estado.aviso}
      </p>
    );
  return null;
}

function SelectorPersona({ personas, id, valor }: { personas: Persona[]; id: string; valor?: string }) {
  return (
    <NativeSelect id={id} name="id_usuario" required defaultValue={valor ?? ""}>
      <option value="" disabled>
        Elige la persona
      </option>
      {personas.map((p) => (
        <option key={p.id} value={p.id}>
          {p.etiqueta}
        </option>
      ))}
    </NativeSelect>
  );
}

export function FormularioInsignia({ personas, insignias }: { personas: Persona[]; insignias: { id: string; nombre: string }[] }) {
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(otorgarInsignia, undefined);
  const v = estado?.valores ?? {};
  return (
    <form action={accion} className="space-y-3" key={JSON.stringify(estado ?? {})}>
      <div className="space-y-1.5">
        <Label htmlFor="insignia-persona">Persona</Label>
        <SelectorPersona personas={personas} id="insignia-persona" valor={v.id_usuario} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="insignia">Insignia</Label>
        <NativeSelect id="insignia" name="id_insignia" required defaultValue={v.id_insignia ?? ""}>
          <option value="" disabled>
            Elige la insignia
          </option>
          {insignias.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit" disabled={pendiente}>
        {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : <Award aria-hidden />} Otorgar insignia
      </Button>
      <Mensaje estado={estado} />
    </form>
  );
}

export function FormularioAjuste({ personas }: { personas: Persona[] }) {
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(ajustarPuntos, undefined);
  const v = estado?.valores ?? {};
  return (
    <form action={accion} className="space-y-3" key={JSON.stringify(estado ?? {})}>
      <div className="space-y-1.5">
        <Label htmlFor="ajuste-persona">Persona</Label>
        <SelectorPersona personas={personas} id="ajuste-persona" valor={v.id_usuario} />
      </div>
      <div className="grid grid-cols-[7rem_1fr] gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="puntos">Puntos</Label>
          <Input id="puntos" name="puntos" type="number" required min={-1000} max={1000} step={1} defaultValue={v.puntos} placeholder="+50" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="motivo">Motivo</Label>
          <Input id="motivo" name="motivo" required minLength={3} maxLength={200} defaultValue={v.motivo} placeholder="Ej.: Ganó el reto de pitch" />
        </div>
      </div>
      <Button type="submit" variant="outline" disabled={pendiente}>
        {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : <PlusCircle aria-hidden />} Registrar ajuste
      </Button>
      <Mensaje estado={estado} />
    </form>
  );
}
