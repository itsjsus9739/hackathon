"use client";

import { useActionState } from "react";
import { CircleCheck, Loader2, Send, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { solicitarEmpresa } from "./actions";

/** El emprendedor registra su empresa; un administrador del CDE la confirma (o la vincula si ya existe). */
export function FormularioRegistrarEmpresa({ sectores, tamanos }: { sectores: string[]; tamanos: readonly string[] }) {
  const [estado, accion, enviando] = useActionState(solicitarEmpresa, undefined);
  const v = estado?.valores ?? {};

  return (
    // Con cada respuesta se rearma: conserva lo escrito si hubo error y queda vacío si se envió
    <form action={accion} className="space-y-4" key={JSON.stringify(estado ?? {})}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="registro-nombre">Nombre de la empresa</Label>
          <Input id="registro-nombre" name="nombre" required minLength={2} maxLength={200} defaultValue={v.nombre} placeholder="Ej.: Café La Montaña S.A.S." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="registro-nit">NIT (opcional)</Label>
          <Input id="registro-nit" name="nit" inputMode="numeric" maxLength={20} defaultValue={v.nit} placeholder="900.123.456-7" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="registro-cargo">Tu cargo (opcional)</Label>
          <Input id="registro-cargo" name="cargo" maxLength={120} defaultValue={v.cargo} placeholder="Gerente, fundadora…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="registro-sector">Sector</Label>
          <NativeSelect id="registro-sector" name="sector" defaultValue={v.sector ?? ""}>
            <option value="">Sin definir</option>
            {sectores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="registro-tamano">Tamaño</Label>
          <NativeSelect id="registro-tamano" name="tamano" defaultValue={v.tamano ?? ""}>
            <option value="">Sin definir</option>
            {tamanos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="registro-municipio">Municipio</Label>
          <Input id="registro-municipio" name="municipio" maxLength={120} defaultValue={v.municipio} placeholder="Bucaramanga" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="registro-descripcion">¿A qué se dedica? (opcional)</Label>
          <Textarea id="registro-descripcion" name="descripcion" rows={2} maxLength={2000} defaultValue={v.descripcion} />
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
      <Button type="submit" disabled={enviando}>
        {enviando ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />} Enviar para confirmar
      </Button>
    </form>
  );
}
