"use client";

import { useState, useTransition } from "react";
import { BookOpen, Building2, Loader2, Plus, Search, UserMinus, UserPlus, X } from "lucide-react";

import { AvatarRol } from "@/components/personas/rol";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  asignarEstudianteProyecto,
  buscarEmpresas,
  crearAsignatura,
  dejarAsignatura,
  desvincularEmpresa,
  inscribirEstudiante,
  retirarEstudiante,
  retirarEstudianteProyecto,
  vincularEmpresa,
} from "./actions";

type Persona = { id: string; nombre: string };
export type ProyectoAsignatura = { id: string; empresa: string; estudiantes: Persona[] };
export type AsignaturaDocente = { id: string; nombre: string; semestre: string; estudiantes: Persona[]; proyectos: ProyectoAsignatura[] };

/** El docente registra sus asignaturas e inscribe a sus estudiantes (solo los ve él y el CDE). */
export function AsignaturasDocente({
  asignaturas,
  estudiantes,
  semestres,
}: {
  asignaturas: AsignaturaDocente[];
  /** Estudiantes registrados en CDE Nest (para inscribir) */
  estudiantes: Persona[];
  /** Semestre actual primero */
  semestres: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const [nombre, setNombre] = useState("");

  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BookOpen className="size-5" aria-hidden /> Mis asignaturas y estudiantes
        </h2>
        <p className="text-muted-foreground text-sm">
          Registra las asignaturas que dictas, inscribe a tus estudiantes y vincula la empresa con la que trabaja cada asignatura.
          Luego asigna los estudiantes a cada empresa: todos reciben un aviso y ven a qué proyecto corresponde cada asignatura.
        </p>
      </div>

      <form
        data-recorrido="contactos-asignatura"
        className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const semestre = String(new FormData(e.currentTarget).get("semestre"));
          setError(null);
          iniciar(async () => {
            const r = await crearAsignatura({ nombre, semestre });
            if (r.error) setError(r.error);
            else setNombre("");
          });
        }}
      >
        <label className="flex-1 space-y-1 text-sm">
          <span className="font-medium">Nueva asignatura</span>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Gerencia de proyectos" maxLength={120} required minLength={3} />
        </label>
        <label className="space-y-1 text-sm sm:w-32">
          <span className="font-medium">Semestre</span>
          <NativeSelect name="semestre" defaultValue={semestres[0]}>
            {semestres.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button type="submit" disabled={ocupado}>
          {ocupado ? <Loader2 className="animate-spin" /> : <Plus aria-hidden />} Añadir asignatura
        </Button>
      </form>
      {error && <p className="text-destructive text-sm">{error}</p>}

      {asignaturas.length === 0 ? (
        <p data-recorrido="contactos-asignaturas" className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Aún no tienes asignaturas registradas. Añade la primera para inscribir a tus estudiantes.
        </p>
      ) : (
        <div data-recorrido="contactos-asignaturas" className="grid gap-4 lg:grid-cols-2">
          {asignaturas.map((a) => (
            <TarjetaAsignatura key={`${a.id}-${a.semestre}`} asignatura={a} estudiantes={estudiantes} />
          ))}
        </div>
      )}
    </section>
  );
}

