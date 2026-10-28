import { readFileSync } from "node:fs";
import { join } from "node:path";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";

import { emparejarSector, limpiarNombre, mapearEncabezados, planificar, procesarHoja, validarFila } from "../importacion";

const SECTORES = ["Alimentos", "Audiovisuales, Arte y Cultura", "Comercio", "Manufactura / Industrial", "Servicios", "Tecnológico", "Turismo"];

describe("limpieza", () => {
  it("corrige mayúsculas, espacios y sufijos societarios", () => {
    expect(limpiarNombre("  POSTRES CHICAMOCHA ")).toBe("Postres Chicamocha");
    expect(limpiarNombre("restaurante la pradera")).toBe("Restaurante la Pradera");
    expect(limpiarNombre("Variedades Guane sas")).toBe("Variedades Guane S.A.S.");
    expect(limpiarNombre("Tienda Provenza 14 S.A.S.")).toBe("Tienda Provenza 14 S.A.S.");
  });

  it("empareja sectores escritos distinto y detecta los nuevos", () => {
    expect(emparejarSector("Tecnología", SECTORES)).toEqual({ sector: "Tecnológico", nuevo: false });
    expect(emparejarSector("Arte y Cultura", SECTORES)).toEqual({ sector: "Audiovisuales, Arte y Cultura", nuevo: false });
    expect(emparejarSector("Manufactura e Industrial", SECTORES).sector).toBe("Manufactura / Industrial");
    expect(emparejarSector("Salud y Bienestar", SECTORES)).toEqual({ sector: "Salud y Bienestar", nuevo: true });
  });

  it("reconoce los encabezados del CDE", () => {
    const mapa = mapearEncabezados(["Nombre empresa", "NIT", "Emprendedor", "Correo", "Celular", "Sector", "Tamaño", "Municipio"]);
    expect(mapa).toEqual({ nombre: 0, nit: 1, representante: 2, correo: 3, celular: 4, sector: 5, tamano: 6, municipio: 7 });
  });

  it("valida el NIT con su DV", () => {
    const mal = validarFila({ nombre: "Comercializadora Error Típico", nit: "900.123.456-0" }, 2, SECTORES);
    expect(mal.errores[0]).toMatch(/debería ser 8/);
    const pegado = validarFila({ nombre: "X", nit: "9001234568" }, 3, SECTORES);
    expect([pegado.nit, pegado.nitDv, pegado.errores]).toEqual(["900123456", 8, []]);
    const sinDv = validarFila({ nombre: "X", nit: "900101773", municipio: "B/manga" }, 4, SECTORES);
    expect(sinDv.nitDv).not.toBeNull();
    expect([sinDv.municipio, sinDv.departamento]).toEqual(["Bucaramanga", "Santander"]);
  });
});

describe("base de demostración (base_cde_sucia.csv)", () => {
  const texto = readFileSync(join(__dirname, "../../../data/demo/base_cde_sucia.csv"), "utf8");
  const tabla = Papa.parse<string[]>(texto, { skipEmptyLines: true }).data;
  const { filas: crudas } = procesarHoja(tabla);
  const filas = crudas.map(({ crudo, fila }) => validarFila(crudo, fila, SECTORES));

  it("encuentra los duplicados y el NIT con DV errado", () => {
    const plan = planificar(filas, [], {});
    expect(filas).toHaveLength(66);
    expect(plan.conErrores).toBe(1);
    const resumen = plan.pendientes.map((g) => g.claves.map((c) => filas.find((f) => `f:${f.fila}` === c)!.nombre));
    expect(resumen).toHaveLength(5);
    expect(resumen).toContainEqual(["Café El Bosque 28", "Cafe El Bosque 28"]);
    // Ninguna fila queda sin decidir fuera de los grupos
    expect(plan.operaciones.length + plan.pendientes.flatMap((g) => g.claves).length).toBe(65);
  });

  it("al fusionar todo queda una empresa por grupo y ningún duplicado", () => {
    const { pendientes } = planificar(filas, [], {});
    const decisiones = Object.fromEntries(pendientes.map((g) => [g.id, { tipo: "fusionar" as const, principal: g.claves[0] }]));
    const plan = planificar(filas, [], decisiones);
    expect(plan.pendientes).toHaveLength(0);
    expect(plan.operaciones).toHaveLength(65 - 5);
    const nits = plan.operaciones.map((o) => o.nit).filter(Boolean);
    expect(new Set(nits).size).toBe(nits.length);
  });
});
