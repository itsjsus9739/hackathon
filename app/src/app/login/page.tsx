import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { obtenerSesion } from "@/lib/sesion";
import { FormularioIngreso, FormularioRegistro } from "./formulario-acceso";

export const metadata: Metadata = { title: "Ingresar · CDE Conecta" };

const ERRORES_ENLACE: Record<string, string> = {
  enlace: "El enlace de confirmación no es válido o ya venció. Ingresa o regístrate de nuevo.",
};

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ modo?: string; error?: string }> }) {
  const { modo, error } = await searchParams;
  if (await obtenerSesion()) redirect("/");
  const registro = modo === "registro";

  return (
    <main className="bg-[var(--panel)] flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-primario text-sm font-semibold">CDE Conecta · UNAB</p>
          <CardTitle className="text-xl">{registro ? "Crea tu cuenta" : "Ingresa"}</CardTitle>
          <CardDescription>
            {registro
              ? "Con correo @unab.edu.co entras al confirmar tu correo; con otro correo, el CDE aprueba tu acceso."
              : "Centro de Desarrollo Empresarial de la Universidad Autónoma de Bucaramanga."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && ERRORES_ENLACE[error] && (
            <p className="text-destructive text-sm" role="alert">
              {ERRORES_ENLACE[error]}
            </p>
          )}
          {registro ? <FormularioRegistro /> : <FormularioIngreso />}
        </CardContent>
      </Card>
    </main>
  );
}
