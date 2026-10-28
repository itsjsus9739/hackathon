import { describe, expect, it } from "vitest";

import { diasHasta, estaVencido, hoyBogota, textoPlazo, tituloSugerido } from "../planes";

describe("planes de acción", () => {
  it("usa el día de Bogotá, no el de UTC", () => {
    // 3:00 UTC del 29 = 22:00 del 28 en Bogotá
    expect(hoyBogota(new Date("2026-10-29T03:00:00Z"))).toBe("2026-10-28");
  });

  it("marca vencidos solo los compromisos abiertos con fecha pasada", () => {
    const hoy = "2026-10-28";
    expect(estaVencido({ fecha_limite: "2026-10-27", estado: "En curso" }, hoy)).toBe(true);
    expect(estaVencido({ fecha_limite: "2026-10-27", estado: "Cumplido" }, hoy)).toBe(false);
    expect(estaVencido({ fecha_limite: "2026-10-28", estado: "Pendiente" }, hoy)).toBe(false);
    expect(estaVencido({ fecha_limite: null, estado: "Pendiente" }, hoy)).toBe(false);
  });

  it("describe el plazo", () => {
    const hoy = "2026-10-28";
    expect(diasHasta("2026-10-25", hoy)).toBe(-3);
    expect(textoPlazo("2026-10-25", "En curso", hoy)).toMatch(/3 días de retraso$/);
    expect(textoPlazo("2026-10-29", "Pendiente", hoy)).toMatch(/faltan 1 día$/);
    expect(textoPlazo("2026-10-28", "Pendiente", hoy)).toMatch(/vence hoy$/);
    expect(textoPlazo("2026-10-25", "Cumplido", hoy)).not.toMatch(/retraso/);
  });

  it("sugiere el título según el área", () => {
    expect(tituloSugerido("transformacion_digital")).toBe("Plan de transformación digital");
    expect(tituloSugerido("financiera")).toBe("Plan de gestión financiera");
    expect(tituloSugerido("otra")).toBe("");
  });
});
