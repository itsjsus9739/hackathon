import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { resultadoParaModelo } = await import("../ia/comun");
const { esperaSugerida, limpiarRespuesta } = await import("../ia/abierto");

describe("límite de tokens del proveedor de IA", () => {
  it("recorta las filas que se le reenvían al modelo y avisa cuántas quedaron fuera", () => {
    const filas = Array.from({ length: 200 }, (_, i) => ({ empresa: `Empresa con un nombre largo número ${i}`, sector: "Servicios" }));
    const texto = resultadoParaModelo(filas, false, 2000);
    expect(texto.length).toBeLessThanOrEqual(2000);
    const json = JSON.parse(texto);
    expect(json.filas.length).toBeLessThan(200);
    expect(json.nota).toMatch(/de 200 filas/);
    expect(JSON.parse(resultadoParaModelo([{ total: 3 }], false))).toEqual({ filas: [{ total: 3 }], truncado: false });
  });

  it("lee la espera que pide el proveedor", () => {
    expect(esperaSugerida({ headers: new Headers({ "retry-after": "3" }) })).toBe(3000);
    expect(esperaSugerida({ headers: null, message: "Rate limit reached ... Please try again in 7.25s." })).toBe(7250);
    expect(esperaSugerida({ headers: null, message: "try again in 450ms" })).toBe(450);
    expect(esperaSugerida({ headers: null, message: "otro" })).toBe(8000);
  });
});

describe("respuesta de modelos con razonamiento", () => {
  it("quita el bloque <think> de Qwen3 y deja solo la respuesta", () => {
    expect(limpiarRespuesta("<think>\nPrimero cuento las empresas…\n</think>\n\nHay 180 empresas.")).toBe("Hay 180 empresas.");
    expect(limpiarRespuesta("razonamiento suelto</think>Hay 180 empresas.")).toBe("Hay 180 empresas.");
    expect(limpiarRespuesta("  Hay 180 empresas.  ")).toBe("Hay 180 empresas.");
  });
});
