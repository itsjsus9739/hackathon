import { describe, expect, it } from "vitest";

import { avancePorEje, compararDiagnosticos, resumenBrechas, textoCambio } from "../impacto";

const diag = (fecha: string, base: number, digital: number) => ({
  fecha,
  promedio: (base * 5 + digital) / 6,
  estrategia: base,
  mercadeo_ventas: base,
  financiera: base,
  normativa_legal: base,
  productividad: base,
  transformacion_digital: digital,
});

describe("medición de cambio", () => {
  it("compara el primer y el último diagnóstico sin importar el orden", () => {
    const c = compararDiagnosticos([diag("2026-09-01", 3, 3.2), diag("2026-03-01", 2.8, 1.5), diag("2026-06-01", 2.9, 2)])!;
    expect(c.fechaInicial).toBe("2026-03-01");
    expect(c.fechaFinal).toBe("2026-09-01");
    expect(c.mayorAvance?.campo).toBe("transformacion_digital");
    expect(c.mayorAvance?.cambio).toBe(1.7);
    expect(c.ejes.find((e) => e.campo === "financiera")?.cambio).toBe(0.2);
    expect(compararDiagnosticos([diag("2026-03-01", 3, 3)])).toBeNull();
  });

  it("escribe el cambio con signo y coma", () => {
    expect(textoCambio(0.83)).toBe("+0,8");
    expect(textoCambio(-0.3)).toBe("−0,3");
    expect(textoCambio(0)).toBe("0,0");
  });

  it("resume brechas detectadas y cerradas por área", () => {
    const r = resumenBrechas([
      { area: "Financiera", descripcion: "a", cerrada_en: "2026-09-01" },
      { area: "Financiera", descripcion: "b", cerrada_en: null },
      { area: "Digital", descripcion: "c", cerrada_en: "2026-09-01" },
    ]);
    expect(r).toMatchObject({ detectadas: 3, cerradas: 2, porcentaje: 67 });
    expect(r.areas[0]).toEqual({ area: "Financiera", detectadas: 2, cerradas: 1, porcentaje: 50 });
  });

  it("promedia el avance por eje", () => {
    const r = avancePorEje([
      { cambio_promedio: 0.4, cambio_financiera: 1 },
      { cambio_promedio: 0.2, cambio_financiera: 0.2 },
    ]);
    expect(r.empresas).toBe(2);
    expect(r.cambioPromedio).toBe(0.3);
    expect(r.ejes.find((e) => e.etiqueta === "Financiera")?.valor).toBe(0.6);
  });
});
