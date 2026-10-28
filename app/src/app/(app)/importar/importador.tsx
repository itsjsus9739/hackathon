"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Papa from "papaparse";
import {
  CircleCheck,
  FileSpreadsheet,
  GitMerge,
  Loader2,
  RotateCcw,
  Split,
  TriangleAlert,
  Upload,
  type LucideIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ETIQUETA_CAMPO,
  deBase,
  deFila,
  describirRazones,
  planificar,
  procesarHoja,
  validarFila,
  type Campo,
  type Crudo,
  type Decision,
  type EmpresaExistente,
  type Registro,
} from "@/lib/importacion";
import { cn } from "@/lib/utils";
import { importarEmpresas, type ResultadoImportacion } from "./actions";

type FilaCruda = { crudo: Crudo; fila: number };

async function leerArchivo(archivo: File): Promise<string[][]> {
  if (/\.xlsx?$/i.test(archivo.name)) {
    const XLSX = await import("xlsx");
    const libro = XLSX.read(await archivo.arrayBuffer(), { type: "array" });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    return XLSX.utils.sheet_to_json<string[]>(hoja, { header: 1, raw: false, defval: "" });
  }
  return Papa.parse<string[]>(await archivo.text(), { skipEmptyLines: true }).data;
}

export function Importador({ sectores, existentes }: { sectores: string[]; existentes: EmpresaExistente[] }) {
  const [archivo, setArchivo] = useState<string | null>(null);
  const [crudas, setCrudas] = useState<FilaCruda[]>([]);
  const [columnas, setColumnas] = useState<Campo[]>([]);
  const [decisiones, setDecisiones] = useState<Record<string, Decision>>({});
  const [principales, setPrincipales] = useState<Record<string, string>>({});
  const [errorLectura, setErrorLectura] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [guardando, iniciarGuardado] = useTransition();

  const filas = useMemo(() => crudas.map(({ crudo, fila }) => validarFila(crudo, fila, sectores)), [crudas, sectores]);
  const plan = useMemo(() => planificar(filas, existentes, decisiones), [filas, existentes, decisiones]);
  const registros = useMemo(() => {
    const todos = [...filas.map(deFila), ...existentes.map(deBase)];
    return new Map<string, Registro>(todos.map((r) => [r.clave, r]));
  }, [filas, existentes]);

  const cargar = async (nombre: string, obtener: () => Promise<string[][]>) => {
    setErrorLectura(null);
    setResultado(null);
    try {
      const tabla = await obtener();
      const { mapa, filas: nuevas } = procesarHoja(tabla);
      if (mapa.nombre === undefined) throw new Error("No encontramos una columna con el nombre de la empresa");
      if (!nuevas.length) throw new Error("El archivo no tiene filas con datos");
      setColumnas(Object.keys(mapa) as Campo[]);
      setCrudas(nuevas);
      setDecisiones({});
      setPrincipales({});
      setArchivo(nombre);
    } catch (e) {
      setErrorLectura(e instanceof Error ? e.message : "No pudimos leer el archivo");
    }
  };

  const corregir = (fila: number, campo: Campo, valor: string) =>
    setCrudas((prev) => prev.map((c) => (c.fila === fila ? { ...c, crudo: { ...c.crudo, [campo]: valor } } : c)));

  const decidir = (grupo: string, decision: Decision | null) =>
    setDecisiones((prev) => {
      const resto = Object.fromEntries(Object.entries(prev).filter(([id]) => id !== grupo));
      return decision ? { ...resto, [grupo]: decision } : resto;
    });

  const guardar = () =>
    iniciarGuardado(async () => {
      const r = await importarEmpresas(plan.operaciones);
      setResultado(r);
      if (r.ok) {
        setCrudas([]);
        setArchivo(null);
      }
    });

  if (resultado?.ok) return <Resultado resultado={resultado} onOtra={() => setResultado(null)} />;

  if (!archivo) {
    return (
      <Card data-recorrido="importar-archivo">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <FileSpreadsheet className="text-muted-foreground size-10" aria-hidden />
          <div>
            <p className="font-medium">Sube la base de empresas</p>
            <p className="text-muted-foreground text-sm">
              Excel (.xlsx) o CSV con encabezados como Nombre empresa, NIT, Correo, Celular, Sector, Tamaño, Municipio.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <label className={cn(buttonVariants(), "cursor-pointer")}>
              <Upload aria-hidden /> Elegir archivo
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) cargar(f.name, () => leerArchivo(f));
                  e.target.value = "";
                }}
              />
            </label>
            <Button
              variant="outline"
              onClick={() =>
                cargar("base_cde_sucia.csv (demostración)", async () => {
                  const r = await fetch("/demo/base_cde_sucia.csv");
                  return Papa.parse<string[]>(await r.text(), { skipEmptyLines: true }).data;
                })
              }
            >
              Usar base de demostración
            </Button>
          </div>
          {errorLectura && <p className="text-destructive text-sm">{errorLectura}</p>}
          {resultado && !resultado.ok && <p className="text-destructive text-sm">{resultado.error}</p>}
        </CardContent>
      </Card>
    );
  }

  const conErrores = filas.filter((f) => f.errores.length);
  const sectoresNuevos = [...new Set(plan.operaciones.filter((o) => o.sectorNuevo && o.sector).map((o) => o.sector))];
  const fusiones = plan.operaciones.filter((o) => o.filas.length > 1 || o.accion === "actualizar").length;

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <FileSpreadsheet className="mr-1 inline size-4" aria-hidden />
          <b>{archivo}</b> · columnas reconocidas: {columnas.map((c) => ETIQUETA_CAMPO[c]).join(", ")}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setArchivo(null)}>
          <RotateCcw aria-hidden /> Cambiar archivo
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Indicador etiqueta="Filas leídas" valor={filas.length} />
        <Indicador etiqueta="Con errores" valor={conErrores.length} tono={conErrores.length ? "error" : "ok"} />
        <Indicador
          etiqueta="Duplicados por resolver"
          valor={plan.pendientes.length}
          tono={plan.pendientes.length ? "aviso" : "ok"}
        />
        <Indicador etiqueta="Empresas a guardar" valor={plan.operaciones.length} />
      </div>

      {/* Errores: se corrigen aquí mismo o la fila se omite */}
      {conErrores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="text-destructive size-4" aria-hidden /> Filas con errores
            </CardTitle>
            <CardDescription>Corrige el dato y la fila se valida de nuevo; si la dejas así, no se importa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {conErrores.map((f) => {
              const crudo = crudas.find((c) => c.fila === f.fila)!.crudo;
              return (
                <div key={f.fila} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[4rem_1fr_12rem] sm:items-center">
                  <span className="text-muted-foreground text-sm">Fila {f.fila}</span>
                  <div className="min-w-0 space-y-1">
                    <Input
                      aria-label={`Nombre de la fila ${f.fila}`}
                      value={crudo.nombre ?? ""}
                      onChange={(e) => corregir(f.fila, "nombre", e.target.value)}
                    />
                    {f.errores.map((e) => (
                      <p key={e} className="text-destructive text-xs">
                        {e}
                      </p>
                    ))}
                  </div>
                  <Input
                    aria-label={`NIT de la fila ${f.fila}`}
                    value={crudo.nit ?? ""}
                    placeholder="NIT-DV"
                    onChange={(e) => corregir(f.fila, "nit", e.target.value)}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Duplicados */}
      {plan.grupos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitMerge className="size-4" aria-hidden /> Posibles duplicados ({plan.grupos.length})
            </CardTitle>
            <CardDescription>
              Elige el registro principal: se conserva y se completa con los datos que le falten de los demás. Si uno ya está en
              la base, se completa esa empresa en vez de crear otra.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {plan.grupos.map((g) => {
              const decision = decisiones[g.id];
              const principal = principales[g.id] ?? g.claves.find((c) => c.startsWith("db:")) ?? g.claves[0];
              return (
                <fieldset
                  key={g.id}
                  className={cn("rounded-md border p-3", !decision && "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20")}
                >
                  <legend className="px-1 text-xs font-medium">{describirRazones(g.razones)}</legend>
                  <div className="space-y-2">
                    {g.claves.map((clave) => {
                      const r = registros.get(clave)!;
                      return (
                        <label key={clave} className="flex cursor-pointer items-start gap-3 text-sm">
                          <input
                            type="radio"
                            name={g.id}
                            className="mt-1"
                            checked={principal === clave}
                            disabled={Boolean(decision)}
                            onChange={() => setPrincipales((p) => ({ ...p, [g.id]: clave }))}
                          />
                          <span className="min-w-0">
                            <span className="font-medium">{r.nombre}</span>{" "}
                            <Badge variant={r.origen === "base" ? "secondary" : "outline"}>
                              {r.origen === "base" ? "Ya en la base" : `Fila ${r.fila}`}
                            </Badge>
                            <span className="text-muted-foreground block text-xs break-words">
                              {[r.nit && `NIT ${r.nit}-${r.nitDv}`, r.correo, r.celular, r.sector, r.municipio]
                                .filter(Boolean)
                                .join(" · ") || "Sin más datos"}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {decision ? (
                      <>
                        <Badge variant={decision.tipo === "fusionar" ? "default" : "secondary"}>
                          {decision.tipo === "fusionar" ? "Se fusionarán" : "Se guardan por separado"}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => decidir(g.id, null)}>
                          Deshacer
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => decidir(g.id, { tipo: "fusionar", principal })}>
                          <GitMerge aria-hidden /> Fusionar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => decidir(g.id, { tipo: "distintos" })}>
                          <Split aria-hidden /> No son la misma
                        </Button>
                      </>
                    )}
                  </div>
                </fieldset>
              );
            })}
            {plan.pendientes.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDecisiones((prev) => ({
                    ...prev,
                    ...Object.fromEntries(
                      plan.pendientes.map((g) => [
                        g.id,
                        {
                          tipo: "fusionar" as const,
                          principal: principales[g.id] ?? g.claves.find((c) => c.startsWith("db:")) ?? g.claves[0],
                        },
                      ]),
                    ),
                  }))
                }
              >
                Fusionar los {plan.pendientes.length} pendientes con el principal sugerido
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vista previa de lo que se guardará */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vista previa ({plan.operaciones.length})</CardTitle>
          <CardDescription>
            {fusiones > 0 && `${fusiones} con fusión o completando una empresa existente. `}
            {sectoresNuevos.length > 0 && `Sectores nuevos para el catálogo: ${sectoresNuevos.join(", ")}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="py-2 pr-3 font-medium">Fila</th>
                  <th className="py-2 pr-3 font-medium">Empresa</th>
                  <th className="py-2 pr-3 font-medium">NIT</th>
                  <th className="py-2 pr-3 font-medium">Sector</th>
                  <th className="py-2 pr-3 font-medium">Municipio</th>
                  <th className="py-2 pr-3 font-medium">Acción</th>
                  <th className="py-2 font-medium">Correcciones</th>
                </tr>
              </thead>
              <tbody>
                {plan.operaciones.map((o) => {
                  const avisos = o.filas.flatMap((n) => filas.find((f) => f.fila === n)?.avisos ?? []);
                  return (
                    <tr key={o.filas.join("-") + (o.idEmpresa ?? "")} className="border-b last:border-0 align-top">
                      <td className="text-muted-foreground py-2 pr-3">{o.filas.join(", ")}</td>
                      <td className="py-2 pr-3 font-medium">{o.nombre}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{o.nit ? `${o.nit}-${o.nitDv}` : "—"}</td>
                      <td className="py-2 pr-3">{o.sector ?? "—"}</td>
                      <td className="py-2 pr-3">{o.municipio ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={o.accion === "crear" ? "outline" : "secondary"}>
                          {o.accion === "actualizar" ? "Completa existente" : o.filas.length > 1 ? `Fusión de ${o.filas.length}` : "Nueva"}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground py-2 text-xs">
                        {avisos.length ? (
                          <details>
                            <summary className="cursor-pointer">{avisos.length}</summary>
                            <ul className="mt-1 list-disc pl-4">
                              {avisos.map((a, i) => (
                                <li key={i}>{a}</li>
                              ))}
                            </ul>
                          </details>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Guardar */}
      <div className="bg-background sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t py-3">
        {resultado && !resultado.ok && <p className="text-destructive text-sm">{resultado.error}</p>}
        {plan.pendientes.length > 0 ? (
          <p className="text-sm text-amber-700">
            Resuelve {plan.pendientes.length === 1 ? "el grupo de duplicados" : `los ${plan.pendientes.length} grupos de duplicados`}{" "}
            para continuar.
          </p>
        ) : (
          conErrores.length > 0 && (
            <p className="text-muted-foreground text-sm">
              {conErrores.length === 1 ? "1 fila con errores no se importará." : `${conErrores.length} filas con errores no se importarán.`}
            </p>
          )
        )}
        <Button onClick={guardar} disabled={guardando || plan.pendientes.length > 0 || plan.operaciones.length === 0}>
          {guardando && <Loader2 className="animate-spin" aria-hidden />} Importar {plan.operaciones.length} empresas
        </Button>
      </div>
    </div>
  );
}

function Indicador({ etiqueta, valor, tono }: { etiqueta: string; valor: number; tono?: "ok" | "aviso" | "error" }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{etiqueta}</p>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums",
          tono === "error" && "text-destructive",
          tono === "aviso" && "text-amber-600",
          tono === "ok" && "text-emerald-600",
        )}
      >
        {valor}
      </p>
    </div>
  );
}

function Resultado({ resultado, onOtra }: { resultado: Extract<ResultadoImportacion, { ok: true }>; onOtra: () => void }) {
  const limpio = resultado.duplicadosEnBase === 0 && resultado.fallidas.length === 0;
  const Icono: LucideIcon = limpio ? CircleCheck : TriangleAlert;
  return (
    <div className="space-y-4">
      <Alert>
        <Icono aria-hidden className={limpio ? "text-emerald-600" : "text-amber-600"} />
        <AlertTitle>{limpio ? "No existen empresas duplicadas" : "Importación terminada con observaciones"}</AlertTitle>
        <AlertDescription>
          <p>
            {resultado.creadas} empresas nuevas, {resultado.actualizadas} completadas, {resultado.contactos} contactos
            {resultado.sectoresNuevos.length > 0 && ` y ${resultado.sectoresNuevos.length} sectores nuevos (${resultado.sectoresNuevos.join(", ")})`}.
          </p>
          {resultado.duplicadosEnBase > 0 && (
            <p>
              La base aún marca {resultado.duplicadosEnBase} pares de nombres parecidos entre lo importado y lo existente.
            </p>
          )}
          {resultado.fallidas.length > 0 && (
            <ul className="mt-2 list-disc pl-4">
              {resultado.fallidas.map((f, i) => (
                <li key={i}>
                  {f.filas.length > 0 && `Fila ${f.filas.join(", ")} · `}
                  {f.nombre}: {f.motivo}
                </li>
              ))}
            </ul>
          )}
        </AlertDescription>
      </Alert>
      <div className="flex gap-2">
        <Link href="/empresas" className={buttonVariants()}>
          Ver empresas
        </Link>
        <Button variant="outline" onClick={onOtra}>
          Importar otro archivo
        </Button>
      </div>
    </div>
  );
}
