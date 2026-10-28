import type { Metadata } from "next";
import { ShieldAlert, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { asistenteConfigurado, modeloEnUso, variablesFaltantes } from "@/lib/ia/asistente";
import { obtenerSesion } from "@/lib/sesion";
import { Asistente } from "./asistente";

export const metadata: Metadata = { title: "Asistente IA · CDE Conecta" };
// Una pregunta puede requerir varias consultas: se da margen a la función en Vercel
export const maxDuration = 60;

export default async function PaginaAsistente() {
  const sesion = await obtenerSesion();
  if (!sesion || !["cde", "admin_cde"].includes(sesion.rol)) {
    return (
      <Alert className="mx-auto max-w-xl">
        <ShieldAlert aria-hidden />
        <AlertTitle>Solo para el equipo del CDE</AlertTitle>
        <AlertDescription>El asistente consulta toda la base del CDE.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Sparkles className="text-primario size-6" aria-hidden /> Pregúntale a tus datos
        </h1>
        <p className="text-muted-foreground text-sm">
          Escribe en español lo que quieres saber. El asistente consulta la base con un usuario de solo lectura, sin acceso a
          documentos de identidad, correos ni teléfonos, y te muestra cómo calculó cada cifra.
        </p>
        {asistenteConfigurado() && <p className="text-muted-foreground mt-1 text-xs">Modelo: {modeloEnUso()}</p>}
      </div>
      {asistenteConfigurado() ? (
        <Asistente />
      ) : (
        <Alert>
          <ShieldAlert aria-hidden />
          <AlertTitle>Falta configurar el asistente</AlertTitle>
          <AlertDescription>
            <p>
              Al servidor le {variablesFaltantes().length === 1 ? "falta la variable" : "faltan las variables"}{" "}
              <b>{variablesFaltantes().join(" y ")}</b>.
            </p>
            <p>
              Agrégala en Vercel → Settings → Environment Variables (entorno Production) y luego haz Redeploy: las
              variables solo se aplican en un despliegue nuevo.
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
