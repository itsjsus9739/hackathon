import { LogoCde } from "@/components/marca/logo-cde";
import { calcularNivel } from "@/lib/gamificacion";
import { ETIQUETA_ROL } from "@/lib/roles";

// Certificado digital de participación (A4 horizontal, colores fijos claros para imprimir o guardar como PDF).
// Los logros salen de la foto que tomó la base al emitirlo: no cambian después.

export type DatosCertificado = {
  nombre: string;
  rol: string;
  semestre: string;
  puntos: number;
  eventos_asistidos: number;
  aportes_validados: number;
  compromisos_cumplidos: number;
  insignias: { nombre: string; nivel: number }[];
  eventos: string[];
};

const FECHA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
});

export function Certificado({
  datos,
  codigo,
  emitidoEn,
  qr,
  urlVerificacion,
  anulado,
}: {
  datos: DatosCertificado;
  codigo: string;
  emitidoEn: string;
  qr: string;
  urlVerificacion: string;
  anulado: boolean;
}) {
  const nivel = calcularNivel(datos.puntos).actual.nombre;
  const rol = ETIQUETA_ROL[datos.rol as keyof typeof ETIQUETA_ROL] ?? datos.rol;
  const logros = [
    `${datos.puntos} puntos · nivel ${nivel}`,
    datos.eventos_asistidos ? `${datos.eventos_asistidos} eventos y capacitaciones del CDE` : null,
    datos.aportes_validados ? `${datos.aportes_validados} aportes validados en proyectos de aula` : null,
    datos.compromisos_cumplidos ? `${datos.compromisos_cumplidos} compromisos cumplidos` : null,
  ].filter(Boolean) as string[];

  return (
    <article className="certificado relative mx-auto flex aspect-[297/210] w-full max-w-[297mm] flex-col overflow-hidden bg-white text-[#0b3d2a] shadow-xl print:shadow-none">
      {/* Marco */}
      <div className="pointer-events-none absolute inset-[5mm] rounded-sm border-[3px] border-[#00a862]" aria-hidden />
      <div className="pointer-events-none absolute inset-[7mm] rounded-sm border border-[#00a862]/40" aria-hidden />
      {anulado && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="-rotate-12 rounded-xl border-8 border-red-600/70 px-10 py-4 text-[44pt] font-black tracking-widest text-red-600/70">
            ANULADO
          </span>
        </div>
      )}

      <div className="relative flex flex-1 flex-col px-[18mm] pt-[14mm] pb-[12mm]">
        <header className="flex items-start justify-between">
          <LogoCde className="w-[52mm] dark:brightness-100" />
          <p className="text-right text-[9pt] text-[#36564a]">
            Código <b className="font-mono text-[10pt] tracking-wider text-[#0b3d2a]">{codigo}</b>
          </p>
        </header>

        <div className="my-auto py-[4mm]">
          <div className="text-center">
            <p className="text-[11pt] font-semibold tracking-[0.3em] text-[#00784a] uppercase">Certificado de participación</p>
            <p className="mt-[5mm] text-[11pt] text-[#36564a]">
              El Centro de Desarrollo Empresarial de la Universidad Autónoma de Bucaramanga certifica que
            </p>
            <p className="mt-[3mm] font-serif text-[30pt] leading-tight font-bold">{datos.nombre}</p>
            <p className="mt-[1mm] text-[11pt] text-[#36564a]">
              {rol} · semestre {datos.semestre}
            </p>
            <p className="mx-auto mt-[4mm] max-w-[200mm] text-[11.5pt] leading-relaxed">
              participó activamente en las actividades de formación, acompañamiento y emprendimiento del CDE a través de CDE Conecta, con
              los siguientes logros:
            </p>
          </div>

          <div className="mx-auto mt-[4mm] grid w-full max-w-[220mm] grid-cols-2 gap-x-[10mm] text-[10pt]">
            <ul className="space-y-[1.5mm]">
              {logros.map((l) => (
                <li key={l} className="flex gap-2">
                  <span className="text-[#00a862]">✓</span> {l}
                </li>
              ))}
            </ul>
            <div>
              {datos.insignias.length > 0 && (
                <p>
                  <b>Insignias:</b>{" "}
                  {datos.insignias
                    .slice(0, 8)
                    .map((i) => i.nombre)
                    .join(" · ")}
                  {datos.insignias.length > 8 && ` y ${datos.insignias.length - 8} más`}
                </p>
              )}
              {datos.eventos.length > 0 && (
                <p className="mt-[1.5mm] text-[9pt] text-[#36564a]">
                  <b className="text-[#0b3d2a]">Asistió a:</b> {datos.eventos.slice(0, 5).join(" · ")}
                </p>
              )}
            </div>
          </div>
        </div>

        <footer className="mt-auto flex items-end justify-between gap-6">
          <div className="text-[9pt] text-[#36564a]">
            <p>Bucaramanga, {FECHA.format(new Date(emitidoEn))}</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-[1.5mm] w-[62mm] border-t border-[#0b3d2a]" />
            <p className="text-[10pt] font-semibold">Centro de Desarrollo Empresarial</p>
            <p className="text-[9pt] text-[#36564a]">Universidad Autónoma de Bucaramanga · UNAB</p>
          </div>
          <div className="flex items-end gap-2 text-right">
            <p className="max-w-[42mm] text-[7.5pt] leading-tight text-[#36564a]">
              Verifica su autenticidad escaneando el código o en{" "}
              <b className="whitespace-nowrap">{urlVerificacion.replace(/^https?:\/\//, "").replace(/\/[^/]+$/, "")}</b>
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element -- QR generado en el servidor (data URL) */}
            <img src={qr} alt={`Código QR para verificar el certificado ${codigo}`} className="size-[24mm]" />
          </div>
        </footer>
      </div>
    </article>
  );
}
