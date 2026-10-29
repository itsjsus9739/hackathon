import { describe, expect, it } from "vitest";

import {
  calcularNivel,
  estadoInsignia,
  leerRecompensa,
  progresoInsignia,
  recompensaParaRol,
  type ContextoInsignias,
} from "../gamificacion";

const contexto = (c: Partial<ContextoInsignias> = {}): ContextoInsignias => ({
  puntos: 0,
  eventos: 0,
  aportesPorArea: new Map(),
  aportesTotal: 0,
  onboarding: false,
  ...c,
});

describe("Niveles", () => {
  it("empieza en Explorador y calcula cuánto falta", () => {
    expect(calcularNivel(0)).toMatchObject({ actual: { nombre: "Explorador" }, siguiente: { nombre: "Aprendiz" }, progreso: 0, faltan: 50 });
    expect(calcularNivel(100)).toMatchObject({ actual: { nombre: "Aprendiz" }, progreso: 50, faltan: 50 });
  });

  it("cambia de nivel justo en el umbral y se queda en Leyenda CDE", () => {
    expect(calcularNivel(150).actual.nombre).toBe("Constructor");
    expect(calcularNivel(149).actual.nombre).toBe("Aprendiz");
    expect(calcularNivel(900)).toMatchObject({ actual: { nombre: "Leyenda CDE" }, siguiente: null, progreso: 100, faltan: 0 });
  });

  it("no se rompe con puntos negativos", () => {
    expect(calcularNivel(-20).actual.nombre).toBe("Explorador");
  });
});

describe("Progreso de insignias", () => {
  it("cuenta aportes por área y en total", () => {
    const c = contexto({ aportesPorArea: new Map([["prog", 3]]), aportesTotal: 4 });
    expect(progresoInsignia({ criterio: "aportes_validados", meta: 5, id_area: "prog" }, c)).toEqual({ actual: 3, meta: 5 });
    expect(progresoInsignia({ criterio: "aportes_validados", meta: 1, id_area: "diseno" }, c)).toEqual({ actual: 0, meta: 1 });
    expect(progresoInsignia({ criterio: "aportes_validados", meta: 10, id_area: null }, c)).toEqual({ actual: 4, meta: 10 });
  });

  it("no pasa de la meta y las manuales no tienen barra", () => {
    expect(progresoInsignia({ criterio: "puntos", meta: 100, id_area: null }, contexto({ puntos: 340 }))).toEqual({ actual: 100, meta: 100 });
    expect(progresoInsignia({ criterio: "manual", meta: 1, id_area: null }, contexto())).toBeNull();
  });

  it("asigna los cuatro estados", () => {
    expect(estadoInsignia(true, null)).toBe("ganada");
    expect(estadoInsignia(false, null)).toBe("manual");
    expect(estadoInsignia(false, { actual: 2 })).toBe("en_progreso");
    expect(estadoInsignia(false, { actual: 0 })).toBe("bloqueada");
  });
});

describe("Recompensas por rol", () => {
  it("lee el público de la descripción", () => {
    expect(leerRecompensa("Para: emprendedores. Una hora extra con una persona asesora del CDE.")).toEqual({
      publico: "emprendedores",
      roles: ["emprendedor"],
      detalle: "Una hora extra con una persona asesora del CDE.",
    });
    expect(leerRecompensa("Para: docentes y equipo del CDE. Media jornada.").roles).toEqual(["docente", "cde", "admin_cde"]);
  });

  it("sin «Para:» la recompensa es para todos", () => {
    expect(leerRecompensa("Un certificado").roles).toBeNull();
    expect(recompensaParaRol(null, "estudiante")).toBe(true);
  });

  it("filtra por rol", () => {
    const mentoria = "Para: emprendedores. Una hora extra.";
    expect(recompensaParaRol(mentoria, "emprendedor")).toBe(true);
    expect(recompensaParaRol(mentoria, "estudiante")).toBe(false);
    expect(recompensaParaRol("Para: todos. Certificado.", "docente")).toBe(true);
  });
});
