import { describe, expect, it } from "vitest";

import {
  baldosaInicial,
  baldosaLibre,
  buscarRuta,
  normalizarAvatar,
  proximoReinicioChat,
  sillaPorClave,
  ultimoReinicioChat,
  volumenPorDistancia,
} from "../coworking/tipos";

describe("coworking", () => {
  it("valida el avatar guardado (y los avatares del diseño anterior pasan al predeterminado)", () => {
    expect(normalizarAvatar({ camisa: "cms_2", pelo: "M", accesorio: "gafas", pantalon: "rojo" })).toEqual({
      camisa: "cms_2",
      pantalon: "pnt_1",
      pelo: "M",
      accesorio: "gafas",
    });
    expect(normalizarAvatar({ piel: "#000000", camiseta: "#e4572e" })).toEqual({ camisa: "cms_1", pantalon: "pnt_1", pelo: "H", accesorio: "ninguno" });
    expect(normalizarAvatar(null).accesorio).toBe("ninguno");
  });

  it("no deja pisar muebles, personas ni salir de la sala", () => {
    expect(baldosaLibre(1, 2, [])).toBe(false); // escritorio
    expect(baldosaLibre(1, 1, [])).toBe(false); // silla: se ocupa con clic, no se camina por encima
    expect(baldosaLibre(4, 3, [])).toBe(true);
    expect(baldosaLibre(4, 3, [{ x: 4.5, y: 3.5 }])).toBe(false);
    expect(baldosaLibre(8, 0, [])).toBe(false);
    expect(baldosaInicial([{ x: 0.5, y: 0.5 }], 0)).not.toEqual({ x: 0.5, y: 0.5 });
    // Ninguna entrada cae en un rincón encerrado: desde todas se llega al pasillo central
    for (let semilla = 0; semilla < 64; semilla++) {
      const p = baldosaInicial([], semilla);
      const centro = p.x === 4.5 && p.y === 3.5;
      expect(centro || buscarRuta(p, 4, 3, []).length > 0).toBe(true);
    }
  });

  it("encuentra el camino rodeando los muebles y llega hasta una silla", () => {
    const ruta = buscarRuta({ x: 4.5, y: 3.5 }, 1, 1, [], true);
    expect(ruta.at(-1)).toEqual({ x: 1.5, y: 1.5 });
    for (const p of ruta.slice(0, -1)) expect(baldosaLibre(Math.floor(p.x), Math.floor(p.y), [])).toBe(true);
    expect(buscarRuta({ x: 4.5, y: 3.5 }, 1, 1, [], false)).toEqual([]); // sin permiso no entra a la silla
    expect(sillaPorClave("1.5,1.5")?.dir).toBe("drch");
  });

  it("la voz se oye según la cercanía", () => {
    expect(volumenPorDistancia({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(1);
    expect(volumenPorDistancia({ x: 0, y: 0 }, { x: 4, y: 0 })).toBe(0.5);
    expect(volumenPorDistancia({ x: 0, y: 0 }, { x: 7, y: 0 })).toBe(0);
  });

  it("el chat se reinicia todos los días a las 4:00 a. m. de Colombia", () => {
    // 3:59 a. m. en Bogotá (08:59 UTC): el último reinicio fue ayer a las 4:00
    expect(ultimoReinicioChat(new Date("2026-10-29T08:59:00Z")).toISOString()).toBe("2026-10-28T09:00:00.000Z");
    // 4:00 en punto: empieza el día nuevo
    expect(ultimoReinicioChat(new Date("2026-10-29T09:00:00Z")).toISOString()).toBe("2026-10-29T09:00:00.000Z");
    // 11:30 p. m. en Bogotá (04:30 UTC del día siguiente): sigue contando el de las 4:00 de ese día
    expect(ultimoReinicioChat(new Date("2026-10-30T04:30:00Z")).toISOString()).toBe("2026-10-29T09:00:00.000Z");
    expect(proximoReinicioChat(new Date("2026-10-29T15:00:00Z")).toISOString()).toBe("2026-10-30T09:00:00.000Z");
  });
});
