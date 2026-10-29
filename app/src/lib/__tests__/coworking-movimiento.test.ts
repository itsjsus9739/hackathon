import { describe, expect, it } from "vitest";

import { CUADRO_MAXIMO_S, recorrer, segundosEntre, VELOCIDAD_PERSONA } from "../coworking/movimiento";

/** Simula `segundos` de juego con un monitor de `hz` hercios: un cuadro cada 1000/hz ms. */
function simular(hz: number, segundos: number, mover: (s: number) => void) {
  let anterior = 1000;
  for (let i = 1; i <= Math.round(segundos * hz); i++) {
    const ahora = 1000 + (i * 1000) / hz;
    mover(segundosEntre(anterior, ahora));
    anterior = ahora;
  }
}

const ruta = () => [{ x: 1.5, y: 0.5 }, { x: 2.5, y: 0.5 }, { x: 3.5, y: 0.5 }, { x: 3.5, y: 1.5 }, { x: 3.5, y: 2.5 }];

describe("velocidad del coworking", () => {
  it("es la misma con cualquier frecuencia de monitor", () => {
    const posiciones = [30, 60, 75, 120, 144, 240].map((hz) => {
      const m = { px: 0.5, py: 0.5, ruta: ruta() };
      simular(hz, 1, (s) => recorrer(m, VELOCIDAD_PERSONA * s)); // 1 s: cuadros enteros en todas las frecuencias
      return { x: m.px, y: m.py };
    });
    // En un segundo todos recorren 4,8 baldosas (3 a la derecha y 1,8 hacia abajo) y quedan en el mismo punto
    for (const p of posiciones) {
      expect(p.x).toBeCloseTo(posiciones[0].x, 6);
      expect(p.y).toBeCloseTo(posiciones[0].y, 6);
    }
    expect(posiciones[0].x).toBeCloseTo(3.5, 6);
    expect(posiciones[0].y).toBeCloseTo(2.3, 6);
  });

  it("llega al final de la ruta en el mismo tiempo a 60 y a 144 Hz", () => {
    const llegada = (hz: number) => {
      const m = { px: 0.5, py: 0.5, ruta: ruta() };
      let t = 0;
      let llego: number | null = null;
      simular(hz, 3, (s) => {
        t += s;
        if (recorrer(m, VELOCIDAD_PERSONA * s).termino) llego ??= t;
      });
      return llego;
    };
    // 5 baldosas a 4,8 por segundo: algo más de un segundo, igual en las dos pantallas
    expect(llegada(60)).toBeCloseTo(5 / VELOCIDAD_PERSONA, 1);
    expect(llegada(144)).toBeCloseTo(5 / VELOCIDAD_PERSONA, 1);
  });

  it("al volver de otra pestaña no salta: el cuadro tiene un tope", () => {
    expect(segundosEntre(0, 30_000)).toBe(CUADRO_MAXIMO_S);
    expect(segundosEntre(5000, 4000)).toBe(0);
    const m = { px: 0.5, py: 0.5, ruta: ruta() };
    recorrer(m, VELOCIDAD_PERSONA * segundosEntre(0, 30_000));
    expect(m.px).toBeCloseTo(0.98, 6);
  });
});
