import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormularioRecuperar } from "./formulario-recuperar";

export const metadata: Metadata = { title: "Recuperar contraseña · CDE Conecta" };

export default function PaginaRecuperar() {
  return (
    <main className="bg-[var(--panel)] flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-primario text-sm font-semibold">CDE Conecta · UNAB</p>
          <CardTitle className="text-xl">¿Olvidaste tu contraseña?</CardTitle>
          <CardDescription>Escribe tu correo y te enviaremos un enlace para crear una nueva.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioRecuperar />
        </CardContent>
      </Card>
    </main>
  );
}
