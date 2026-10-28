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
