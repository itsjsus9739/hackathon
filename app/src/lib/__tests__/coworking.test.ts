import { describe, expect, it } from "vitest";

import { baldosaInicial, baldosaLibre, normalizarAvatar, volumenPorDistancia } from "../coworking/tipos";

describe("coworking", () => {
  it("valida el avatar guardado", () => {
    expect(normalizarAvatar({ piel: "#000000", accesorio: "gafas", pelo: "rojo" })).toEqual({
      piel: "#000000",
      camiseta: "#e4572e",
      pelo: "#2b1b17",
      accesorio: "gafas",
    });
    expect(normalizarAvatar(null).accesorio).toBe("ninguno");
  });

  it("no deja pisar muebles, personas ni salir de la sala; las sillas sí", () => {
    expect(baldosaLibre(2, 2, [])).toBe(false); // mesa
    expect(baldosaLibre(1, 2, [])).toBe(true); // silla
    expect(baldosaLibre(3, 3, [{ x: 3.5, y: 3.5 }])).toBe(false);
    expect(baldosaLibre(8, 0, [])).toBe(false);
    const p = baldosaInicial([{ x: 0.5, y: 0.5 }], 0);
    expect(p).not.toEqual({ x: 0.5, y: 0.5 });
  });

  it("la voz se oye según la cercanía", () => {
    expect(volumenPorDistancia({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(1);
    expect(volumenPorDistancia({ x: 0, y: 0 }, { x: 4, y: 0 })).toBe(0.5);
    expect(volumenPorDistancia({ x: 0, y: 0 }, { x: 7, y: 0 })).toBe(0);
  });
});