function TarjetaAsignatura({ asignatura: a, estudiantes }: { asignatura: AsignaturaDocente; estudiantes: Persona[] }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const [elegido, setElegido] = useState("");
  const inscritos = new Set(a.estudiantes.map((e) => e.id));
  const disponibles = estudiantes.filter((e) => !inscritos.has(e.id));

  const accion = (fn: () => Promise<{ error?: string }>) =>
    iniciar(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
    });

  return (
    <article className="space-y-3 rounded-xl border bg-card p-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{a.nombre}</h3>
          <p className="text-muted-foreground text-xs">
            {a.semestre} · {a.estudiantes.length} {a.estudiantes.length === 1 ? "estudiante" : "estudiantes"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={ocupado}
          onClick={() => {
            if (confirm(`¿Quitar "${a.nombre}" (${a.semestre}) de tus asignaturas?`))
              accion(() => dejarAsignatura({ id_asignatura: a.id, semestre: a.semestre }));
          }}
        >
          Quitar
        </Button>
      </header>

      {a.estudiantes.length > 0 && (
        <ul className="divide-y">
          {a.estudiantes.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
              <AvatarRol nombre={e.nombre} rol="estudiante" className="size-7 text-[10px]" />
              <span className="min-w-0 flex-1 truncate">{e.nombre}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Retirar a ${e.nombre}`}
                title="Retirar de la asignatura"
                disabled={ocupado}
                onClick={() => accion(() => retirarEstudiante({ id_asignatura: a.id, semestre: a.semestre, id_estudiante: e.id }))}
              >
                <UserMinus className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          accion(async () => {
            const r = await inscribirEstudiante({ id_asignatura: a.id, semestre: a.semestre, id_estudiante: elegido });
            if (!r.error) setElegido("");
            return r;
          });
        }}
      >
        <NativeSelect value={elegido} onChange={(e) => setElegido(e.target.value)} required aria-label="Estudiante para inscribir">
          <option value="" disabled>
            {disponibles.length ? "Elige un estudiante…" : "No hay más estudiantes registrados"}
          </option>
          {disponibles.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline" disabled={ocupado || !elegido}>
          {ocupado ? <Loader2 className="animate-spin" /> : <UserPlus aria-hidden />} Inscribir
        </Button>
      </form>
      {error && <p className="text-destructive text-xs">{error}</p>}

      <div className="space-y-2 border-t pt-3">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold">
          <Building2 className="size-4" aria-hidden /> Empresas del proyecto
        </h4>
        {a.proyectos.length === 0 && (
          <p className="text-muted-foreground text-xs">Vincula la empresa con la que trabajará esta asignatura.</p>
        )}
        {a.proyectos.map((p) => (
          <ProyectoEmpresa key={p.id} proyecto={p} inscritos={a.estudiantes} />
        ))}
        <BuscadorEmpresa idAsignatura={a.id} semestre={a.semestre} vinculadas={new Set(a.proyectos.map((p) => p.empresa))} />
      </div>
    </article>
  );
}

/** Una empresa vinculada a la asignatura (proyecto de aula) con los estudiantes que trabajan con ella. */
function ProyectoEmpresa({ proyecto: p, inscritos }: { proyecto: ProyectoAsignatura; inscritos: Persona[] }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const [elegido, setElegido] = useState("");
  const asignados = new Set(p.estudiantes.map((e) => e.id));
  const disponibles = inscritos.filter((e) => !asignados.has(e.id));
  const accion = (fn: () => Promise<{ error?: string }>) =>
    iniciar(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
    });

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{p.empresa}</p>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={`Quitar ${p.empresa} de la asignatura`}
          title="Quitar empresa"
          disabled={ocupado}
          onClick={() => {
            if (confirm(`¿Quitar a ${p.empresa} de la asignatura? El proyecto queda cancelado.`)) accion(() => desvincularEmpresa(p.id));
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
      {p.estudiantes.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {p.estudiantes.map((e) => (
            <li key={e.id} className="inline-flex items-center gap-1 rounded-full bg-pink-100 py-0.5 pr-1 pl-2 text-xs text-pink-800">
              {e.nombre}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-pink-200"
                aria-label={`Retirar a ${e.nombre} de ${p.empresa}`}
                disabled={ocupado}
                onClick={() => accion(() => retirarEstudianteProyecto({ id_proyecto: p.id, id_estudiante: e.id }))}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">Sin estudiantes asignados todavía.</p>
      )}
      {inscritos.length === 0 ? (
        <p className="text-muted-foreground text-xs">Inscribe estudiantes en la asignatura para asignarlos a esta empresa.</p>
      ) : (
        disponibles.length > 0 && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              accion(async () => {
                const r = await asignarEstudianteProyecto({ id_proyecto: p.id, id_estudiante: elegido });
                if (!r.error) setElegido("");
                return r;
              });
            }}
          >
            <NativeSelect value={elegido} onChange={(e) => setElegido(e.target.value)} required aria-label={`Estudiante para ${p.empresa}`}>
              <option value="" disabled>
                Asignar estudiante…
              </option>
              {disponibles.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </NativeSelect>
            <Button type="submit" size="sm" variant="outline" disabled={ocupado || !elegido}>
              {ocupado ? <Loader2 className="animate-spin" /> : <UserPlus aria-hidden />} Asignar
            </Button>
          </form>
        )
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

/** Buscar la empresa por nombre o NIT (mínimo 3 letras) y vincularla a la asignatura. */
function BuscadorEmpresa({ idAsignatura, semestre, vinculadas }: { idAsignatura: string; semestre: string; vinculadas: Set<string> }) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<{ id: string; nombre: string; municipio: string | null }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  return (
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          iniciar(async () => setResultados(await buscarEmpresas(texto)));
        }}
      >
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar empresa por nombre o NIT"
          minLength={3}
          maxLength={80}
          aria-label="Buscar empresa para vincular"
        />
        <Button type="submit" size="sm" variant="outline" disabled={ocupado || texto.trim().length < 3}>
          {ocupado ? <Loader2 className="animate-spin" /> : <Search aria-hidden />} Buscar
        </Button>
      </form>
      {resultados && (
        <ul className="divide-y rounded-md border text-sm">
          {resultados.length === 0 && <li className="text-muted-foreground p-2 text-xs">Sin coincidencias. Prueba con otra parte del nombre o el NIT.</li>}
          {resultados.map((r) => (
            <li key={r.id} className="flex items-center gap-2 p-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.nombre}</span>
                {r.municipio && <span className="text-muted-foreground text-xs">{r.municipio}</span>}
              </span>
              {vinculadas.has(r.nombre) ? (
                <span className="text-muted-foreground text-xs">Ya vinculada</span>
              ) : (
                <Button
                  size="sm"
                  disabled={ocupado}
                  onClick={() =>
                    iniciar(async () => {
                      const res = await vincularEmpresa({ id_asignatura: idAsignatura, semestre, id_empresa: r.id });
                      if (res.error) setError(res.error);
                      else {
                        setResultados(null);
                        setTexto("");
                      }
                    })
                  }
                >
                  <Plus aria-hidden /> Vincular
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
      <p className="text-muted-foreground text-xs">La empresa y los estudiantes de la asignatura reciben un aviso.</p>
    </div>
  );
}
