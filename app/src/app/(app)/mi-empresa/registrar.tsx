"use client";

import { useActionState, useState } from "react";
import { CircleCheck, Loader2, Plus, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { solicitarEmpresa } from "./actions";

/** El emprendedor envía los datos de su empresa; un admin del CDE confirma que le pertenece. */
export function RegistrarEmpresa({ sectores, tamanos, abierto = false }: { sectores: string[]; tamanos: readonly string[]; abierto?: boolean }) {
  const [estado, accion, enviando] = useActionState(solicitarEmpresa, undefined);
  const [mostrar, setMostrar] = useState(abierto);

  if (!mostrar) {
    return (
      <Button variant="outline" onClick={() => setMostrar(true)}>
        <Plus aria-hidden /> Registrar otra empresa
      </Button>
    );
  }

  return (
    <form action={accion} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="nombre-nueva">Nombre de la empresa o emprendimiento</Label>
          <Input id="nombre-nueva" name="nombre" required minLength={2} maxLength={200} placeholder="Ej. Panadería La Espiga" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nit-nueva">NIT (si lo tiene)</Label>
          <Input id="nit-nueva" name="nit" inputMode="numeric" maxLength={20} placeholder="Solo números" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cargo-nueva">Tu cargo</Label>
          <Input id="cargo-nueva" name="cargo" maxLength={120} placeholder="Ej. Gerente, fundadora" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sector-nueva">Sector</Label>
          <NativeSelect id="sector-nueva" name="sector" defaultValue="">
            <option value="">Sin definir</option>
            {sectores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tamano-nueva">Tamaño</Label>
          <NativeSelect id="tamano-nueva" name="tamano" defaultValue="">
            <option value="">Sin definir</option>
            {tamanos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="municipio-nueva">Municipio</Label>
          <Input id="municipio-nueva" name="municipio" maxLength={120} placeholder="Ej. Bucaramanga" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="descripcion-nueva">Productos y servicios</Label>
          <Textarea id="descripcion-nueva" name="descripcion" maxLength={2000} placeholder="Qué vende tu empresa, a quién y cómo" />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Si tu empresa ya está en la base del CDE (mismo NIT o nombre), el administrador confirmará que te pertenece y quedará
        vinculada a tu cuenta. Si es nueva, la crea al aprobarla.
      </p>
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
          {enviando && <Loader2 className="animate-spin" aria-hidden />} Enviar al CDE
        </Button>
      </div>
    </form>
  );
}
