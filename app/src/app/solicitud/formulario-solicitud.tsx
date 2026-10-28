"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { actualizarSolicitud } from "./actions";

export function FormularioSolicitud({ rol, motivo }: { rol: string; motivo: string }) {
  const [estado, accion, enviando] = useActionState(actualizarSolicitud, undefined);
  return (
    <form action={accion} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="rol_solicitado">Soy</Label>
        <NativeSelect id="rol_solicitado" name="rol_solicitado" defaultValue={rol}>
          <option value="emprendedor">Emprendedor/a o empresario/a</option>
          <option value="estudiante">Estudiante</option>
          <option value="docente">Docente</option>
        </NativeSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor="motivo">¿Quién eres y para qué necesitas acceso?</Label>
        <Textarea id="motivo" name="motivo" defaultValue={motivo} required minLength={20} maxLength={2000} />
      </div>
      {estado?.error && (
        <p className="text-destructive text-sm" role="alert">
          {estado.error}
        </p>
      )}
      {estado?.aviso && (
        <p className="text-sm text-emerald-700" role="status">
          {estado.aviso}
        </p>
      )}
      <Button type="submit" variant="outline" disabled={enviando}>
        {enviando && <Loader2 className="animate-spin" aria-hidden />} Guardar cambios
      </Button>
    </form>
  );
}
