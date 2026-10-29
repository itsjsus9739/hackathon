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
import { crearPlan, editarPlan } from "../actions";

type Opcion = { id: string; etiqueta: string };
type Fila = { clave: number; id: string; descripcion: string; responsable: string; fecha: string };

export type PlanEditable = {
  id: string;
  titulo: string;
  objetivo: string | null;
  area: string | null;
  id_responsable: string;
  fecha_inicio: string;
  fecha_limite: string | null;
  compromisos: { id: string; descripcion: string; id_responsable: string | null; fecha_limite: string | null }[];
  estudiantes: string[];
};

const sugeridas = (area: string | null, hoy: string): Fila[] =>
  (area && COMPROMISOS_SUGERIDOS[area] ? COMPROMISOS_SUGERIDOS[area] : [""]).map((descripcion, i) => ({
    clave: i,
    id: "",
    descripcion,
    responsable: "",
    fecha: sumarDias(hoy, 15 * (i + 1)),
  }));

export function FormularioPlan({
  empresas,
  personas,
  estudiantes,
  responsableFijo = false,
  inicial,
  plan,
}: {
  empresas: { id: string; nombre: string }[];
  personas: Opcion[];
  /** Estudiantes que se pueden asignar al equipo del plan */
  estudiantes: { id: string; nombre: string }[];
  /** El docente queda como responsable de los planes que crea */
  responsableFijo?: boolean;
  inicial: { idEmpresa: string | null; idResponsable: string; area: string | null; idDiagnostico: string | null; hoy: string };
  /** Con un plan, el formulario edita en vez de crear */
  plan?: PlanEditable;
}) {
  const [estado, accion, enviando] = useActionState(plan ? editarPlan : crearPlan, undefined);
  const [area, setArea] = useState(plan ? (plan.area ?? "") : (inicial.area ?? ""));
  const [titulo, setTitulo] = useState(plan ? plan.titulo : tituloSugerido(inicial.area));
  const [filas, setFilas] = useState<Fila[]>(() =>
    plan
      ? plan.compromisos.map((c, i) => ({
          clave: i,
          id: c.id,
          descripcion: c.descripcion,
          responsable: c.id_responsable ?? "",
          fecha: c.fecha_limite ?? "",
        }))
      : sugeridas(inicial.area, inicial.hoy),
  );
  const [equipo, setEquipo] = useState<Set<string>>(new Set(plan?.estudiantes ?? []));
  const [buscarEstudiante, setBuscarEstudiante] = useState("");
  const filtro = buscarEstudiante.trim().toLowerCase();
  // Al editar, nada se reemplaza solo al cambiar el área
  const [editado, setEditado] = useState(Boolean(plan));

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
      {plan && (
        <>
          <input type="hidden" name="id_plan" value={plan.id} />
          {/* La empresa de un plan no cambia: el select va deshabilitado y el valor viaja oculto */}
          <input type="hidden" name="id_empresa" value={inicial.idEmpresa ?? ""} />
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2" data-recorrido="plan-empresa">
          <Label htmlFor="id_empresa">Empresa</Label>
          <NativeSelect
            id="id_empresa"
            name={plan ? undefined : "id_empresa"}
            defaultValue={inicial.idEmpresa ?? ""}
            disabled={Boolean(plan)}
            required
          >
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
          {responsableFijo ? (
            <>
              <input type="hidden" name="id_responsable" value={plan?.id_responsable ?? inicial.idResponsable} />
              <Input id="id_responsable" value={personas.find((p) => p.id === (plan?.id_responsable ?? inicial.idResponsable))?.etiqueta ?? "Tú"} disabled />
              <p className="text-muted-foreground text-xs">Quedas como responsable; reparte los compromisos con tus estudiantes.</p>
            </>
          ) : (
            <NativeSelect id="id_responsable" name="id_responsable" defaultValue={plan?.id_responsable ?? inicial.idResponsable} required>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.etiqueta}
                </option>
              ))}
            </NativeSelect>
          )}
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
          <Textarea
            id="objetivo"
            name="objetivo"
            maxLength={1000}
            defaultValue={plan?.objetivo ?? ""}
            placeholder="Qué debe lograr la empresa al cerrar el plan"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fecha_inicio">Inicio</Label>
          <Input id="fecha_inicio" name="fecha_inicio" type="date" defaultValue={plan?.fecha_inicio ?? inicial.hoy} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fecha_limite">Cierre</Label>
          <Input
            id="fecha_limite"
            name="fecha_limite"
            type="date"
            defaultValue={plan ? (plan.fecha_limite ?? "") : sumarDias(inicial.hoy, 60)}
          />
        </div>
      </div>

      <fieldset className="space-y-2" data-recorrido="plan-estudiantes">
        <legend className="text-sm font-medium">
          Estudiantes del plan {equipo.size > 0 && <span className="text-muted-foreground font-normal">({equipo.size} asignados)</span>}
        </legend>
        <p className="text-muted-foreground text-xs">
          Verán el plan, podrán reportar avances y recibir compromisos. Cada uno recibe un aviso al ser asignado.
        </p>
        {[...equipo].map((id) => (
          <input key={id} type="hidden" name="estudiantes" value={id} />
        ))}
        {estudiantes.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
            Aún no hay estudiantes registrados en CDE Nest. Cuando se registren como estudiantes podrás asignarlos.
          </p>
        ) : (
          <>
            {estudiantes.length > 6 && (
              <Input
                type="search"
                value={buscarEstudiante}
                onChange={(e) => setBuscarEstudiante(e.target.value)}
                placeholder="Buscar estudiante…"
                aria-label="Buscar estudiante"
              />
            )}
            <div className="max-h-48 overflow-auto rounded-md border">
              {estudiantes
                .filter((e) => !filtro || e.nombre.toLowerCase().includes(filtro))
                .map((e) => (
                  <label key={e.id} className="hover:bg-muted flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={equipo.has(e.id)}
                      onChange={(ev) =>
                        setEquipo((s) => {
                          const n = new Set(s);
                          if (ev.target.checked) n.add(e.id);
                          else n.delete(e.id);
                          return n;
                        })
                      }
                    />
                    {e.nombre}
                  </label>
                ))}
            </div>
          </>
        )}
      </fieldset>

      <fieldset className="space-y-3" data-recorrido="plan-compromisos">
        <legend className="text-sm font-medium">Compromisos</legend>
        {filas.map((f, i) => (
          <div key={f.clave} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_11rem_9.5rem_auto] sm:items-end">
            <input type="hidden" name="compromiso_id" value={f.id} />
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
              { clave: Math.max(...x.map((y) => y.clave)) + 1, id: "", descripcion: "", responsable: "", fecha: sumarDias(inicial.hoy, 30) },
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
          {enviando && <Loader2 className="animate-spin" aria-hidden />} {plan ? "Guardar cambios" : "Crear plan"}
        </Button>
      </div>
    </form>
  );
}
