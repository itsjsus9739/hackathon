import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { obtenerSesion } from "@/lib/sesion";
import { FormularioRestablecer } from "./formulario-restablecer";

export const metadata: Metadata = { title: "Nueva contraseña · CDE Conecta" };

// Se llega desde el enlace del correo: /auth/confirm abre una sesión temporal y redirige aquí
export default async function PaginaRestablecer() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login?error=enlace");

  return (
    <main className="bg-[var(--panel)] flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-primario text-sm font-semibold">CDE Conecta · UNAB</p>
          <CardTitle className="text-xl">Crea una nueva contraseña</CardTitle>
          <CardDescription>Para {sesion.correo}</CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioRestablecer />
        </CardContent>
      </Card>
    </main>
  );
}
