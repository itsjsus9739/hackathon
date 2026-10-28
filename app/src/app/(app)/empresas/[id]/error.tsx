"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Errores inesperados (red, Supabase caído). Una empresa inexistente va a not-found.tsx.
export default function ErrorFicha({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-5xl">
      <Alert variant="destructive">
        <AlertTriangle aria-hidden />
        <AlertTitle>No pudimos cargar la ficha de la empresa</AlertTitle>
        <AlertDescription>
          <p>Revisa tu conexión e inténtalo de nuevo. Si el problema sigue, avisa al equipo del CDE.</p>
          <button
            type="button"
            onClick={reset}
            className="bg-primary text-primary-foreground mt-2 rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90"
          >
            Reintentar
          </button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
