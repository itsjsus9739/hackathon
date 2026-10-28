import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { validarConsulta } = await import("../ia/sql");

describe("validación del SQL del asistente", () => {
  it("acepta un SELECT o un WITH y quita el punto y coma final y los comentarios", () => {
    expect(validarConsulta("select count(*) from empresas;")).toEqual({ ok: true, sql: "select count(*) from empresas" });
    expect(validarConsulta("-- conteo\nWITH x as (select 1) select * from x")).toMatchObject({ ok: true });
  });

  it("rechaza escrituras, varias sentencias y funciones peligrosas", () => {
    for (const sql of [
      "delete from empresas",
      "update empresas set nombre = 'x'",
      "select 1; drop table empresas",
      "select pg_sleep(30)",
      "/* hola */ insert into sectores values ('x')",
      "",
    ]) {
      expect(validarConsulta(sql).ok, sql).toBe(false);
    }
  });
});
