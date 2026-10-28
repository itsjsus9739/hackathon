"use client";

import { useState, useTransition } from "react";
import { Code2, Loader2, Send, Sparkles, TriangleAlert, UserRound } from "lucide-react";

import { GraficaBarras } from "@/components/conocimiento/grafica-barras";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ConsultaHecha, RespuestaAsistente } from "@/lib/ia/asistente";
import { elegirGrafica, formatearCelda } from "@/lib/ia/presentacion";
import { preguntar } from "./actions";

const SUGERENCIAS = [
  "¿Cuántas empresas hay por sector y cuál es el sector más grande?",
  "¿Qué empresas tienen compromisos vencidos y quién es el responsable?",
  "¿Cuál es la brecha más común en las microempresas según el diagnóstico?",
  "¿Cuántas postulaciones están seleccionadas y de qué municipios son?",
  "¿Qué asignaturas tienen más proyectos de aula este semestre?",
];

type Turno = { pregunta: string; resultado: RespuestaAsistente | null };

export function Asistente() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, iniciar] = useTransition();

  const enviar = (pregunta: string) => {
    const limpia = pregunta.trim();
    if (!limpia || pensando) return;
    setTexto("");
    setTurnos((t) => [...t, { pregunta: limpia, resultado: null }]);
    iniciar(async () => {
      const resultado = await preguntar(limpia).catch(
        (): RespuestaAsistente => ({ ok: false, error: "Se perdió la conexión con el servidor.", consultas: [] }),
      );
      setTurnos((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, resultado } : x)));
    });
  };

  return (
    <div className="space-y-6">
      {turnos.length === 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">Prueba con una de estas preguntas:</p>
          <div className="flex flex-wrap gap-2">
            {SUGERENCIAS.map((s) => (
              <Button key={s} variant="outline" size="sm" className="h-auto py-1.5 text-left whitespace-normal" onClick={() => enviar(s)}>
                {s}
              </Button>
            ))}
          </div>
        </div>
      )}

      <ol className="space-y-6" aria-live="polite">
        {turnos.map((t, i) => (
          <li key={i} className="space-y-3">
            <p className="flex items-start gap-2 text-sm font-medium">
              <UserRound className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
              {t.pregunta}
            </p>
            {t.resultado ? (
              <Resultado resultado={t.resultado} />
            ) : (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Consultando la base…
              </p>
            )}
          </li>
        ))}
      </ol>

      <form
        className="bg-background sticky bottom-0 flex items-end gap-2 border-t pt-3 pb-1"
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
      >
        <Textarea
          aria-label="Tu pregunta"
          placeholder="Ej.: ¿Qué empresas de alimentos tienen la madurez digital más baja?"
          value={texto}
          maxLength={500}
          rows={2}
          className="min-h-0 resize-none"
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar(texto);
            }
          }}
        />
        <Button type="submit" size="icon" aria-label="Preguntar" disabled={pensando || texto.trim().length < 5}>
          {pensando ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        </Button>
      </form>
    </div>
  );
}

function Resultado({ resultado }: { resultado: RespuestaAsistente }) {
  // La tabla que se muestra es la última consulta que funcionó (el asistente la deja con la respuesta final)
  const ultima = [...resultado.consultas].reverse().find((c) => !c.error && c.filas.length > 0);
  const grafica = ultima ? elegirGrafica(ultima) : null;

  return (
    <Card>
      <CardContent className="space-y-4">
        {resultado.ok ? (
          <div className="flex gap-2">
            <Sparkles className="text-primario mt-0.5 size-4 shrink-0" aria-hidden />
            <TextoRespuesta texto={resultado.respuesta} />
          </div>
        ) : (
          <p className="text-destructive flex items-center gap-2 text-sm">
            <TriangleAlert className="size-4 shrink-0" aria-hidden /> {resultado.error}
          </p>
        )}

        {grafica && <GraficaBarras datos={grafica.barras} medida={grafica.medida} decimales={grafica.barras.some((b) => !Number.isInteger(b.valor)) ? 1 : 0} />}
        {ultima && !grafica && <TablaResultado consulta={ultima} />}

        {resultado.consultas.length > 0 && (
          <details className="text-xs">
            <summary className="text-muted-foreground inline-flex cursor-pointer items-center gap-1">
              <Code2 className="size-3.5" aria-hidden /> Cómo lo calculé ({resultado.consultas.length}{" "}
              {resultado.consultas.length === 1 ? "consulta" : "consultas"})
            </summary>
            <ol className="mt-2 space-y-3">
              {resultado.consultas.map((c, i) => (
                <li key={i} className="space-y-1">
                  <p className="font-medium">
                    {i + 1}. {c.proposito}
                    {c.error ? <span className="text-destructive"> · falló: {c.error}</span> : ` · ${c.filas.length}${c.truncado ? "+" : ""} filas`}
                  </p>
                  <pre className="bg-muted overflow-x-auto rounded-md p-2 font-mono text-[11px] whitespace-pre-wrap">{c.sql}</pre>
                </li>
              ))}
            </ol>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

/** Texto plano con listas de guiones; sin HTML del modelo (no se usa dangerouslySetInnerHTML). */
function TextoRespuesta({ texto }: { texto: string }) {
  const bloques = texto.replace(/\*\*(.+?)\*\*/g, "$1").split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {bloques.map((b, i) => {
        const lineas = b.split("\n").filter(Boolean);
        return lineas.every((l) => /^\s*[-•]\s/.test(l)) ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {lineas.map((l, j) => (
              <li key={j}>{l.replace(/^\s*[-•]\s/, "")}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-line">
            {b}
          </p>
        );
      })}
    </div>
  );
}

function TablaResultado({ consulta }: { consulta: ConsultaHecha }) {
  const visibles = consulta.filas.slice(0, 50);
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
          <tr>
            {consulta.columnas.map((c) => (
              <th key={c} className="px-3 py-2 font-medium whitespace-nowrap">
                {c.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibles.map((f, i) => (
            <tr key={i} className="border-t align-top">
              {consulta.columnas.map((c) => (
                <td key={c} className="px-3 py-1.5">
                  {formatearCelda(f[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {(consulta.filas.length > visibles.length || consulta.truncado) && (
        <p className="text-muted-foreground border-t px-3 py-1.5 text-xs">
          Se muestran {visibles.length} filas{consulta.truncado ? " (la consulta trajo más de 200)" : ` de ${consulta.filas.length}`}.
        </p>
      )}
    </div>
  );
}
