import { describe, expect, it, vi } from "vitest";

import { limitado } from "../coworking/transporte";

describe("límite de frecuencia de la presencia", () => {
  it("con 100 cambios seguidos (p. ej. arrastrar el selector de color) envía solo 2: el primero y el último", () => {
    vi.useFakeTimers();
    const enviados: number[] = [];
    const enviar = limitado((v: number) => enviados.push(v), 2000);
    for (let i = 1; i <= 100; i++) {
      enviar(i);
      vi.advanceTimersByTime(10);
    }
    vi.advanceTimersByTime(2000);
    expect(enviados).toEqual([1, 100]);
    vi.useRealTimers();
  });
});
