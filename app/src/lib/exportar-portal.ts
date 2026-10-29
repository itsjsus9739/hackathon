import * as XLSX from "xlsx";

import { AREAS_DIAGNOSTICO } from "@/lib/constantes";
import { calcularNivel } from "@/lib/gamificacion";
import { compromisosPendientes, ejesAMejorar, leerDiagnostico, nombreEje, rutaAcompanamiento, type PortalDatos } from "@/lib/portal";

// Exportación del portal a Excel: un libro editable (celdas con números y fechas reales, filtros,
// sin bloqueos ni imágenes) con una hoja por sección. Varias empresas van en las mismas hojas,
// una fila por registro y la columna «Empresa», para poder filtrar y consolidar.

type Fila = Record<string, string | number | boolean | Date | null>;

/** "2026-10-19" → fecha de Excel (mediodía, para que ninguna zona horaria la corra de día). */
const dia = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`) : null);
/** Fecha y hora en Bogotá como fecha de Excel (sin zona: Excel no la maneja). */
const momento = (iso: string | null | undefined) => {
  if (!iso) return null;
  const local = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  return new Date(`${local.replace(" ", "T")}:00Z`);
};
const siNo = (v: boolean) => (v ? "Sí" : "No");

export function resumenEmpresa(d: PortalDatos): Fila {
  const etapa = rutaAcompanamiento(d).find((e) => e.estado === "actual");
  const diag = leerDiagnostico(d.diagnosticos);
  const pendientes = compromisosPendientes(d.planes);
  const ejes = ejesAMejorar(d);
  const e = d.empresa;
  return {
    Empresa: e.nombre,
    NIT: e.nit,
    Sector: e.sector,
    Tamaño: e.tamano,
    Formalización: e.formalizacion,
    Municipio: e.municipio,
    Departamento: e.departamento,
    "Vínculo UNAB": e.vinculo_unab,
    "Productos y servicios": e.descripcion,
    Emprendedor: e.representante,
    Mentor: e.mentor,
    "Datos estimados por el CDE": e.datos_estimados.join(", ") || null,
    "Etapa actual": etapa?.nombre ?? "Ruta completa",
    "Último diagnóstico": dia(diag?.ultimo.fecha),
    "Madurez (1-5)": diag ? Number(diag.ultimo.promedio) : null,
    Nivel: diag?.ultimo.nivel ?? null,
    "Cambio desde el primer diagnóstico": diag?.cambio ?? null,
    "Área a mejorar prioritaria": ejes[0] ? nombreEje(ejes[0]) : null,
    "Planes de acción": d.planes.length,
    "Compromisos pendientes": pendientes.length,
    "Compromisos vencidos": pendientes.filter((c) => c.vencido).length,
    "Brechas abiertas": d.brechas.filter((b) => !b.cerrada_en).length,
    "Brechas cerradas": d.brechas.filter((b) => b.cerrada_en).length,
    Puntos: d.progreso?.puntos ?? null,
    "Nivel de gamificación": d.progreso ? calcularNivel(d.progreso.puntos).actual.nombre : null,
    Insignias: d.progreso?.insignias.length ?? null,
    "Eventos asistidos": d.progreso?.eventos_asistidos ?? null,
  };
}

export function filasPorHoja(lista: PortalDatos[]) {
  const de = (d: PortalDatos) => d.empresa.nombre;
  return {
    Resumen: lista.map(resumenEmpresa),
    Diagnósticos: lista.flatMap((d) =>
      d.diagnosticos.map((g) => ({
        Empresa: de(d),
        Fecha: dia(g.fecha),
        "Tipo de iniciativa": g.tipo_iniciativa,
        ...Object.fromEntries(AREAS_DIAGNOSTICO.map((a) => [a.nombre, Number(g[a.campo])])),
        Promedio: Number(g.promedio),
        Nivel: g.nivel,
        Ejemplo: siNo(g.es_ejemplo),
      })),
    ),
    Brechas: lista.flatMap((d) =>
      d.brechas.map((b) => ({
        Empresa: de(d),
        Área: b.area,
        Brecha: b.descripcion,
        "Eje del diagnóstico": b.eje_diagnostico ? nombreEje(b.eje_diagnostico) : null,
        Detectada: dia(b.detectada_en),
        Cerrada: dia(b.cerrada_en),
        Estado: b.cerrada_en ? "Cerrada" : "Abierta",
        Ejemplo: siNo(b.es_ejemplo),
      })),
    ),
    Planes: lista.flatMap((d) =>
      d.planes.map((p) => ({
        Empresa: de(d),
        Plan: p.titulo,
        Área: p.area ? nombreEje(p.area) : null,
        Estado: p.estado,
        Inicio: dia(p.fecha_inicio),
        "Fecha límite": dia(p.fecha_limite),
        Responsable: p.responsable,
        "Avance (%)": p.avance,
        Compromisos: p.compromisos.length,
        Ejemplo: siNo(p.es_ejemplo),
      })),
    ),
    Compromisos: lista.flatMap((d) =>
      d.planes.flatMap((p) =>
        p.compromisos.map((c) => ({
          Empresa: de(d),
          Plan: p.titulo,
          Compromiso: c.descripcion,
          Responsable: c.responsable,
          "Fecha límite": dia(c.fecha_limite),
          Estado: c.estado,
          "Avance (%)": c.avance,
          Vencido: siNo(c.vencido),
        })),
      ),
    ),
    Historial: lista.flatMap((d) =>
      d.historial.map((h) => ({
        Empresa: de(d),
        Fecha: momento(h.fecha),
        Tipo: TIPO_HITO[h.tipo] ?? h.tipo,
        Título: h.titulo,
        Detalle: h.detalle,
        Estado: h.estado,
      })),
    ),
    Eventos: lista.flatMap((d) =>
      d.mis_eventos.map((ev) => ({
        Empresa: de(d),
        Actividad: ev.nombre,
        Tipo: ev.tipo,
        Fecha: momento(ev.fecha),
        Lugar: ev.lugar,
        Respuesta: ev.estado === "pendiente" ? "Sin responder" : ev.estado === "confirmado" ? "Asistiré" : (ev.estado ?? null),
        Asistió: siNo(Boolean(ev.asistio)),
        Puntos: ev.puntos_gamificacion,
      })),
    ),
  };
}

const TIPO_HITO: Record<string, string> = {
  atencion: "Atención",
  proyecto_aula: "Proyecto de aula",
  cita: "Cita o asesoría",
  diagnostico: "Diagnóstico",
  evento: "Evento",
  plan_accion: "Plan de acción",
};

const FORMATO_FECHA = "dd/mm/yyyy";
const FORMATO_MOMENTO = "dd/mm/yyyy hh:mm";

/** Hoja con encabezados, anchos según el contenido, fechas con formato y filtro en la fila de títulos. */
function hoja(filas: Fila[], columnas?: string[]) {
  const encabezados = columnas ?? Object.keys(filas[0] ?? {});
  const ws = XLSX.utils.json_to_sheet(filas, { header: encabezados, cellDates: true });
  if (!filas.length) XLSX.utils.sheet_add_aoa(ws, [encabezados]);
  const rango = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  // Fechas: con hora si alguna celda de la columna la tiene
  for (let c = rango.s.c; c <= rango.e.c; c++) {
    const conHora = filas.some((f) => {
      const v = f[encabezados[c]];
      return v instanceof Date && (v.getUTCHours() !== 12 || v.getUTCMinutes() !== 0);
    });
    for (let r = 1; r <= rango.e.r; r++) {
      const celda = ws[XLSX.utils.encode_cell({ r, c })];
      if (celda?.t === "d") celda.z = conHora ? FORMATO_MOMENTO : FORMATO_FECHA;
    }
  }
  ws["!cols"] = encabezados.map((h) => {
    const largo = Math.max(h.length, ...filas.map((f) => String(f[h] instanceof Date ? "00/00/0000 00:00" : (f[h] ?? "")).length));
    return { wch: Math.min(Math.max(largo + 2, 10), 60) };
  });
  if (rango.e.c >= 0) ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rango.e.r, 1), c: rango.e.c } }) };
  return ws;
}

// Columnas fijas para que las hojas sin filas también tengan sus títulos
const COLUMNAS: Record<string, string[]> = {
  Diagnósticos: ["Empresa", "Fecha", "Tipo de iniciativa", ...AREAS_DIAGNOSTICO.map((a) => a.nombre), "Promedio", "Nivel", "Ejemplo"],
  Brechas: ["Empresa", "Área", "Brecha", "Eje del diagnóstico", "Detectada", "Cerrada", "Estado", "Ejemplo"],
  Planes: ["Empresa", "Plan", "Área", "Estado", "Inicio", "Fecha límite", "Responsable", "Avance (%)", "Compromisos", "Ejemplo"],
  Compromisos: ["Empresa", "Plan", "Compromiso", "Responsable", "Fecha límite", "Estado", "Avance (%)", "Vencido"],
  Historial: ["Empresa", "Fecha", "Tipo", "Título", "Detalle", "Estado"],
  Eventos: ["Empresa", "Actividad", "Tipo", "Fecha", "Lugar", "Respuesta", "Asistió", "Puntos"],
};

/** Libro de Excel del portal de una o varias empresas. */
export function libroPortal(lista: PortalDatos[], meta: { generadoPor: string; generadoEn: Date }) {
  const libro = XLSX.utils.book_new();
  libro.Props = { Title: "Portal del emprendedor · CDE Conecta", Author: meta.generadoPor, Company: "Centro de Desarrollo Empresarial UNAB", CreatedDate: meta.generadoEn };
  const hojas = filasPorHoja(lista);
  for (const [nombre, filas] of Object.entries(hojas)) {
    XLSX.utils.book_append_sheet(libro, hoja(filas as Fila[], COLUMNAS[nombre]), nombre);
  }
  const notas = [
    ["Portal del emprendedor · CDE Conecta (Centro de Desarrollo Empresarial UNAB)"],
    [],
    ["Generado", momento(meta.generadoEn.toISOString())],
    ["Por", meta.generadoPor],
    ["Empresas", lista.length],
    [],
    ["Cómo leerlo"],
    ["· Una hoja por sección; cada fila lleva la columna «Empresa» para filtrar o consolidar varias empresas."],
    ["· El libro es editable: las fechas y números son valores reales de Excel. Los cambios aquí NO se guardan en CDE Conecta."],
    ["· «Etapa actual» se estima a partir de los registros: una etapa cuenta solo si hay un registro que la respalde."],
    ["· «Datos estimados por el CDE» son campos que el emprendedor aún debe confirmar."],
    ["· «Ejemplo = Sí» marca datos de demostración del CDE, no registros reales."],
    ["· Contiene datos personales y empresariales: compártelo solo con quien tenga autorización (Ley 1581 de 2012)."],
  ];
  const wsNotas = XLSX.utils.aoa_to_sheet(notas, { cellDates: true });
  const celdaFecha = wsNotas["B3"];
  if (celdaFecha) celdaFecha.z = FORMATO_MOMENTO;
  wsNotas["!cols"] = [{ wch: 14 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(libro, wsNotas, "Notas");
  return libro;
}

export const bufferLibro = (libro: XLSX.WorkBook) => XLSX.write(libro, { type: "buffer", bookType: "xlsx", cellDates: true, compression: true }) as Buffer;

/** Nombre de archivo seguro: "Portal CDE - Empresa Uno - 2026-10-29.xlsx" */
export function nombreArchivo(lista: { empresa: { nombre: string } }[], fecha: Date, extension: string) {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(fecha);
  const sujeto = lista.length === 1 ? lista[0].empresa.nombre : `${lista.length} empresas`;
  const limpio = sujeto.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return `Portal CDE - ${limpio} - ${hoy}.${extension}`;
}
