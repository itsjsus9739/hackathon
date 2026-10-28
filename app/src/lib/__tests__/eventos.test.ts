import { describe, expect, it } from "vitest";

import {
  cambiosInvitados,
  contarRespuestas,
  finPorDefecto,
  puedeCrearTipo,
  puedeGestionar,
  tipoEvento,
  tipoInicial,
  tiposCreables,
} from "../eventos";

describe("calendario de eventos", () => {
  it("aplica los permisos de creación por rol", () => {
    expect(tiposCreables("emprendedor").map((t) => t.tipo)).toEqual(["Evento", "Networking", "Cita", "Coworking"]);
    expect(tiposCreables("docente").map((t) => t.tipo)).toEqual(["Conversatorio", "Cita", "Coworking"]);
    expect(tiposCreables("estudiante").map((t) => t.tipo)).toEqual(["Cita", "Coworking"]);
    expect(tiposCreables("cde")).toHaveLength(9);
    expect(puedeCrearTipo("emprendedor", "Conversatorio")).toBe(false);
    expect(puedeCrearTipo("admin_cde", "Feria")).toBe(true);
    expect(tipoInicial("docente")).toBe("Cita");
  });

  it("distingue públicos y privados", () => {
    expect(tipoEvento("Networking").publico).toBe(true);
    expect(tipoEvento("Cita").publico).toBe(false);
    expect(tipoEvento("Desconocido").publico).toBe(true);
  });

  it("deja gestionar al organizador o al CDE", () => {
    expect(puedeGestionar({ id: "a", rol: "estudiante" }, { creado_por: "a" })).toBe(true);
    expect(puedeGestionar({ id: "b", rol: "estudiante" }, { creado_por: "a" })).toBe(false);
    expect(puedeGestionar({ id: "b", rol: "cde" }, { creado_por: "a" })).toBe(true);
  });

  it("cuenta respuestas y completa el fin", () => {
    expect(contarRespuestas([{ id_usuario: "1", estado: "confirmado" }, { id_usuario: "2", estado: "pendiente" }])).toEqual({
      pendiente: 1,
      confirmado: 1,
      rechazado: 0,
    });
    expect(finPorDefecto("2026-10-28T14:00:00.000Z", null)).toBe("2026-10-28T15:00:00.000Z");
  });

  it("calcula a quién invitar y a quién quitar sin tocar las inscripciones propias", () => {
    const actuales = [
      { id_usuario: "inv1", invitado_por: "org" },
      { id_usuario: "inv2", invitado_por: "org" },
      { id_usuario: "solo", invitado_por: null },
    ];
    expect(cambiosInvitados(actuales, ["inv1", "nuevo", "org"], "org")).toEqual({ invitar: ["nuevo"], quitar: ["inv2"] });
  });
});
