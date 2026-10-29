import { describe, expect, it } from "vitest";

import { MODULOS, SOLO_CDE } from "../navegacion";
import { pasosRecorrido } from "../recorrido";
import { Constants } from "../supabase/database.types";

const ROLES = Constants.public.Enums.rol_usuario;
const RUTAS = new Set<string>(MODULOS.map((m) => m.href));

describe("Recorrido del búho por rol", () => {
  it("cada rol empieza con la bienvenida y termina con la despedida", () => {
    for (const rol of ROLES) {
      const pasos = pasosRecorrido(rol, "Ana Pérez");
      expect(pasos[0].id).toBe("bienvenida");
      expect(pasos[0].titulo).toContain("Ana");
      expect(pasos.at(-1)?.id).toBe("fin");
    }
  });

  it("solo lleva a módulos que existen en el menú, sin pasos repetidos", () => {
    for (const rol of ROLES) {
      const pasos = pasosRecorrido(rol, "Ana");
      for (const p of pasos) if (p.ruta) expect(RUTAS.has(p.ruta)).toBe(true);
      expect(new Set(pasos.map((p) => p.id)).size).toBe(pasos.length);
    }
  });

  it("no muestra módulos exclusivos del CDE a docentes, estudiantes ni emprendedores", () => {
    for (const rol of ["docente", "estudiante", "emprendedor"] as const) {
      const rutas = pasosRecorrido(rol, "Ana").map((p) => p.ruta);
      for (const soloCde of SOLO_CDE) expect(rutas).not.toContain(soloCde);
    }
    for (const rol of ["cde", "admin_cde"] as const) {
      const rutas = pasosRecorrido(rol, "Ana").map((p) => p.ruta);
      for (const soloCde of SOLO_CDE) expect(rutas).toContain(soloCde);
    }
  });

  it("cada rol tiene su propia explicación", () => {
    const textos = ROLES.map((rol) => pasosRecorrido(rol, "Ana")[0].texto);
    expect(new Set(textos).size).toBe(ROLES.length);
  });

  it("no saluda con el correo cuando el usuario no tiene nombre", () => {
    expect(pasosRecorrido("emprendedor", "ana@correo.com")[0].titulo).not.toContain("@");
  });
});

describe("Tutoriales paso a paso", () => {
  it("Importar y depurar es solo del CDE; los demás ven el del coworking", async () => {
    const { tutorialesPara } = await import("../recorrido");
    for (const rol of ["cde", "admin_cde"] as const) expect(tutorialesPara(rol).map((t) => t.id)).toContain("importar");
    for (const rol of ["docente", "estudiante", "emprendedor"] as const) {
      const ids = tutorialesPara(rol).map((t) => t.id);
      expect(ids).not.toContain("importar");
      if (rol !== "docente") expect(ids).toContain("coworking");
    }
  });

  it("crear un plan es para el CDE y los docentes", async () => {
    const { tutorialesPara } = await import("../recorrido");
    expect(tutorialesPara("docente").map((t) => t.id)).toContain("crear-plan");
    expect(tutorialesPara("emprendedor").map((t) => t.id)).not.toContain("crear-plan");
  });

  it("cada tutorial empieza en su página y termina con la despedida", async () => {
    const { TUTORIALES, enlaceTutorial, esTutorial } = await import("../recorrido");
    for (const [id, t] of Object.entries(TUTORIALES)) {
      expect(t.pasos[0].ruta).toBe(t.inicio);
      expect(t.pasos.at(-1)?.id).toBe("fin");
      expect(new Set(t.pasos.map((p) => p.id)).size).toBe(t.pasos.length);
      expect(esTutorial(id)).toBe(true);
      expect(enlaceTutorial(id as keyof typeof TUTORIALES)).toBe(`${t.inicio}?tutorial=${id}`);
    }
    expect(esTutorial("otro")).toBe(false);
    expect(esTutorial(null)).toBe(false);
  });
});

describe("Menú por rol", () => {
  it("Importar y el asistente son del CDE; el emprendedor actualiza su empresa", async () => {
    const { modulosPara } = await import("../navegacion");
    const rutas = (rol: (typeof ROLES)[number]) => modulosPara(rol).map((m) => m.href);
    expect(rutas("cde")).toContain("/importar");
    expect(rutas("cde")).not.toContain("/mi-empresa");
    for (const rol of ["docente", "estudiante"] as const) {
      expect(rutas(rol)).not.toContain("/importar");
      expect(rutas(rol)).not.toContain("/mi-empresa");
    }
    expect(rutas("emprendedor")).toContain("/mi-empresa");
    expect(rutas("emprendedor")).not.toContain("/importar");
  });
});
