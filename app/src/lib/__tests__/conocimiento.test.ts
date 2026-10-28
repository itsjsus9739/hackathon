import { describe, expect, it } from "vitest";

import { brechasPorArea, calidadDatos, contarPor, type EmpresaResumen } from "../conocimiento";

const empresa = (e: Partial<EmpresaResumen>): EmpresaResumen => ({
  nit: null,
  sector: null,
  tamano: null,
  formalizacion: null,
  municipio: null,
  vinculo_unab: null,
  id_representante: null,
  contactos: 0,
  datos_estimados: [],
  ...e,
});

describe("tablero de conocimiento", () => {
  it("cuenta por valor, separa los vacíos y agrupa el resto en Otros", () => {
    const filas = ["A", "A", "B", "C", "D", null, ""].map((s) => ({ s }));
    expect(contarPor(filas, (f) => f.s, { maximo: 3 })).toEqual({
      barras: [
        { etiqueta: "A", valor: 2 },
        { etiqueta: "B", valor: 1 },
        { etiqueta: "Otros", valor: 2 },
      ],
      sinDato: 2,
    });
    expect(contarPor(filas, (f) => f.s, { orden: ["D", "C", "B", "A"] }).barras.map((b) => b.etiqueta)).toEqual(["D", "C", "B", "A"]);
  });

  it("mide la calidad de los datos", () => {
    const { campos, perfilCompleto } = calidadDatos([
      empresa({ nit: "900", sector: "Alimentos", tamano: "Micro", municipio: "Girón", contactos: 1 }),
      empresa({ nit: "901", id_representante: "u1" }),
    ]);
    expect(campos.find((c) => c.campo === "NIT")?.porcentaje).toBe(100);
    expect(campos.find((c) => c.campo === "Sector")?.porcentaje).toBe(50);
    expect(campos.find((c) => c.campo === "Contacto")?.porcentaje).toBe(100);
    expect(perfilCompleto).toBe(50);
  });

  it("promedia las brechas con el diagnóstico más reciente de cada empresa", () => {
    const base = { estrategia: 3, mercadeo_ventas: 3, financiera: 3, normativa_legal: 3, productividad: 3, creado_en: "x" };
    const { barras, empresas } = brechasPorArea([
      { ...base, id_empresa: "e1", fecha: "2026-01-01", transformacion_digital: 5 },
      { ...base, id_empresa: "e1", fecha: "2026-06-01", transformacion_digital: 1 },
      { ...base, id_empresa: "e2", fecha: "2026-03-01", transformacion_digital: 2 },
    ]);
    expect(empresas).toBe(2);
    expect(barras.find((b) => b.etiqueta === "Transformación Digital")?.valor).toBe(1.5);
    expect(barras.find((b) => b.etiqueta === "Estrategia Empresarial")?.valor).toBe(3);
  });
});
