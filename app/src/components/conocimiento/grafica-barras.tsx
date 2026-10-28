"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { Barra } from "@/lib/conocimiento";

type Props = {
  datos: Barra[];
  /** Nombre de la medida, para el tooltip (p. ej. "empresas" o "promedio / 5") */
  medida: string;
  /** Límite fijo del eje (p. ej. 5 en el diagnóstico); por defecto, el mayor valor */
  maximo?: number;
  decimales?: number;
  /** Etiqueta que se señala en el texto (p. ej. el área con la mayor brecha) */
  destacar?: string;
  anchoEtiquetas?: number;
};

// Barras horizontales de una sola serie: un solo color (sin leyenda), valor escrito al final
// de cada barra, tooltip al pasar el cursor y una tabla equivalente para lectores de pantalla.
export function GraficaBarras({ datos, medida, maximo, decimales = 0, destacar, anchoEtiquetas = 150 }: Props) {
  const formato = (v: number) => v.toLocaleString("es-CO", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  const conMarca = datos.map((d) => ({ ...d, nombre: d.etiqueta === destacar ? `${d.etiqueta} ◂` : d.etiqueta }));

  if (!datos.length) return <p className="text-muted-foreground py-6 text-center text-sm">Sin datos todavía.</p>;

  return (
    <figure>
      <div style={{ height: datos.length * 34 + 16 }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={conMarca} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} barCategoryGap={8}>
            <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="2 4" />
            <XAxis type="number" domain={[0, maximo ?? "dataMax"]} hide />
            <YAxis
              type="category"
              dataKey="nombre"
              width={anchoEtiquetas}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="bg-background rounded-md border px-3 py-2 text-xs shadow-sm">
                    <p className="font-medium">{(payload[0].payload as Barra).etiqueta}</p>
                    <p className="text-muted-foreground">
                      {formato(Number(payload[0].value))} {medida}
                    </p>
                  </div>
                ) : null
              }
            />
            <Bar dataKey="valor" fill="var(--serie-1)" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
              <LabelList
                dataKey="valor"
                position="right"
                formatter={(v) => formato(Number(v))}
                style={{ fontSize: 12, fill: "var(--foreground)" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <thead>
          <tr>
            <th>Categoría</th>
            <th>{medida}</th>
          </tr>
        </thead>
        <tbody>
          {datos.map((d) => (
            <tr key={d.etiqueta}>
              <td>{d.etiqueta}</td>
              <td>{formato(d.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
