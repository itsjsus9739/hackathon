import { ClipboardCheck, TrendingUp, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AREAS_DIAGNOSTICO, mayorBrecha, ZONA_HORARIA, type Diagnostico } from "@/lib/empresas";
import { compararDiagnosticos, textoCambio, type Comparacion } from "@/lib/impacto";

const fechaCorta = (fecha: string) =>
  new Intl.DateTimeFormat("es-CO", { month: "short", year: "numeric", timeZone: ZONA_HORARIA }).format(new Date(`${fecha}T12:00:00`));

const COLOR_NIVEL: Record<string, string> = { Bajo: "bg-rose-500", Medio: "bg-amber-500", Alto: "bg-emerald-600" };

export function DiagnosticoMadurez({ diagnostico, historial = [] }: { diagnostico: Diagnostico | null; historial?: Diagnostico[] }) {
  const comparacion = compararDiagnosticos(historial);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-5" aria-hidden /> Madurez empresarial
        </CardTitle>
        <CardDescription>
          {diagnostico
            ? `Último diagnóstico · ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: ZONA_HORARIA }).format(
                new Date(`${diagnostico.fecha}T12:00:00`),
              )}`
            : "Escala de 1 a 5 en las seis áreas del autodiagnóstico del CDE."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!diagnostico ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
            Aún no tiene diagnóstico de madurez.
          </p>
        ) : (
          <Resultado diagnostico={diagnostico} comparacion={comparacion} />
        )}
      </CardContent>
    </Card>
  );
}

function Resultado({ diagnostico, comparacion }: { diagnostico: Diagnostico; comparacion: Comparacion | null }) {
  const brecha = mayorBrecha(diagnostico);
  const color = COLOR_NIVEL[diagnostico.nivel ?? ""] ?? "bg-primary";
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-2">
        <p>
          <span className="text-3xl font-semibold">{Number(diagnostico.promedio).toFixed(1)}</span>
          <span className="text-muted-foreground text-sm"> / 5 promedio</span>
        </p>
        <div className="flex flex-col items-end gap-1">
          {diagnostico.nivel && <Badge variant="secondary">Nivel {diagnostico.nivel}</Badge>}
          {diagnostico.tipo_iniciativa && <span className="text-muted-foreground text-xs">{diagnostico.tipo_iniciativa}</span>}
        </div>
      </div>

      {comparacion && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <p className="flex items-center gap-1.5 font-semibold">
            <TrendingUp className="size-3.5" aria-hidden />
            {fechaCorta(comparacion.fechaInicial)} → {fechaCorta(comparacion.fechaFinal)}: {comparacion.promedioInicial.toFixed(1)} →{" "}
            {comparacion.promedioFinal.toFixed(1)} ({textoCambio(comparacion.cambioPromedio)})
          </p>
          {comparacion.mayorAvance && (
            <p className="mt-1">
              Mayor avance: <b>{comparacion.mayorAvance.nombre}</b> ({textoCambio(comparacion.mayorAvance.cambio)}). La marca gris en
              cada barra es la línea base.
            </p>
          )}
        </div>
      )}

      <ul className="space-y-3" aria-label="Puntaje por área">
        {AREAS_DIAGNOSTICO.map((area) => {
          const valor = Number(diagnostico[area.campo]);
          const esBrecha = area.campo === brecha.campo;
          const eje = comparacion?.ejes.find((e) => e.campo === area.campo);
          return (
            <li key={area.campo}>
              <div className="mb-1 flex justify-between gap-2 text-xs">
                <span className={esBrecha ? "font-semibold" : "text-muted-foreground"}>{area.nombre}</span>
                <span className="font-medium tabular-nums">
                  {eje && eje.cambio !== 0 && (
                    <span className={`mr-1.5 ${eje.cambio > 0 ? "text-emerald-700" : "text-rose-700"}`}>{textoCambio(eje.cambio)}</span>
                  )}
                  {valor.toFixed(1)}
                </span>
              </div>
              <div className="bg-muted relative h-2 overflow-hidden rounded-full" role="presentation">
                <div className={`h-full rounded-full ${esBrecha ? "bg-rose-500" : color}`} style={{ width: `${(valor / 5) * 100}%` }} />
                {eje && (
                  <span
                    className="absolute inset-y-0 w-0.5 bg-slate-700/60"
                    style={{ left: `calc(${(eje.antes / 5) * 100}% - 1px)` }}
                    title={`Línea base: ${eje.antes.toFixed(1)}`}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="flex gap-2 rounded-md bg-rose-50 p-3 text-xs text-rose-800">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Mayor brecha: <b>{brecha.nombre}</b> ({Number(diagnostico[brecha.campo]).toFixed(1)} / 5). Priorízala en el plan de trabajo
          y en las capacitaciones que se le recomienden.
        </span>
      </p>
    </div>
  );
}
