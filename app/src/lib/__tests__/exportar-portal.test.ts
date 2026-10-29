import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { bufferLibro, filasPorHoja, libroPortal, nombreArchivo } from "../exportar-portal";
import type { PortalDatos } from "../portal";

const empresa = (nombre: string, extra: Partial<PortalDatos> = {}): PortalDatos => ({
  empresa: {
    id: nombre,
    nombre,
    nit: "900123456",
    sector: "Alimentos",
    tamano: "Micro",
    municipio: "Bucaramanga",
    departamento: "Santander",
    formalizacion: "En proceso",
    descripcion: "Café especial",
    vinculo_unab: null,
    datos_estimados: ["sector"],
    creado_en: "2026-08-01T10:00:00Z",
    representante: "Eva",
    mentor: "Carla",
  },
  diagnosticos: [
    {
      id: "d2",
      fecha: "2026-10-19",
      promedio: 3.05,
      nivel: "Medio",
      tipo_iniciativa: "MiPyME",
      es_ejemplo: false,
      estrategia: 3.5,
      mercadeo_ventas: 3.1,
      financiera: 2.4,
      normativa_legal: 2.9,
      productividad: 3.8,
      transformacion_digital: 2.6,
    },
  ],
  brechas: [],
  planes: [
    {
      id: "p1",
      titulo: "Ordenar las finanzas",
      area: "financiera",
      estado: "En curso",
      fecha_inicio: "2026-09-29",
      fecha_limite: "2026-12-28",
      responsable: "Carla",
      avance: 47,
      es_ejemplo: false,
      compromisos: [
        { id: "c1", descripcion: "Separar cuentas", estado: "En curso", avance: 40, fecha_limite: "2026-10-26", responsable: "Eva", vencido: true },
      ],
    },
  ],
  historial: [{ tipo: "diagnostico", fecha: "2026-10-19T05:00:00+00:00", titulo: "Diagnóstico de madurez", detalle: "Promedio 3.05", estado: "Medio", id_registro: "d2" }],
  mis_eventos: [{ id: "e1", nombre: "Taller", tipo: "Capacitación", fecha: "2026-11-01T15:00:00Z", lugar: "Sala 2", puntos_gamificacion: 25, estado: "confirmado", asistio: false }],
  oferta: [],
  progreso: { puntos: 60, saldo: 60, eventos_asistidos: 1, insignias: [] },
  equipo: [],
  ...extra,
});

const leer = (libro: XLSX.WorkBook) => XLSX.read(bufferLibro(libro), { type: "buffer", cellDates: true });

describe("Exportar el portal a Excel", () => {
  it("arma una hoja por sección y la de notas", () => {
    const libro = leer(libroPortal([empresa("Empresa Uno")], { generadoPor: "Carla", generadoEn: new Date("2026-10-29T15:00:00Z") }));
    expect(libro.SheetNames).toEqual(["Resumen", "Diagnósticos", "Brechas", "Planes", "Compromisos", "Historial", "Eventos", "Notas"]);
  });

  it("guarda números y fechas como valores reales (editable), no como texto", () => {
    const libro = leer(libroPortal([empresa("Empresa Uno")], { generadoPor: "Carla", generadoEn: new Date() }));
    const resumen = XLSX.utils.sheet_to_json<Record<string, unknown>>(libro.Sheets.Resumen);
    expect(resumen[0]["Madurez (1-5)"]).toBe(3.05);
    expect(resumen[0]["Compromisos vencidos"]).toBe(1);
    expect(resumen[0]["Último diagnóstico"]).toBeInstanceOf(Date);
    const compromisos = XLSX.utils.sheet_to_json<Record<string, unknown>>(libro.Sheets.Compromisos);
    expect(compromisos[0]).toMatchObject({ Empresa: "Empresa Uno", Compromiso: "Separar cuentas", "Avance (%)": 40, Vencido: "Sí" });
    expect(libro.Sheets.Compromisos["!autofilter"]).toBeDefined();
  });

  it("varias empresas comparten las hojas con la columna Empresa", () => {
    const hojas = filasPorHoja([empresa("Uno"), empresa("Dos", { planes: [] })]);
    expect(hojas.Resumen.map((f) => f.Empresa)).toEqual(["Uno", "Dos"]);
    expect(hojas.Compromisos.map((f) => f.Empresa)).toEqual(["Uno"]);
  });

  it("las hojas vacías conservan sus títulos", () => {
    const libro = leer(libroPortal([empresa("Uno")], { generadoPor: "x", generadoEn: new Date() }));
    expect(XLSX.utils.sheet_to_json(libro.Sheets.Brechas, { header: 1 })[0]).toEqual([
      "Empresa",
      "Área",
      "Brecha",
      "Eje del diagnóstico",
      "Detectada",
      "Cerrada",
      "Estado",
      "Ejemplo",
    ]);
  });

  it("nombra el archivo sin caracteres prohibidos", () => {
    const fecha = new Date("2026-10-29T15:00:00Z");
    expect(nombreArchivo([{ empresa: { nombre: 'Café "La/Montaña"' } }], fecha, "xlsx")).toBe("Portal CDE - Café La Montaña - 2026-10-29.xlsx");
    expect(nombreArchivo([{ empresa: { nombre: "a" } }, { empresa: { nombre: "b" } }], fecha, "xlsx")).toBe("Portal CDE - 2 empresas - 2026-10-29.xlsx");
  });
});
