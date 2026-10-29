import { describe, expect, it } from "vitest";

import {
  alertasPortal,
  compromisosPendientes,
  ejesAMejorar,
  leerDiagnostico,
  recomendarOportunidades,
  rutaAcompanamiento,
  type DiagnosticoPortal,
  type PlanPortal,
  type PortalDatos,
} from "../portal";

const diag = (fecha: string, valores: Partial<DiagnosticoPortal> = {}): DiagnosticoPortal => {
  const d = { estrategia: 3, mercadeo_ventas: 3, financiera: 3, normativa_legal: 3, productividad: 3, transformacion_digital: 3, ...valores };
  const promedio = (d.estrategia + d.mercadeo_ventas + d.financiera + d.normativa_legal + d.productividad + d.transformacion_digital) / 6;
  return { id: fecha, fecha, promedio, nivel: "Medio", tipo_iniciativa: null, es_ejemplo: false, ...d };
};

const plan = (compromisos: Partial<PlanPortal["compromisos"][number]>[], estado = "En curso"): PlanPortal => ({
  id: "p1",
  titulo: "Plan",
  area: "financiera",
  estado,
  fecha_inicio: null,
  fecha_limite: null,
  responsable: null,
  avance: 0,
  es_ejemplo: false,
  compromisos: compromisos.map((c, i) => ({
    id: `c${i}`,
    descripcion: `Compromiso ${i}`,
    estado: "Pendiente",
    avance: 0,
    fecha_limite: null,
    responsable: null,
    vencido: false,
    ...c,
  })),
});

const vacio = { diagnosticos: [], planes: [], brechas: [], historial: [] };

describe("Ruta de acompañamiento", () => {
  it("sin registros empieza en Diagnóstico y no marca nada como completado", () => {
    const ruta = rutaAcompanamiento(vacio);
    expect(ruta.map((e) => e.estado)).toEqual(["actual", "pendiente", "pendiente", "pendiente", "pendiente"]);
  });

  it("avanza solo con registros que la respalden", () => {
    const ruta = rutaAcompanamiento({ ...vacio, diagnosticos: [diag("2026-10-01")], planes: [plan([{ avance: 40, estado: "En curso" }])] });
    expect(ruta.map((e) => e.estado)).toEqual(["completada", "completada", "completada", "actual", "pendiente"]);
    expect(ruta[2].evidencia).toBe("1 compromiso con avance");
  });

  it("un segundo diagnóstico cuenta como evaluación", () => {
    const ruta = rutaAcompanamiento({
      ...vacio,
      diagnosticos: [diag("2026-10-01"), diag("2026-05-01")],
      planes: [plan([{ estado: "Cumplido", avance: 100 }])],
    });
    expect(ruta.every((e) => e.estado === "completada")).toBe(true);
  });

  it("una etapa posterior con registros no salta la actual", () => {
    // Hay segundo diagnóstico pero ningún plan: la etapa actual sigue siendo el plan
    const ruta = rutaAcompanamiento({ ...vacio, diagnosticos: [diag("2026-10-01"), diag("2026-05-01")] });
    expect(ruta.map((e) => e.estado)).toEqual(["completada", "actual", "pendiente", "pendiente", "pendiente"]);
  });
});

describe("Diagnóstico", () => {
  it("separa fortalezas y áreas de mejora y calcula el cambio", () => {
    const r = leerDiagnostico([diag("2026-10-01", { productividad: 4.2, financiera: 2.1, transformacion_digital: 2.6 }), diag("2026-01-01")])!;
    expect(r.fortalezas.map((f) => f.eje)).toEqual(["productividad"]);
    expect(r.mejoras.map((m) => m.eje)).toEqual(["financiera", "transformacion_digital"]);
    expect(r.cambio).toBe(-0.02); // 2,98 frente a 3,00
  });

  it("sin diagnósticos devuelve null", () => {
    expect(leerDiagnostico([])).toBeNull();
  });
});

describe("Oportunidades recomendadas", () => {
  const oferta = [
    { id: "1", nombre: "Rueda de negocios", tipo: "Networking", fecha: "2026-11-01T10:00:00Z", lugar: null, puntos_gamificacion: 30 },
    { id: "2", nombre: "Taller: flujo de caja para pymes", tipo: "Capacitación", fecha: "2026-11-05T10:00:00Z", lugar: null, puntos_gamificacion: 25 },
    { id: "3", nombre: "Marketing digital", tipo: "Capacitación", fecha: "2026-11-03T10:00:00Z", lugar: null, puntos_gamificacion: 20, descripcion: "Redes sociales y ventas en línea" },
  ];

  it("recomienda primero lo que trata el área más débil y no marca lo demás", () => {
    const r = recomendarOportunidades(oferta, ["financiera", "mercadeo_ventas"]);
    expect(r.map((o) => [o.id, o.recomendada])).toEqual([
      ["2", "financiera"],
      ["3", "mercadeo_ventas"],
      ["1", null],
    ]);
  });

  it("sin áreas a mejorar todo es oferta general, ordenada por fecha", () => {
    expect(recomendarOportunidades(oferta, []).map((o) => o.recomendada)).toEqual([null, null, null]);
    expect(recomendarOportunidades(oferta, []).map((o) => o.id)).toEqual(["1", "3", "2"]);
  });

  it("las brechas abiertas van antes que el diagnóstico", () => {
    const ejes = ejesAMejorar({
      diagnosticos: [diag("2026-10-01", { financiera: 2 })],
      brechas: [
        { id: "b", area: "x", descripcion: "x", eje_diagnostico: "normativa_legal", detectada_en: "2026-10-01", cerrada_en: null, es_ejemplo: false },
        { id: "c", area: "x", descripcion: "x", eje_diagnostico: "productividad", detectada_en: "2026-10-01", cerrada_en: "2026-10-20", es_ejemplo: false },
      ],
    });
    expect(ejes).toEqual(["normativa_legal", "financiera"]);
  });
});

describe("Compromisos y alertas", () => {
  it("ordena los vencidos primero y omite los cerrados", () => {
    const lista = compromisosPendientes([
      plan([
        { id: "a", fecha_limite: "2026-12-01" },
        { id: "b", vencido: true, estado: "En curso", fecha_limite: "2026-10-01" },
        { id: "c", estado: "Cumplido" },
      ]),
    ]);
    expect(lista.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("solo muestra alertas con algo pendiente", () => {
    const datos = {
      ...vacio,
      planes: [plan([{ vencido: true, estado: "En curso" }])],
      mis_eventos: [{ id: "e", nombre: "x", tipo: "Cita", fecha: "2026-11-01", lugar: null, puntos_gamificacion: 0, estado: "pendiente" }],
      oferta: [],
      progreso: null,
      equipo: [],
      empresa: { datos_estimados: [] },
    } as unknown as PortalDatos;
    expect(alertasPortal(datos).map((a) => [a.clave, a.valor])).toEqual([
      ["vencidos", 1],
      ["invitaciones", 1],
    ]);
  });
});
