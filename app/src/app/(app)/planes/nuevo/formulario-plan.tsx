"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { AREAS_PLAN, COMPROMISOS_SUGERIDOS, sumarDias, tituloSugerido } from "@/lib/planes";
import { crearPlan } from "../actions";

type Opcion = { id: string; etiqueta: string };
type Fila = { clave: number; descripcion: string; responsable: string; fecha: string };

const sugeridas = (area: string | null, hoy: string): Fila[] =>
  (area && COMPROMISOS_SUGERIDOS[area] ? COMPROMISOS_SUGERIDOS[area] : [""]).map((descripcion, i) => ({
    clave: i,
    descripcion,
    responsable: "",
    fecha: sumarDias(hoy, 15 * (i + 1)),
  }));

export function FormularioPlan({
  empresas,
  personas,
  inicial,
}: {
  empresas: { id: string; nombre: string }[];
  personas: Opcion[];
  inicial: { idEmpresa: string | null; idResponsable: string; area: string | null; idDiagnostico: string | null; hoy: string };
}) {
  const [estado, accion, enviando] = useActionState(crearPlan, undefined);
  const [area, setArea] = useState(inicial.area ?? "");
  const [titulo, setTitulo] = useState(tituloSugerido(inicial.area));
  const [filas, setFilas] = useState<Fila[]>(() => sugeridas(inicial.area, inicial.hoy));
  const [editado, setEditado] = useState(false);

  // Mientras no se hayan tocado, título y compromisos siguen al área elegida
  const cambiarArea = (nueva: string) => {
    setArea(nueva);
    if (!editado) {
      setTitulo(tituloSugerido(nueva));
      setFilas(sugeridas(nueva, inicial.hoy));
    }
  };
  const editarFila = (clave: number, cambio: Partial<Fila>) => {
    setEditado(true);
    setFilas((f) => f.map((x) => (x.clave === clave ? { ...x, ...cambio } : x)));
  };

  return (
    <form action={accion} className="space-y-5">
      <input type="hidden" name="id_diagnostico" value={area === inicial.area ? (inicial.idDiagnostico ?? "") : ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="id_empresa">Empresa</Label>
          <NativeSelect id="id_empresa" name="id_empresa" defaultValue={inicial.idEmpresa ?? ""} required>
            <option value="" disabled>
              Elige la empresa
            </option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="area">Brecha que atiende</Label>
          <NativeSelect id="area" name="area" value={area} onChange={(e) => cambiarArea(e.target.value)}>
            <option value="">Sin área</option>
            {AREAS_PLAN.map((a) => (
              <option key={a.campo} value={a.campo}>
                {a.nombre}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="id_responsable">Responsable del plan</Label>
          <NativeSelect id="id_responsable" name="id_responsable" defaultValue={inicial.idResponsable} required>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.etiqueta}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="titulo">Título</Label>
          <Input
            id="titulo"
            name="titulo"
            required
            minLength={3}
            maxLength={150}
            value={titulo}
            onChange={(e) => {
              setEditado(true);
              setTitulo(e.target.value);
            }}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="objetivo">Objetivo (opcional)</Label>
          <Textarea id="objetivo" name="objetivo" maxLength={1000} placeholder="Qué debe lograr la empresa al cerrar el plan" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fecha_inicio">Inicio</Label>
          <Input id="fecha_inicio" name="fecha_inicio" type="date" defaultValue={inicial.hoy} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fecha_limite">Cierre</Label>
          <Input id="fecha_limite" name="fecha_limite" type="date" defaultValue={sumarDias(inicial.hoy, 60)} />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Compromisos</legend>
        {filas.map((f, i) => (
          <div key={f.clave} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_11rem_9.5rem_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor={`desc-${f.clave}`} className="text-xs">
                Compromiso {i + 1}
              </Label>
              <Input
                id={`desc-${f.clave}`}
                name="compromiso_descripcion"
                value={f.descripcion}
                onChange={(e) => editarFila(f.clave, { descripcion: e.target.value })}
                required
                minLength={3}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`resp-${f.clave}`} className="text-xs">
                Responsable
              </Label>
              <NativeSelect
                id={`resp-${f.clave}`}
                name="compromiso_responsable"
                value={f.responsable}
                onChange={(e) => editarFila(f.clave, { responsable: e.target.value })}
              >
                <option value="">El del plan</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.etiqueta}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`fecha-${f.clave}`} className="text-xs">
                Fecha límite
              </Label>
              <Input
                id={`fecha-${f.clave}`}
                name="compromiso_fecha"
                type="date"
                value={f.fecha}
                onChange={(e) => editarFila(f.clave, { fecha: e.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Quitar compromiso ${i + 1}`}
              disabled={filas.length === 1}
              onClick={() => {
                setEditado(true);
                setFilas((x) => x.filter((y) => y.clave !== f.clave));
              }}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={filas.length >= 20}
          onClick={() => {
            setEditado(true);
            setFilas((x) => [
              ...x,
              { clave: Math.max(...x.map((y) => y.clave)) + 1, descripcion: "", responsable: "", fecha: sumarDias(inicial.hoy, 30) },
            ]);
          }}
        >
          <Plus aria-hidden /> Agregar compromiso
        </Button>
      </fieldset>

      {estado?.error && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertDescription>{estado.error}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={enviando}>
          {enviando && <Loader2 className="animate-spin" aria-hidden />} Crear plan
        </Button>
      </div>
    </form>
  );
}
