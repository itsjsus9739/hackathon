import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { AREAS_DIAGNOSTICO, ZONA_HORARIA } from "./constantes";

export { AREAS_DIAGNOSTICO, ZONA_HORARIA };

export type EmpresaFicha = Pick<
  Tables<"empresas">,
  | "id"
  | "nombre"
  | "nit"
  | "nit_dv"
  | "sector"
  | "tamano"
  | "formalizacion"
  | "municipio"
  | "departamento"
  | "vinculo_unab"
  | "descripcion"
  | "datos_estimados"
>;

export type Diagnostico = Pick<
  Tables<"diagnosticos">,
  | "fecha"
  | "tipo_iniciativa"
  | "estrategia"
  | "mercadeo_ventas"
  | "financiera"
  | "normativa_legal"
  | "productividad"
  | "transformacion_digital"
  | "promedio"
  | "nivel"
>;

export type Postulacion = Pick<Tables<"postulaciones">, "id" | "estado" | "origen" | "origen_registro">;

// Cada área del catálogo debe ser una columna del diagnóstico
AREAS_DIAGNOSTICO satisfies readonly { campo: keyof Diagnostico; nombre: string }[];

export type TipoHito = "proyecto_aula" | "plan_accion" | "cita" | "diagnostico" | "evento" | "atencion";

export type Hito = {
  id: string;
  tipo: TipoHito;
  fecha: string;
  titulo: string;
  detalle: string | null;
  estado: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(valor: string): boolean {
  return UUID.test(valor);
}

/**
 * Empresa + línea de tiempo. Devuelve null si el id no existe o si el usuario no tiene
 * permiso de verla (RLS): para quien consulta, ambos casos son "no encontrada".
 * cache() evita repetir las consultas entre generateMetadata y la página.
 */
export const obtenerFicha = cache(async (id: string) => {
  if (!esUuid(id)) return null;
  const supabase = await crearClienteServidor();

  const [empresa, historial, diagnostico, postulaciones] = await Promise.all([
    supabase
      .from("empresas")
      .select("id, nombre, nit, nit_dv, sector, tamano, formalizacion, municipio, departamento, vinculo_unab, descripcion, datos_estimados")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("historial_empresa")
      .select("id_registro, tipo, fecha, titulo, detalle, estado")
      .eq("id_empresa", id)
      .order("fecha", { ascending: true }),
    supabase
      .from("diagnosticos")
      .select(
        "fecha, tipo_iniciativa, estrategia, mercadeo_ventas, financiera, normativa_legal, productividad, transformacion_digital, promedio, nivel",
      )
      .eq("id_empresa", id)
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Docentes y estudiantes no ven postulaciones (RLS): reciben una lista vacía
    supabase.from("postulaciones").select("id, estado, origen, origen_registro").eq("id_empresa", id),
  ]);

  if (empresa.error) throw new Error(`No se pudo consultar la empresa: ${empresa.error.message}`);
  if (historial.error) throw new Error(`No se pudo consultar el historial: ${historial.error.message}`);
  if (diagnostico.error) throw new Error(`No se pudo consultar el diagnóstico: ${diagnostico.error.message}`);
  if (postulaciones.error) throw new Error(`No se pudo consultar las postulaciones: ${postulaciones.error.message}`);
  if (!empresa.data) return null;

  const hitos: Hito[] = (historial.data ?? [])
    .filter((h) => h.id_registro && h.tipo && h.fecha)
    .map((h) => ({
      id: h.id_registro!,
      tipo: h.tipo as TipoHito,
      fecha: h.fecha!,
      titulo: h.titulo ?? "Sin título",
      detalle: h.detalle,
      estado: h.estado,
    }));

  return {
    empresa: empresa.data as EmpresaFicha,
    hitos,
    diagnostico: diagnostico.data as Diagnostico | null,
    postulaciones: (postulaciones.data ?? []) as Postulacion[],
  };
});

/** Agrupa los hitos (ya ordenados) por mes, p. ej. "agosto de 2026". */
export function agruparPorMes(hitos: Hito[]): { mes: string; hitos: Hito[] }[] {
  const formato = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: ZONA_HORARIA });
  const grupos: { mes: string; hitos: Hito[] }[] = [];
  for (const hito of hitos) {
    const mes = formato.format(new Date(hito.fecha));
    const ultimo = grupos.at(-1);
    if (ultimo?.mes === mes) ultimo.hitos.push(hito);
    else grupos.push({ mes, hitos: [hito] });
  }
  return grupos;
}

const formatoDia = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: ZONA_HORARIA });
const formatoHora = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: ZONA_HORARIA });
const formato24h = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ZONA_HORARIA });

/** "18 de ago" para hitos sin hora (llegan a medianoche de Bogotá) o "3 de nov · 10:00 a. m." para citas. */
export function fechaLegible(iso: string): string {
  const fecha = new Date(iso);
  const sinHora = formato24h.format(fecha) === "00:00";
  return sinHora ? formatoDia.format(fecha) : `${formatoDia.format(fecha)} · ${formatoHora.format(fecha)}`;
}

/** Área con el puntaje más bajo: la mayor brecha frente al máximo (5). */
export function mayorBrecha(d: Diagnostico): (typeof AREAS_DIAGNOSTICO)[number] {
  return AREAS_DIAGNOSTICO.reduce((peor, area) => (Number(d[area.campo]) < Number(d[peor.campo]) ? area : peor));
}

export function contarPorTipo(hitos: Hito[]): Record<TipoHito, number> {
  const conteo: Record<TipoHito, number> = { proyecto_aula: 0, plan_accion: 0, cita: 0, diagnostico: 0, evento: 0, atencion: 0 };
  for (const h of hitos) conteo[h.tipo] = (conteo[h.tipo] ?? 0) + 1;
  return conteo;
}
