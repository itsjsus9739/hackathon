import Link from "next/link";
import { Info, TrendingUp, TriangleAlert } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Barra, Calidad, contarPor } from "@/lib/conocimiento";
import { GraficaBarras } from "./grafica-barras";

type Conteo = ReturnType<typeof contarPor>;

export type DatosTablero = {
  totalEmpresas: number;
  estimados: { sector: number; tamano: number };
  calidad: { campos: Calidad[]; perfilCompleto: number };
  brechas: { barras: Barra[]; empresas: number };
  masDebil: Barra | null;
  ejemplos: number;
  porSector: Conteo;
  porTamano: Conteo;
  porMunicipio: Conteo;
  porFormalizacion: Conteo;
  formalizacionRegistrada: boolean;
  porPostulacion: Conteo;
  postulaciones: number;
  proyectos: number;
  atenciones: number;
  impacto: {
    brechas: { detectadas: number; cerradas: number; porcentaje: number };
    cerradasPorArea: Barra[];
    avance: { empresas: number; cambioPromedio: number; ejes: Barra[] };
    ejemplo: boolean;
  };
};

export function Tablero({ datos: d }: { datos: DatosTablero }) {
  const indicadores = [
    { etiqueta: "Empresas", valor: d.totalEmpresas, nota: `${d.calidad.perfilCompleto}% con perfil básico completo` },
    { etiqueta: "Postulaciones", valor: d.postulaciones, nota: "a la convocatoria del CDE" },
    { etiqueta: "Proyectos de aula", valor: d.proyectos, nota: "con empresas del CDE" },
    { etiqueta: "Atenciones", valor: d.atenciones, nota: "sesiones y acompañamientos" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Conocimiento</h1>
        <p className="text-muted-foreground text-sm">
          Qué empresas acompaña el CDE, qué tan completos están sus datos y dónde están sus mayores brechas.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {indicadores.map((i) => (
          <div key={i.etiqueta} className="rounded-lg border p-4">
            <p className="text-muted-foreground text-xs">{i.etiqueta}</p>
            <p className="text-3xl font-semibold tabular-nums">{i.valor.toLocaleString("es-CO")}</p>
            <p className="text-muted-foreground mt-1 text-xs">{i.nota}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calidad de los datos</CardTitle>
            <CardDescription>
              % de las {d.totalEmpresas} empresas que tienen cada dato. Para completarlos,{" "}
              <Link href="/importar" className="underline underline-offset-4">
                importa y depura
              </Link>{" "}
              las bases del CDE.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {d.calidad.campos.map((c) => (
                <li key={c.campo} className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-3 text-sm">
                  <span>{c.campo}</span>
                  <span className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
                    <span className="block h-full rounded-full bg-[var(--serie-1)]" style={{ width: `${c.porcentaje}%` }} />
                  </span>
                  <span className="text-right tabular-nums" title={`${c.completos} de ${d.totalEmpresas}`}>
                    {c.porcentaje}%
                  </span>
                </li>
              ))}
            </ul>
            {(d.estimados.sector > 0 || d.estimados.tamano > 0) && (
              <p className="mt-4 flex gap-2 text-xs text-amber-700">
                <TriangleAlert className="size-4 shrink-0" aria-hidden />
                El sector de {d.estimados.sector} empresas y el tamaño de {d.estimados.tamano} son estimados a partir del nombre
                para la demostración; en la Ficha 360° aparecen marcados como «Estimado».
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brechas por dimensión del diagnóstico</CardTitle>
            <CardDescription>
              Promedio de madurez (1 a 5) en {d.brechas.empresas} empresas, con su diagnóstico más reciente.
              {d.masDebil && d.brechas.empresas > 0 && (
                <>
                  {" "}
                  La mayor brecha está en <b className="text-foreground">{d.masDebil.etiqueta}</b> ({d.masDebil.valor.toLocaleString("es-CO")}) ◂.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <GraficaBarras
              datos={d.brechas.barras}
              medida="de promedio sobre 5"
              maximo={5}
              decimales={1}
              destacar={d.masDebil?.etiqueta}
              anchoEtiquetas={170}
            />
            {d.ejemplos > 0 && (
              <p className="flex gap-2 text-xs text-amber-700">
                <TriangleAlert className="size-4 shrink-0" aria-hidden />
                Incluye {d.ejemplos} diagnósticos de ejemplo para la demostración; se reemplazan al cargar los autodiagnósticos reales.
              </p>
            )}
          </CardContent>
        </Card>

        <Impacto impacto={d.impacto} />

        <Distribucion titulo="Empresas por sector" datos={d.porSector} />
        <Distribucion titulo="Empresas por tamaño" datos={d.porTamano} anchoEtiquetas={110} />
        <Distribucion
          titulo="Empresas por formalización"
          datos={d.porFormalizacion}
          nota={d.formalizacionRegistrada ? undefined : "Aún no se registra la formalización: se estima por si la empresa tiene NIT."}
          anchoEtiquetas={130}
        />
        <Distribucion titulo="Empresas por municipio" datos={d.porMunicipio} anchoEtiquetas={110} />
        <Distribucion titulo="Postulaciones por estado" datos={d.porPostulacion} medida="postulaciones" anchoEtiquetas={120} />
      </div>
    </div>
  );
}

function Distribucion({
  titulo,
  datos,
  nota,
  medida = "empresas",
  anchoEtiquetas,
}: {
  titulo: string;
  datos: Conteo;
  nota?: string;
  medida?: string;
  anchoEtiquetas?: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        {datos.sinDato > 0 && (
          <CardDescription>
            {datos.sinDato} sin este dato ({medida === "empresas" ? "no aparecen en la gráfica" : "sin clasificar"}).
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <GraficaBarras datos={datos.barras} medida={medida} anchoEtiquetas={anchoEtiquetas} />
        {nota && (
          <p className="text-muted-foreground flex gap-2 text-xs">
            <Info className="size-4 shrink-0" aria-hidden />
            {nota}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const decimal = (v: number) => v.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** ¿Qué cambió en las empresas después del acompañamiento? Brechas cerradas y avance entre diagnósticos. */
function Impacto({ impacto: i }: { impacto: DatosTablero["impacto"] }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4" aria-hidden /> Impacto del acompañamiento
        </CardTitle>
        <CardDescription>
          Qué cambió en las empresas: brechas cerradas sobre la misma lista con que se detectaron y avance entre el primer y el
          último autodiagnóstico.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { etiqueta: "Brechas detectadas", valor: i.brechas.detectadas.toLocaleString("es-CO") },
            { etiqueta: "Brechas cerradas", valor: `${i.brechas.cerradas.toLocaleString("es-CO")} (${i.brechas.porcentaje} %)` },
            { etiqueta: "Empresas con 2+ diagnósticos", valor: i.avance.empresas.toLocaleString("es-CO") },
            {
              etiqueta: "Avance promedio",
              valor: i.avance.empresas ? `${i.avance.cambioPromedio > 0 ? "+" : ""}${decimal(i.avance.cambioPromedio)} / 5` : "—",
            },
          ].map((x) => (
            <div key={x.etiqueta} className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">{x.etiqueta}</p>
              <p className="text-xl font-semibold tabular-nums">{x.valor}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium">% de brechas cerradas por área</h3>
            <GraficaBarras datos={i.cerradasPorArea} medida="% cerradas" maximo={100} anchoEtiquetas={170} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Avance promedio por eje del diagnóstico</h3>
            <GraficaBarras datos={i.avance.ejes} medida="puntos de avance sobre 5" decimales={2} anchoEtiquetas={170} />
          </div>
        </div>
        {i.ejemplo && (
          <p className="flex gap-2 text-xs text-amber-700">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            Incluye brechas y diagnósticos de línea base de ejemplo para la demostración.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
