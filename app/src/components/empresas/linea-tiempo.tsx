import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { agruparPorMes, fechaLegible, type Hito } from "@/lib/empresas";
import { ESTILO_TIPO } from "./estilos-hito";

function HitoItem({ hito, ahora }: { hito: Hito; ahora: number }) {
  const estilo = ESTILO_TIPO[hito.tipo];
  const Icono = estilo.icono;
  const futuro = new Date(hito.fecha).getTime() > ahora;

  return (
    <li className="relative pb-6 pl-10 last:pb-0">
      {/* Punto sobre la línea vertical */}
      <span
        className={`absolute top-0 left-0 flex size-7 items-center justify-center rounded-full bg-white ring-4 ${estilo.anillo}`}
        aria-hidden
      >
        <Icono className={`size-3.5 ${estilo.texto}`} />
      </span>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`text-xs font-medium ${estilo.texto}`}>{estilo.etiqueta}</span>
        <time dateTime={hito.fecha} className="text-muted-foreground text-xs">
          {fechaLegible(hito.fecha)}
        </time>
        {futuro && <Badge variant="outline">Próximo</Badge>}
        {hito.estado && <Badge variant="secondary">{hito.estado}</Badge>}
      </div>
      <p className="mt-1 text-sm font-medium">{hito.titulo}</p>
      {hito.detalle && <p className="text-muted-foreground mt-0.5 text-sm">{hito.detalle}</p>}
    </li>
  );
}

export function LineaTiempo({ hitos }: { hitos: Hito[] }) {
  const grupos = agruparPorMes(hitos);
  const ahora = Date.now();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-5" aria-hidden /> Línea de tiempo
        </CardTitle>
        <CardDescription>
          Proyectos de aula, asesorías, diagnósticos, atenciones y eventos asistidos, en orden cronológico.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {grupos.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            Esta empresa aún no tiene interacciones registradas con el CDE.
          </p>
        ) : (
          <div className="space-y-8">
            {grupos.map((grupo) => (
              <section key={grupo.mes} aria-label={grupo.mes}>
                <h3 className="text-muted-foreground mb-4 text-xs font-semibold tracking-wide uppercase">{grupo.mes}</h3>
                {/* La línea vertical pasa por el centro de los puntos (14px = mitad de size-7) */}
                <ol className="relative before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-0.5 before:bg-border">
                  {grupo.hitos.map((hito) => (
                    <HitoItem key={`${hito.tipo}-${hito.id}`} hito={hito} ahora={ahora} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
