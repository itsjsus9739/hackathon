import type { Metadata } from "next";

import { LogoCde } from "@/components/marca/logo-cde";
import { FormularioVerificar } from "./formulario";

export const metadata: Metadata = { title: "Verificar certificado · CDE Nest" };

// Página pública: escribir el código de un certificado del CDE para comprobarlo.
export default function PaginaVerificarInicio() {
  return (
    <main className="bg-background flex min-h-screen flex-col items-center px-4 py-10">
      <LogoCde className="w-48" priority />
      <div className="bg-card mt-6 w-full max-w-lg space-y-3 rounded-3xl border p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Verificar un certificado</h1>
        <p className="text-muted-foreground text-sm">Escribe el código que aparece en el certificado (arriba a la derecha) o escanea su código QR.</p>
        <FormularioVerificar />
      </div>
    </main>
  );
}
