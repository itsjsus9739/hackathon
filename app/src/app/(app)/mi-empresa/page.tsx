import type { Metadata } from "next";
import { Building2, ShieldAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { obtenerSesion } from "@/lib/sesion";
import { Constants } from "@/lib/supabase/database.types";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioMiEmpresa } from "./formulario";

export const metadata: Metadata = { title: "Actualizar datos empresariales · CDE Conecta" };

// El emprendedor revisa y actualiza los datos de su empresa (en vez de importar bases, que es del CDE)
export default async function PaginaMiEmpresa() {
  const sesion = await obtenerSesion();
  if (sesion?.rol !== "emprendedor") {
    return (
      <Alert className="mx-auto max-w-xl">
        <ShieldAlert aria-hidden />
        <AlertTitle>Solo para emprendedores</AlertTitle>
        <AlertDescription>Aquí cada emprendedor actualiza los datos de su propia empresa.</AlertDescription>
      </Alert>
    );
  }

  const supabase = await crearClienteServidor();
  // RLS: el emprendedor solo recibe las empresas que representa o en las que es contacto
  const [empresas, sectores] = await Promise.all([
    supabase.from("empresas").select("id, nombre, nit, sector, tamano, municipio, formalizacion, descripcion, datos_estimados").order("nombre"),
    supabase.from("sectores").select("nombre").order("nombre"),
  ]);
  for (const r of [empresas, sectores]) {
    if (r.error) throw new Error(`No se pudieron consultar tus datos: ${r.error.message}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Actualizar datos empresariales</h1>
        <p className="text-muted-foreground text-sm">
          Mantén al día los datos de tu empresa: así el CDE te ofrece el acompañamiento, las capacitaciones y los eventos que
          te sirven.
        </p>
      </div>
      {!empresas.data?.length ? (
        <Alert>
          <Building2 aria-hidden />
          <AlertTitle>Tu cuenta aún no está vinculada a una empresa</AlertTitle>
          <AlertDescription>Pídele al CDE que te registre como representante o contacto de tu empresa.</AlertDescription>
        </Alert>
      ) : (
        empresas.data.map((e) => (
          <Card key={e.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-5" aria-hidden /> {e.nombre}
              </CardTitle>
              <CardDescription>El CDE recibe un aviso cuando guardas cambios.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormularioMiEmpresa
                empresa={{ ...e, estimados: e.datos_estimados }}
                sectores={(sectores.data ?? []).map((s) => s.nombre)}
                tamanos={Constants.public.Enums.tamano_empresa}
              />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
