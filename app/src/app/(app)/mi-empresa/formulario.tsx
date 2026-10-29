"use client";

import { useActionState } from "react";
import { CircleCheck, Loader2, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { actualizarMiEmpresa } from "./actions";

export type MiEmpresa = {
  id: string;
  nombre: string;
  nit: string | null;
  sector: string | null;
  tamano: string | null;
  municipio: string | null;
  formalizacion: string | null;
  descripcion: string | null;
  estimados: string[];
};

export function FormularioMiEmpresa({ empresa: e, sectores, tamanos }: { empresa: MiEmpresa; sectores: string[]; tamanos: readonly string[] }) {
  const [estado, accion, enviando] = useActionState(actualizarMiEmpresa, undefined);
  const estimado = (campo: string) =>
    e.estimados.includes(campo) ? <span className="text-xs font-normal text-amber-700"> (estimado por el CDE: confírmalo)</span> : null;

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="empresa" value={e.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`sector-${e.id}`}>Sector{estimado("sector")}</Label>
          <NativeSelect id={`sector-${e.id}`} name="sector" defaultValue={e.sector ?? ""}>
            <option value="">Sin definir</option>
            {sectores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`tamano-${e.id}`}>Tamaño{estimado("tamano")}</Label>
          <NativeSelect id={`tamano-${e.id}`} name="tamano" defaultValue={e.tamano ?? ""}>
            <option value="">Sin definir</option>
            {tamanos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`municipio-${e.id}`}>Municipio</Label>
          <Input id={`municipio-${e.id}`} name="municipio" defaultValue={e.municipio ?? ""} maxLength={120} placeholder="Ej. Bucaramanga" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`formalizacion-${e.id}`}>Formalización</Label>
          <NativeSelect id={`formalizacion-${e.id}`} name="formalizacion" defaultValue={e.formalizacion ?? ""}>
            <option value="">Sin definir</option>
            <option value="Formal">Formal (con registro mercantil)</option>
            <option value="En proceso">En proceso</option>
            <option value="Informal">Informal</option>
          </NativeSelect>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`nit-${e.id}`}>NIT</Label>
          {e.nit ? (
            <>
              <Input id={`nit-${e.id}`} value={e.nit} disabled />
              <p className="text-muted-foreground text-xs">Para corregir el NIT, escríbele al CDE.</p>
            </>
          ) : (
            <Input id={`nit-${e.id}`} name="nit" inputMode="numeric" placeholder="Solo números, sin dígito de verificación" maxLength={20} />
          )}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`descripcion-${e.id}`}>Productos y servicios</Label>
          <Textarea
            id={`descripcion-${e.id}`}
            name="descripcion"
            defaultValue={e.descripcion ?? ""}
            maxLength={2000}
            placeholder="Qué vende tu empresa, a quién y cómo"
          />
        </div>
      </div>
      {estado?.error && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertDescription>{estado.error}</AlertDescription>
        </Alert>
      )}
      {estado?.ok && (
        <Alert>
          <CircleCheck aria-hidden />
          <AlertDescription>{estado.ok}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={enviando}>
          {enviando && <Loader2 className="animate-spin" aria-hidden />} Guardar datos
        </Button>
      </div>
    </form>
  );
}
