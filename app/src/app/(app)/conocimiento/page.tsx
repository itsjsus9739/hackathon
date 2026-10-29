import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";

import { Tablero } from "@/components/conocimiento/tablero";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  brechasPorArea,
  calidadDatos,
  contarPor,
  formalizacionEstimada,
  type DiagnosticoFila,
  type EmpresaResumen,
} from "@/lib/conocimiento";
import { avancePorEje, resumenBrechas } from "@/lib/impacto";
import { Constants } from "@/lib/supabase/database.types";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conocimiento · CDE Conecta" };

export default async function PaginaConocimiento() {
  const sesion = await obtenerSesion();
  if (!sesion || !["cde", "admin_cde"].includes(sesion.rol)) {
    return (
      <Alert className="mx-auto max-w-xl">
        <ShieldAlert aria-hidden />
        <AlertTitle>Solo para el equipo del CDE</AlertTitle>
        <AlertDescription>El tablero de conocimiento analiza toda la base de empresas del CDE.</AlertDescription>
      </Alert>
    );
  }
  const supabase = await crearClienteServidor();
  const [empresas, diagnosticos, postulaciones, proyectos, atenciones, brechasEmpresas, evolucion] = await Promise.all([
    supabase
      .from("empresas")
      .select("nit, sector, tamano, formalizacion, municipio, vinculo_unab, id_representante, datos_estimados, contactos_empresa (count)"),
    supabase
      .from("diagnosticos")
      .select(
        "id_empresa, fecha, creado_en, es_ejemplo, estrategia, mercadeo_ventas, financiera, normativa_legal, productividad, transformacion_digital",
      ),
    supabase.from("postulaciones").select("estado"),
    supabase.from("proyectos_aula").select("*", { count: "exact", head: true }),
    supabase.from("atenciones").select("*", { count: "exact", head: true }),
    supabase.from("brechas_empresa").select("cerrada_en, es_ejemplo, catalogo_brechas (area, descripcion)"),
    supabase.from("evolucion_diagnosticos").select("*"),
  ]);
  for (const r of [empresas, diagnosticos, postulaciones, proyectos, atenciones, brechasEmpresas, evolucion]) {
    if (r.error) throw new Error(`No se pudo consultar el tablero: ${r.error.message}`);
  }

  const lista: EmpresaResumen[] = (empresas.data ?? []).map(({ contactos_empresa: c, ...e }) => ({
    ...e,
    contactos: c[0]?.count ?? 0,
  }));
  const calidad = calidadDatos(lista);
  const porSector = contarPor(lista, (e) => e.sector, { maximo: 8 });
  const porTamano = contarPor(lista, (e) => e.tamano, { orden: Constants.public.Enums.tamano_empresa });
  const porMunicipio = contarPor(lista, (e) => e.municipio, { maximo: 6 });
  const porFormalizacion = contarPor(lista, formalizacionEstimada);
  const formalizacionRegistrada = lista.some((e) => e.formalizacion);
  const porPostulacion = contarPor(postulaciones.data ?? [], (p) => p.estado);

  const diags = diagnosticos.data ?? [];
  const brechas = brechasPorArea(diags as DiagnosticoFila[]);
  const ejemplos = diags.filter((d) => d.es_ejemplo).length;
  const masDebil = brechas.barras.reduce<(typeof brechas.barras)[number] | null>(
    (peor, b) => (!peor || b.valor < peor.valor ? b : peor),
    null,
  );

  // Impacto: brechas cerradas sobre la misma lista con que se detectaron, y avance entre diagnósticos
  const filasBrechas = (brechasEmpresas.data ?? [])
    .filter((b) => b.catalogo_brechas)
    .map((b) => ({ area: b.catalogo_brechas!.area, descripcion: b.catalogo_brechas!.descripcion, cerrada_en: b.cerrada_en }));
  const cierre = resumenBrechas(filasBrechas);
  const avance = avancePorEje(evolucion.data ?? []);
  const impactoEjemplo =
    (brechasEmpresas.data ?? []).some((b) => b.es_ejemplo) || (evolucion.data ?? []).some((e) => e.es_ejemplo);

  return (
    <Tablero
      datos={{
        totalEmpresas: lista.length,
        estimados: {
          sector: lista.filter((e) => e.datos_estimados.includes("sector")).length,
          tamano: lista.filter((e) => e.datos_estimados.includes("tamano")).length,
        },
        calidad,
        brechas,
        masDebil,
        ejemplos,
        porSector,
        porTamano,
        porMunicipio,
        porFormalizacion,
        formalizacionRegistrada,
        porPostulacion,
        postulaciones: postulaciones.data?.length ?? 0,
        proyectos: proyectos.count ?? 0,
        atenciones: atenciones.count ?? 0,
        impacto: {
          brechas: cierre,
          cerradasPorArea: cierre.areas.map((a) => ({ etiqueta: a.area, valor: a.porcentaje })),
          avance,
          ejemplo: impactoEjemplo,
        },
      }}
    />
  );
}
