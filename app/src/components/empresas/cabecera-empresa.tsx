import { Building2, Factory, GraduationCap, Landmark, MapPin, Ruler, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EmpresaFicha, Hito, Postulacion, TipoHito } from "@/lib/empresas";
import { contarPorTipo } from "@/lib/empresas";
import { ESTILO_TIPO } from "./estilos-hito";

function Dato({ icono: Icono, etiqueta, valor }: { icono: LucideIcon; etiqueta: string; valor: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md">
        <Icono className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-muted-foreground text-xs">{etiqueta}</dt>
        <dd className={valor ? "text-sm font-medium" : "text-muted-foreground text-sm italic"}>{valor ?? "Sin dato"}</dd>
      </div>
    </div>
  );
}

const ORDEN_RESUMEN: TipoHito[] = ["proyecto_aula", "cita", "diagnostico", "evento", "atencion"];

export function CabeceraEmpresa({
  empresa,
  hitos,
  postulaciones = [],
}: {
  empresa: EmpresaFicha;
  hitos: Hito[];
  postulaciones?: Postulacion[];
}) {
  const nit = empresa.nit ? `NIT ${empresa.nit}${empresa.nit_dv !== null ? `-${empresa.nit_dv}` : ""}` : "Sin NIT registrado";
  const ubicacion = [empresa.municipio, empresa.departamento].filter(Boolean).join(", ") || null;
  const conteo = contarPorTipo(hitos);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Building2 className="text-primario size-5" aria-hidden />
          <CardTitle className="text-2xl">{empresa.nombre}</CardTitle>
        </div>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <span>{nit}</span>
          {empresa.vinculo_unab && <Badge variant="secondary">Comunidad UNAB · {empresa.vinculo_unab}</Badge>}
          {postulaciones.map((p) => (
            <Badge key={p.id} variant="outline" title={`Origen: ${p.origen_registro}`}>
              Postulación · {p.estado}
            </Badge>
          ))}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {empresa.descripcion && <p className="text-muted-foreground line-clamp-3 max-w-3xl text-sm">{empresa.descripcion}</p>}

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Dato icono={Factory} etiqueta="Sector" valor={empresa.sector} />
          <Dato icono={Ruler} etiqueta="Tamaño" valor={empresa.tamano} />
          <Dato icono={Landmark} etiqueta="Formalización" valor={empresa.formalizacion} />
          <Dato icono={MapPin} etiqueta="Municipio" valor={ubicacion} />
          <Dato icono={GraduationCap} etiqueta="Vínculo UNAB" valor={empresa.vinculo_unab} />
        </dl>

        <div className="flex flex-wrap gap-2 border-t pt-4" aria-label="Resumen de interacciones">
          {ORDEN_RESUMEN.map((tipo) => {
            const { etiquetaSingular, etiquetaPlural, icono: Icono, punto } = ESTILO_TIPO[tipo];
            return (
              <span key={tipo} className="bg-muted inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
                <span className={`size-2 rounded-full ${punto}`} aria-hidden />
                <Icono className="size-3.5" aria-hidden />
                <span className="font-semibold">{conteo[tipo]}</span> {conteo[tipo] === 1 ? etiquetaSingular : etiquetaPlural}
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
