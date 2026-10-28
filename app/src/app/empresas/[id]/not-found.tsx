import Link from "next/link";
import { SearchX } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function EmpresaNoEncontrada() {
  return (
    <div className="mx-auto max-w-5xl">
      <Alert>
        <SearchX aria-hidden />
        <AlertTitle>Empresa no encontrada</AlertTitle>
        <AlertDescription>
          <p>No existe una empresa con ese identificador o no tienes permiso para verla.</p>
          <Link href="/empresas" className="text-foreground mt-1 text-sm font-medium underline underline-offset-4">
            Volver al listado de empresas
          </Link>
        </AlertDescription>
      </Alert>
    </div>
  );
}
