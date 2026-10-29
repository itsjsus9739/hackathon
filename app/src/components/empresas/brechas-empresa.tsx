"use client";

import { useState, useTransition } from "react";
import { CircleCheck, CircleDot, Loader2, Plus, RotateCcw, Target } from "lucide-react";

import { cerrarBrecha, reabrirBrecha, registrarBrecha } from "@/app/(app)/empresas/[id]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { BrechaEmpresa } from "@/lib/empresas";
import { resumenBrechas } from "@/lib/impacto";

type Catalogo = { id: string; area: string; descripcion: string }[];

const fecha = (f: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${f}T00:00:00Z`));

/**
 * Brechas al inicio e impactos al cierre sobre la misma lista: qué brecha se cerró, en qué semestre y con qué evidencia.
 * `catalogo` llega solo a quien puede registrar (CDE y equipo del proyecto de aula).
 */
export function BrechasEmpresa({
  idEmpresa,
  brechas,
  catalogo,
  semestreActual,
}: {
  idEmpresa: string;
  brechas: BrechaEmpresa[];
  catalogo: Catalogo | null;
  semestreActual: string;
}) {
  const resumen = resumenBrechas(brechas);
  const puedeEditar = catalogo !== null;
  const [agregando, setAgregando] = useState(false);
  const porArea = resumen.areas.map((a) => ({ ...a, brechas: brechas.filter((b) => b.area === a.area) }));
  const ejemplo = brechas.some((b) => b.es_ejemplo);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="size-5" aria-hidden /> Brechas e impactos
        </CardTitle>
        <CardDescription>
          {resumen.detectadas
            ? `${resumen.cerradas} de ${resumen.detectadas} brechas cerradas (${resumen.porcentaje} %). Se detectan al iniciar el acompañamiento y se cierran con evidencia del cambio.`
            : "Se marcan al iniciar el acompañamiento y se cierran, con evidencia, cuando la empresa logra el cambio."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {brechas.length === 0 && !agregando && (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">Aún no tiene brechas registradas.</p>
        )}

        {porArea.map((a) => (
          <section key={a.area}>
            <div className="mb-2 flex items-center justify-between gap-2 text-sm">
              <h3 className="font-semibold">{a.area}</h3>
              <span className="text-muted-foreground text-xs tabular-nums">
                {a.cerradas}/{a.detectadas} cerradas
              </span>
            </div>
            <div className="bg-muted mb-3 h-1.5 overflow-hidden rounded-full" aria-hidden>
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${a.porcentaje}%` }} />
            </div>
            <ul className="space-y-2">
              {a.brechas.map((b) => (
                <FilaBrecha key={b.id} brecha={b} idEmpresa={idEmpresa} puedeEditar={puedeEditar} />
              ))}
            </ul>
          </section>
        ))}

        {ejemplo && <p className="text-xs text-amber-700">Incluye brechas de ejemplo para la demostración.</p>}

        {puedeEditar &&
          (agregando ? (
            <NuevaBrecha idEmpresa={idEmpresa} catalogo={catalogo} semestreActual={semestreActual} cerrar={() => setAgregando(false)} />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAgregando(true)}>
              <Plus aria-hidden /> Registrar brecha
            </Button>
          ))}
      </CardContent>
    </Card>
  );
}

function FilaBrecha({ brecha: b, idEmpresa, puedeEditar }: { brecha: BrechaEmpresa; idEmpresa: string; puedeEditar: boolean }) {
  const [cerrando, setCerrando] = useState(false);
  const [evidencia, setEvidencia] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const cerrada = Boolean(b.cerrada_en);

  return (
    <li className="rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-start gap-2">
        {cerrada ? (
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Cerrada" />
        ) : (
          <CircleDot className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label="Abierta" />
        )}
        <span className="min-w-0 flex-1">{b.descripcion}</span>
        <Badge variant={cerrada ? "secondary" : "outline"} className={cerrada ? "bg-emerald-100 text-emerald-800" : ""}>
          {cerrada ? `Cerrada · ${fecha(b.cerrada_en!)}` : "Abierta"}
        </Badge>
      </div>
      <p className="text-muted-foreground mt-1 ml-6 text-xs">
        Detectada en {b.semestre} ({fecha(b.detectada_en)})
      </p>
      {cerrada && b.evidencia && <p className="mt-1 ml-6 text-xs">Evidencia: {b.evidencia}</p>}

      {puedeEditar && !cerrando && (
        <div className="mt-2 ml-6">
          {cerrada ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={ocupado}
              onClick={() =>
                iniciar(async () => {
                  const r = await reabrirBrecha({ id: b.id, id_empresa: idEmpresa });
                  setError(r.error ?? null);
                })
              }
            >
              <RotateCcw aria-hidden /> Reabrir
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setCerrando(true)}>
              <CircleCheck aria-hidden /> Marcar como cerrada
            </Button>
          )}
        </div>
      )}

      {cerrando && (
        <form
          className="mt-2 ml-6 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              const r = await cerrarBrecha({ id: b.id, id_empresa: idEmpresa, evidencia });
              if (r.error) setError(r.error);
              else setCerrando(false);
            });
          }}
        >
          <Textarea
            value={evidencia}
            onChange={(e) => setEvidencia(e.target.value)}
            rows={2}
            maxLength={2000}
            required
            placeholder="¿Qué cambió? Ej.: ya factura electrónicamente desde septiembre."
            aria-label="Evidencia del cierre"
          />
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={ocupado}>
              {ocupado && <Loader2 className="animate-spin" />} Guardar cierre
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setCerrando(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
      {error && <p className="text-destructive mt-1 ml-6 text-xs">{error}</p>}
    </li>
  );
}

function NuevaBrecha({
  idEmpresa,
  catalogo,
  semestreActual,
  cerrar,
}: {
  idEmpresa: string;
  catalogo: Catalogo;
  semestreActual: string;
  cerrar: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const areas = [...new Set(catalogo.map((c) => c.area))];

  return (
    <form
      className="space-y-3 rounded-md border p-3"
      action={(form) =>
        iniciar(async () => {
          const r = await registrarBrecha({
            id_empresa: idEmpresa,
            id_brecha: String(form.get("id_brecha") ?? ""),
            semestre: String(form.get("semestre") ?? ""),
          });
          if (r.error) setError(r.error);
          else cerrar();
        })
      }
    >
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Brecha</span>
        <NativeSelect name="id_brecha" required defaultValue="">
          <option value="" disabled>
            Elige una brecha de la lista del área…
          </option>
          {areas.map((area) => (
            <optgroup key={area} label={area}>
              {catalogo
                .filter((c) => c.area === area)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.descripcion}
                  </option>
                ))}
            </optgroup>
          ))}
        </NativeSelect>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Semestre</span>
        <NativeSelect name="semestre" defaultValue={semestreActual}>
          {[semestreActual, semestreAnterior(semestreActual)].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
      </label>
      {error && <p className="text-destructive text-xs">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={ocupado}>
          {ocupado && <Loader2 className="animate-spin" />} Registrar
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={cerrar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

const semestreAnterior = (s: string) => {
  const [anio, n] = s.split("-").map(Number);
  return n === 2 ? `${anio}-1` : `${anio - 1}-2`;
};
