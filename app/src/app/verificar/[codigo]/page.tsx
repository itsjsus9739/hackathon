import type { Metadata } from "next";
import { BadgeCheck, CircleX, ShieldAlert } from "lucide-react";

import { LogoCde } from "@/components/marca/logo-cde";
import type { DatosCertificado } from "@/components/certificado/certificado";
import { calcularNivel } from "@/lib/gamificacion";
import { CODIGO_CERTIFICADO, normalizarCodigo } from "@/lib/certificados";
import { ETIQUETA_ROL } from "@/lib/roles";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioVerificar } from "../formulario";

export const metadata: Metadata = { title: "Verificar certificado · CDE Conecta", robots: { index: false } };

const FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" });

// Página pública (sin sesión): confirma que un certificado lo emitió el CDE y muestra solo lo que dice.
export default async function PaginaVerificar({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = normalizarCodigo((await params).codigo);
  const supabase = await crearClienteServidor();
  const { data } = CODIGO_CERTIFICADO.test(codigo) ? await supabase.rpc("verificar_certificado", { codigo }) : { data: null };
  const c = data?.[0] ?? null;
  const d = c?.datos as unknown as DatosCertificado | undefined;

  return (
    <main className="bg-background flex min-h-screen flex-col items-center px-4 py-10">
      <LogoCde className="w-48" priority />
      <div className="bg-card mt-6 w-full max-w-lg rounded-3xl border p-6 shadow-sm">
        <p className="text-muted-foreground text-center text-sm">Verificación de certificado</p>
        <p className="mt-1 text-center font-mono text-lg font-semibold tracking-wider">{codigo}</p>

        {!c || !d ? (
          <div className="mt-5 flex flex-col items-center gap-2 text-center">
            <CircleX className="size-10 text-red-600" aria-hidden />
            <p className="font-semibold">No encontramos un certificado con ese código</p>
            <p className="text-muted-foreground text-sm">Revisa que esté bien escrito (formato CDE-XXXX-XXXX).</p>
          </div>
        ) : c.valido ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-col items-center gap-1 text-center">
              <BadgeCheck className="size-11 text-[var(--primario)]" aria-hidden />
              <p className="text-lg font-semibold text-[var(--primario-texto)]">Certificado auténtico</p>
              <p className="text-muted-foreground text-sm">Emitido por el Centro de Desarrollo Empresarial UNAB</p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Nombre</dt>
              <dd className="font-semibold">{c.nombre}</dd>
              <dt className="text-muted-foreground">Rol</dt>
              <dd>
                {ETIQUETA_ROL[c.rol as keyof typeof ETIQUETA_ROL] ?? c.rol} · semestre {d.semestre}
              </dd>
              <dt className="text-muted-foreground">Emitido el</dt>
              <dd>{FECHA.format(new Date(c.emitido_en))}</dd>
              <dt className="text-muted-foreground">Logros</dt>
              <dd>
                {d.puntos} puntos · nivel {calcularNivel(d.puntos).actual.nombre} · {d.insignias.length} insignias · {d.eventos_asistidos} eventos
              </dd>
            </dl>
          </div>
        ) : (
          <div className="mt-5 flex flex-col items-center gap-2 text-center">
            <ShieldAlert className="size-10 text-red-600" aria-hidden />
            <p className="font-semibold text-red-700">Este certificado fue anulado</p>
            <p className="text-muted-foreground text-sm">
              Emitido a {c.nombre}; anulado el {FECHA.format(new Date(c.anulado_en!))}
              {c.motivo_anulacion && `: ${c.motivo_anulacion}`}.
            </p>
          </div>
        )}
      </div>
      <div className="mt-6 w-full max-w-lg">
        <FormularioVerificar />
      </div>
    </main>
  );
}
