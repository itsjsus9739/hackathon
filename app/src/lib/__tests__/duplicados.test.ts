import { describe, expect, it } from "vitest";
import { agruparDuplicados, encontrarDuplicados, normalizarNombre, similitud } from "../duplicados";

describe("detección de duplicados", () => {
  it("normaliza tildes, mayúsculas y sufijos societarios", () => {
    expect(normalizarNombre("Café Arábica S.A.S.")).toBe("cafe arabica");
    expect(normalizarNombre("CAFE ARABICA SAS")).toBe("cafe arabica");
    expect(normalizarNombre("Dulces La Abuela Ltda")).toBe("dulces la abuela");
  });

  it("encuentra la misma empresa escrita distinto", () => {
    expect(similitud("Panadería El Trigal", "panaderia el trigal SAS")).toBe(1);
    expect(similitud("Panadería El Trigal", "Panaderia Trigal")).toBeGreaterThan(0.55);
    expect(similitud("Panadería El Trigal", "Ferretería Central")).toBeLessThan(0.3);
  });

  it("empareja por NIT, correo, teléfono o nombre y agrupa", () => {
    const pares = encontrarDuplicados([
      { id: "1", nombre: "Café Arábica S.A.S.", nit: "900.123.456" },
      { id: "2", nombre: "Arabica Coffee", nit: "900123456-1" },
      { id: "3", nombre: "CAFE ARABICA", correo: "Ventas@arabica.co" },
      { id: "4", nombre: "Tostadores Unidos", correo: "ventas@arabica.co " },
      { id: "5", nombre: "Ferretería Central", telefono: "+57 300 123 4567" },
      { id: "6", nombre: "Ferre Central", telefono: "3001234567" },
      { id: "7", nombre: "Turismo Chicamocha" },
    ]);
    expect(pares.find((p) => p.a === "1" && p.b === "2")?.razon).toBe("nit");
    expect(pares.find((p) => p.a === "3" && p.b === "4")?.razon).toBe("correo");
    expect(pares.find((p) => p.a === "5" && p.b === "6")?.razon).toBe("telefono");
    const grupos = agruparDuplicados(pares).map((g) => g.sort());
    expect(grupos).toContainEqual(["1", "2", "3", "4"]);
    expect(grupos.flat()).not.toContain("7");
  });
});

describe("falsos positivos por nombre", () => {
  it("no une nombres que solo cambian en un número o con NIT distintos", () => {
    const pares = encontrarDuplicados([
      { id: "1", nombre: "Emprendimiento El Bosque 3" },
      { id: "2", nombre: "Emprendimiento El Bosque 8" },
      { id: "3", nombre: "Café El Bosque 28" },
      { id: "4", nombre: "Cafe El Bosque 28" },
      { id: "5", nombre: "Panadería Guane", nit: "900101773" },
      { id: "6", nombre: "Panaderia Guane SAS", nit: "901494448" },
    ]);
    expect(pares.map((p) => [p.a, p.b])).toEqual([["3", "4"]]);
  });
});
