import { describe, expect, it } from "vitest";
import { calcularDV, formatearNIT, parsearNIT } from "../nit";

describe("NIT y dígito de verificación DIAN", () => {
  it("calcula el DV de NIT conocidos", () => {
    expect(calcularDV("890200499")).toBe(9);
    expect(calcularDV("800197268")).toBe(4);
    expect(calcularDV("860034313")).toBe(7);
  });

  it("parsea formatos distintos del mismo NIT", () => {
    for (const entrada of ["890.200.499-9", "890200499-9", "890200499 9", " 890 200 499 - 9 "]) {
      expect(parsearNIT(entrada)).toEqual({ nit: "890200499", dv: 9, valido: true });
    }
    expect(parsearNIT("8902004999", true)).toEqual({ nit: "890200499", dv: 9, valido: true });
    expect(parsearNIT("890200499")).toEqual({ nit: "890200499", dv: null, valido: null });
  });

  it("detecta un DV incorrecto", () => {
    expect(parsearNIT("890.200.499-1")?.valido).toBe(false);
  });

  it("formatea con puntos y DV", () => {
    expect(formatearNIT("890200499")).toBe("890.200.499-9");
  });
});
