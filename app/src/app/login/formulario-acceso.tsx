"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CircleCheck, Loader2, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { iniciarSesion, registrarse } from "./actions";

export function Mensaje({ estado }: { estado: { error?: string; aviso?: string } | undefined }) {
  if (estado?.error)
    return (
      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertDescription>{estado.error}</AlertDescription>
      </Alert>
    );
  if (estado?.aviso)
    return (
      <Alert>
        <CircleCheck aria-hidden className="text-emerald-600" />
        <AlertDescription>{estado.aviso}</AlertDescription>
      </Alert>
    );
  return null;
}

export function FormularioIngreso() {
  const [estado, accion, enviando] = useActionState(iniciarSesion, undefined);
  return (
    <form action={accion} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="correo">Correo</Label>
        <Input id="correo" name="correo" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="contrasena">Contraseña</Label>
          <Link href="/recuperar" className="text-muted-foreground text-xs underline-offset-4 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <Input id="contrasena" name="contrasena" type="password" autoComplete="current-password" required />
      </div>
      <Mensaje estado={estado} />
      <Button type="submit" className="w-full" disabled={enviando}>
        {enviando && <Loader2 className="animate-spin" aria-hidden />} Ingresar
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        ¿No tienes cuenta?{" "}
        <Link href="/login?modo=registro" className="text-foreground font-medium underline underline-offset-4">
          Regístrate
        </Link>
      </p>
    </form>
  );
}

export function FormularioRegistro() {
  const [estado, accion, enviando] = useActionState(registrarse, undefined);
  const [correo, setCorreo] = useState("");
  const institucional = /@unab\.edu\.co$/i.test(correo.trim());

  if (estado?.aviso) return <Mensaje estado={estado} />;

  return (
    <form action={accion} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre completo</Label>
        <Input id="nombre" name="nombre" autoComplete="name" required minLength={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="correo">Correo</Label>
        <Input
          id="correo"
          name="correo"
          type="email"
          autoComplete="email"
          required
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          {institucional
            ? "Correo UNAB: tu acceso se activa al confirmar el correo."
            : "Con un correo que no es @unab.edu.co, el CDE revisará tu solicitud antes de darte acceso."}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contrasena">Contraseña</Label>
        <Input id="contrasena" name="contrasena" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rol_solicitado">Soy</Label>
        <NativeSelect id="rol_solicitado" name="rol_solicitado" defaultValue="emprendedor">
          <option value="emprendedor">Emprendedor/a o empresario/a</option>
          <option value="estudiante">Estudiante</option>
          <option value="docente">Docente</option>
        </NativeSelect>
      </div>
      {!institucional && (
        <div className="space-y-2">
          <Label htmlFor="motivo">¿Quién eres y para qué necesitas acceso?</Label>
          <Textarea
            id="motivo"
            name="motivo"
            required
            minLength={20}
            maxLength={2000}
            placeholder="Ej.: Soy la representante legal de Agencia de Viajes Ecotours (NIT 634433171) y participo en un proyecto de aula."
          />
        </div>
      )}
      <Mensaje estado={estado} />
      <Button type="submit" className="w-full" disabled={enviando}>
        {enviando && <Loader2 className="animate-spin" aria-hidden />} Crear cuenta
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-foreground font-medium underline underline-offset-4">
          Ingresa
        </Link>
      </p>
    </form>
  );
}
