import { describe, expect, it, vi } from "vitest";

// empresas.ts importa el cliente de servidor (next/headers); estas pruebas solo usan funciones puras
vi.mock("@/lib/supabase/server", () => ({ crearClienteServidor: vi.fn() }));

import { agruparPorMes, contarPorTipo, esUuid, fechaLegible, type Hito } from "../empresas";

const hito = (tipo: Hito["tipo"], fecha: string): Hito => ({ id: fecha, tipo, fecha, titulo: "x", detalle: null, estado: null });

describe("Ficha 360°: utilidades de la línea de tiempo", () => {
  it("valida el id antes de consultar", () => {
    expect(esUuid("3584fd08-b1dc-52a1-8eb9-952b13fa685f")).toBe(true);
    expect(esUuid("123")).toBe(false);
    expect(esUuid("3584fd08-b1dc-52a1-8eb9-952b13fa685f' or 1=1")).toBe(false);
  });

  it("agrupa por mes en hora de Bogotá", () => {
    const grupos = agruparPorMes([
      hito("proyecto_aula", "2026-08-18T05:00:00+00:00"), // 18 ago, medianoche Bogotá
      hito("atencion", "2026-09-01T03:00:00+00:00"), // 31 ago 22:00 en Bogotá → sigue en agosto
      hito("cita", "2026-11-03T15:00:00+00:00"),
    ]);
    expect(grupos.map((g) => [g.mes, g.hitos.length])).toEqual([
      ["agosto de 2026", 2],
      ["noviembre de 2026", 1],
    ]);
  });

  it("muestra la hora solo cuando el hito la tiene", () => {
    expect(fechaLegible("2026-08-18T05:00:00+00:00")).toMatch(/^18 de ago/);
    expect(fechaLegible("2026-08-18T05:00:00+00:00")).not.toContain("·");
    expect(fechaLegible("2026-11-03T15:00:00+00:00")).toMatch(/^3 de nov.* · 10:00/);
  });

  it("cuenta hitos por tipo", () => {
    const conteo = contarPorTipo([hito("cita", "2026-01-01T00:00:00Z"), hito("cita", "2026-01-02T00:00:00Z"), hito("evento", "2026-01-03T00:00:00Z")]);
    expect(conteo).toEqual({ proyecto_aula: 0, cita: 2, diagnostico: 0, evento: 1, atencion: 0 });
  });
});

import { mayorBrecha, type Diagnostico } from "../empresas";

describe("diagnóstico de madurez", () => {
  it("identifica el área con mayor brecha", () => {
    const d: Diagnostico = {
      fecha: "2026-10-28", tipo_iniciativa: null, promedio: 2.85, nivel: "Medio",
      estrategia: 3, mercadeo_ventas: 2.5, financiera: 2.8, normativa_legal: 3.1, productividad: 3, transformacion_digital: 2.7,
    };
    expect(mayorBrecha(d).nombre).toBe("Gestión de Mercadeo y Ventas");
  });
});
