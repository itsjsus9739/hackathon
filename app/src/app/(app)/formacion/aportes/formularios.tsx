"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Loader2, Send, X } from "lucide-react";

import { registrarAporte, revisarAporte, type Resultado } from "@/app/(app)/formacion/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type Opcion = { id: string; nombre: string };

export function FormularioAporte({ proyectos, areas }: { proyectos: Opcion[]; areas: (Opcion & { puntos: number })[] }) {
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(registrarAporte, undefined);
  const v = estado?.valores ?? {};

  return (
    // La llave cambia con cada respuesta: el formulario se rearma con lo escrito (error) o vacío (éxito)
    <form action={accion} className="grid gap-3 sm:grid-cols-2" key={JSON.stringify(estado ?? {})}>
      <div className="space-y-1.5">
        <Label htmlFor="id_proyecto">Proyecto</Label>
        <NativeSelect id="id_proyecto" name="id_proyecto" required defaultValue={v.id_proyecto ?? (proyectos.length === 1 ? proyectos[0].id : "")}>
          <option value="" disabled>
            Elige tu proyecto
          </option>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="id_area">Área</Label>
        <NativeSelect id="id_area" name="id_area" required defaultValue={v.id_area ?? ""}>
          <option value="" disabled>
            Elige el área
          </option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre} (+{a.puntos} pts)
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="descripcion">¿Qué aportaste?</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
          defaultValue={v.descripcion}
          placeholder="Ej.: Diseñé la página de inicio de la tienda en línea y la conecté con el catálogo."
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="evidencia_url">Enlace de evidencia (opcional)</Label>
        <Input id="evidencia_url" name="evidencia_url" type="url" defaultValue={v.evidencia_url} placeholder="https://drive.google.com/…" />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />} Enviar aporte
        </Button>
        {estado?.error && (
          <p className="text-destructive text-sm" role="alert">
            {estado.error}
          </p>
        )}
        {estado?.aviso && (
          <p className="text-sm font-medium text-[var(--primario-texto)]" role="status">
            {estado.aviso}
          </p>
        )}
      </div>
    </form>
  );
}

/** Validar o rechazar un aporte (docente del proyecto o CDE). El comentario es opcional al validar. */
export function RevisionAporte({ id, puntos }: { id: string; puntos: number }) {
  const [pendiente, iniciar] = useTransition();
  const [comentario, setComentario] = useState("");
  const [resultado, setResultado] = useState<Resultado>(undefined);

  if (resultado?.aviso)
    return (
      <p className="text-sm font-semibold text-[var(--primario-texto)]" role="status">
        {resultado.aviso}
      </p>
    );

  const decidir = (estado: "Validado" | "Rechazado") =>
    iniciar(async () => setResultado(await revisarAporte({ id, estado, comentario })));

  return (
    <div className="space-y-2">
      <Input
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        maxLength={500}
        placeholder="Comentario para el estudiante (opcional)"
        aria-label="Comentario de la revisión"
        className="h-8 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pendiente} onClick={() => decidir("Validado")}>
          {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} Validar (+{puntos})
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
