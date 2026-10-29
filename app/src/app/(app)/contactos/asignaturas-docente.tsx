"use client";

import { useState, useTransition } from "react";
import { BookOpen, Loader2, Plus, UserMinus, UserPlus } from "lucide-react";

import { AvatarRol } from "@/components/personas/rol";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { crearAsignatura, dejarAsignatura, inscribirEstudiante, retirarEstudiante } from "./actions";

type Persona = { id: string; nombre: string };
export type AsignaturaDocente = { id: string; nombre: string; semestre: string; estudiantes: Persona[] };

/** El docente registra sus asignaturas e inscribe a sus estudiantes (solo los ve él y el CDE). */
export function AsignaturasDocente({
  asignaturas,
  estudiantes,
  semestres,
}: {
  asignaturas: AsignaturaDocente[];
  /** Estudiantes registrados en CDE Conecta (para inscribir) */
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
          Registra las asignaturas que dictas e inscribe a tus estudiantes. Cada estudiante recibe un aviso y te verá en sus contactos.
        </p>
      </div>

      <form
        className="flex flex-col gap-2 rounded-xl border bg-white p-3 sm:flex-row sm:items-end"
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
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Aún no tienes asignaturas registradas. Añade la primera para inscribir a tus estudiantes.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
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
    <article className="space-y-3 rounded-xl border bg-white p-4">
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
    </article>
  );
}
