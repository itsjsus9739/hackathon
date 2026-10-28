import { describe, expect, it } from "vitest";

import { elegirGrafica, formatearCelda } from "../ia/presentacion";

describe("presentación de resultados del asistente", () => {
  it("grafica tablas etiqueta + valor", () => {
    const g = elegirGrafica({
      columnas: ["sector", "empresas"],
      filas: [
        { sector: "Alimentos", empresas: 42 },
        { sector: "Comercio", empresas: 29 },
      ],
    });
    expect(g).toEqual({ barras: [{ etiqueta: "Alimentos", valor: 42 }, { etiqueta: "Comercio", valor: 29 }], medida: "empresas" });
  });

  it("no grafica una sola fila, listas largas ni tablas sin números", () => {
    expect(elegirGrafica({ columnas: ["total"], filas: [{ total: 156 }] })).toBeNull();
    expect(elegirGrafica({ columnas: ["nombre", "nit"], filas: [{ nombre: "A", nit: "9" }, { nombre: "B", nit: "8" }] })).toBeNull();
    const muchas = Array.from({ length: 20 }, (_, i) => ({ e: `E${i}`, n: i }));
    expect(elegirGrafica({ columnas: ["e", "n"], filas: muchas })).toBeNull();
  });

  it("formatea celdas", () => {
    expect(formatearCelda(null)).toBe("—");
    expect(formatearCelda(true)).toBe("Sí");
    expect(formatearCelda(1234.5)).toBe("1.234,5");
    expect(formatearCelda("2026-10-28")).toMatch(/28/);
  });
});
