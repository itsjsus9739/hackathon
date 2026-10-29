import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { EmpresaExistente } from "@/lib/importacion";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { Importador } from "./importador";

export const metadata: Metadata = { title: "Importar y depurar · CDE Conecta" };

export default async function PaginaImportar() {
  const sesion = await obtenerSesion();
  // El emprendedor no importa bases: actualiza los datos de su propia empresa
  if (sesion?.rol === "emprendedor") redirect("/mi-empresa");
  if (!sesion || !["cde", "admin_cde"].includes(sesion.rol)) {
    return (
      <Alert className="mx-auto max-w-xl">
        <ShieldAlert aria-hidden />
        <AlertTitle>Solo para el equipo del CDE</AlertTitle>
        <AlertDescription>La importación de bases de empresas la hacen los miembros del CDE.</AlertDescription>
      </Alert>
    );
  }

  const supabase = await crearClienteServidor();
  const [{ data: sectores, error: errorSectores }, { data: empresas, error: errorEmpresas }] = await Promise.all([
    supabase.from("sectores").select("nombre").order("nombre"),
    supabase
      .from("empresas")
      .select("id, nombre, nit, nit_dv, sector, tamano, municipio, departamento, vinculo_unab, contactos_empresa (correo, telefono)")
      .order("nombre"),
  ]);
  if (errorSectores || errorEmpresas) {
    throw new Error(`No se pudo leer la base actual: ${(errorSectores ?? errorEmpresas)!.message}`);
  }

  // Para comparar contra la base: el primer correo y celular conocidos de cada empresa
  const existentes: EmpresaExistente[] = (empresas ?? []).map(({ contactos_empresa: contactos, ...e }) => ({
    ...e,
    correo: contactos.find((c) => c.correo)?.correo ?? null,
    telefono: contactos.find((c) => c.telefono)?.telefono ?? null,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Importar y depurar</h1>
        <p className="text-muted-foreground text-sm">
          Sube la base del CDE (Excel o CSV): validamos cada NIT con su dígito de verificación, detectamos duplicados por NIT,
          correo, celular o nombre parecido —también contra las {existentes.length} empresas que ya están en la base— y
          fusionas antes de guardar.
        </p>
      </div>
      <Importador sectores={(sectores ?? []).map((s) => s.nombre)} existentes={existentes} />
    </div>
  );
}
