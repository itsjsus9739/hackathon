"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Mensaje } from "@/app/login/formulario-acceso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { solicitarRecuperacion } from "./actions";

export function FormularioRecuperar() {
  const [estado, accion, enviando] = useActionState(solicitarRecuperacion, undefined);

  return (
    <div className="space-y-4">
      {estado?.aviso ? (
        <Mensaje estado={estado} />
      ) : (
        <form action={accion} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="correo">Correo de tu cuenta</Label>
            <Input id="correo" name="correo" type="email" autoComplete="email" required />
          </div>
          <Mensaje estado={estado} />
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando && <Loader2 className="animate-spin" aria-hidden />} Enviar enlace
          </Button>
        </form>
      )}
      <p className="text-muted-foreground text-center text-sm">
        <Link href="/login" className="text-foreground font-medium underline underline-offset-4">
          Volver a ingresar
        </Link>
      </p>
    </div>
  );
}
