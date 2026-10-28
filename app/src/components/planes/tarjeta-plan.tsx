import Link from "next/link";
import { CircleCheck, CircleDashed, Clock, TriangleAlert, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { estaVencido, nombreArea, textoPlazo } from "@/lib/planes";
import { cn } from "@/lib/utils";
import { ControlAvance, SelectorEstadoPlan } from "./controles";

export type PlanVista = {
  id: string;
  id_empresa: string;
  empresa: string;
  titulo: string;
  area: string | null;
  estado: string;
  fecha_limite: string | null;
  responsable: string | null;
  avance: number;
  vencidos: number;
  es_ejemplo: boolean;
  editableEstado: boolean;
  compromisos: {
    id: string;
    descripcion: string;
    responsable: string | null;
    fecha_limite: string | null;
    estado: string;
    avance: number;
    editable: boolean;
  }[];
};

function Barra({ valor, alerta = false }: { valor: number; alerta?: boolean }) {
  return (
    <span
      className="bg-muted block h-2 w-full overflow-hidden rounded-full"
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className={cn("block h-full rounded-full", alerta ? "bg-destructive" : "bg-[var(--serie-1)]")}
        style={{ width: `${valor}%` }}
      />
    </span>
  );
}

function EstadoCompromiso({ estado, vencido }: { estado: string; vencido: boolean }) {
  if (vencido)
    return (
      <Badge variant="destructive">
        <TriangleAlert aria-hidden /> Vencido
      </Badge>
    );
  if (estado === "Cumplido")
    return (
      <Badge variant="outline" className="border-emerald-300 text-emerald-700">
        <CircleCheck aria-hidden /> Cumplido
      </Badge>
    );
  if (estado === "En curso")
    return (
      <Badge variant="outline">
        <Clock aria-hidden /> En curso
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <CircleDashed aria-hidden /> {estado}
    </Badge>
  );
}

export function TarjetaPlan({ plan, hoy }: { plan: PlanVista; hoy: string }) {
  const area = nombreArea(plan.area);
  return (
    <Card className={cn(plan.vencidos > 0 && "border-destructive/40")}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <Link href={`/empresas/${plan.id_empresa}`} className="text-muted-foreground text-xs hover:underline">
              {plan.empresa}
            </Link>
            <CardTitle className="text-base">{plan.titulo}</CardTitle>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1">
                <UserRound className="size-3.5" aria-hidden /> {plan.responsable ?? "Responsable sin nombre visible"}
              </span>
              {area && <span>Brecha: {area}</span>}
              {plan.fecha_limite && <span>Cierre: {textoPlazo(plan.fecha_limite, plan.estado, hoy)}</span>}
              {plan.es_ejemplo && <Badge variant="outline">Ejemplo</Badge>}
            </p>
          </div>
          {plan.editableEstado ? (
            <SelectorEstadoPlan id={plan.id} estado={plan.estado} />
          ) : (
            <Badge variant="secondary">{plan.estado}</Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Barra valor={plan.avance} />
          <span className="w-12 text-right text-sm font-semibold tabular-nums">{plan.avance} %</span>
        </div>
        {plan.vencidos > 0 && (
          <p className="text-destructive flex items-center gap-1 text-xs font-medium">
            <TriangleAlert className="size-3.5" aria-hidden />
            {plan.vencidos === 1 ? "1 compromiso vencido" : `${plan.vencidos} compromisos vencidos`}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {plan.compromisos.map((c) => {
            const vencido = estaVencido(c, hoy);
            return (
              <li key={c.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-sm", c.estado === "Cumplido" && "text-muted-foreground line-through")}>
                      {c.descripcion}
                    </span>
                    <EstadoCompromiso estado={c.estado} vencido={vencido} />
                  </div>
                  <p className={cn("text-xs", vencido ? "text-destructive" : "text-muted-foreground")}>
                    {c.responsable ?? plan.responsable ?? "Responsable del plan"} · {textoPlazo(c.fecha_limite, c.estado, hoy)}
                  </p>
                  <div className="flex max-w-xs items-center gap-2">
                    <Barra valor={c.avance} alerta={vencido} />
                    <span className="text-muted-foreground w-12 text-right text-xs whitespace-nowrap tabular-nums">{c.avance} %</span>
                  </div>
                </div>
                {c.editable && <ControlAvance id={c.id} avance={c.avance} estado={c.estado} />}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
