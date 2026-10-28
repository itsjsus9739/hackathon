"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { Mensaje } from "@/app/login/formulario-acceso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { restablecerContrasena } from "./actions";

export function FormularioRestablecer() {
  const [estado, accion, enviando] = useActionState(restablecerContrasena, undefined);
  return (
    <form action={accion} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="contrasena">Nueva contraseña</Label>
        <Input id="contrasena" name="contrasena" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmacion">Repite la contraseña</Label>
        <Input id="confirmacion" name="confirmacion" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <Mensaje estado={estado} />
      <Button type="submit" className="w-full" disabled={enviando}>
        {enviando && <Loader2 className="animate-spin" aria-hidden />} Guardar contraseña
      </Button>
    </form>
  );
}
