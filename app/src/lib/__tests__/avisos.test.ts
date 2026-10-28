import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const enviar = vi.fn(async () => ({ data: { id: "1" }, error: null }));
vi.mock("resend", () => ({ Resend: class { emails = { send: enviar }; } }));
const rpc = vi.fn(async () => ({ data: [{ correo: "admin@unab.edu.co", nombre: "Admin" }, { correo: "ana@unab.edu.co", nombre: "Ana" }], error: null }));
vi.mock("@/lib/supabase/server", () => ({ crearClienteServicio: () => ({ rpc }) }));

const { avisarRegistroDocente } = await import("../avisos");
const datos = { nombre: "María <script>", correo: "maria@unab.edu.co", institucional: true, origen: "https://app.test" };

describe("aviso al CDE de un registro como docente", () => {
  beforeEach(() => {
    enviar.mockClear();
    process.env.RESEND_API_KEY = "re_prueba";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_prueba";
  });

  it("envía un correo a todos los miembros y admins del CDE, con el nombre escapado", async () => {
    await avisarRegistroDocente(datos);
    expect(rpc).toHaveBeenCalledWith("correos_cde");
    const correo = (enviar.mock.calls[0] as unknown as [{ to: string[]; subject: string; html: string }])[0];
    expect(correo.to).toEqual(["admin@unab.edu.co", "ana@unab.edu.co"]);
    expect(correo.subject).toContain("docente");
    expect(correo.html).toContain("María &lt;script&gt;");
    expect(correo.html).not.toContain("<script>");
  });

  it("sin configuración de correo no hace nada (el aviso dentro de la app sigue funcionando)", async () => {
    delete process.env.RESEND_API_KEY;
    await avisarRegistroDocente(datos);
    expect(enviar).not.toHaveBeenCalled();
  });
});
