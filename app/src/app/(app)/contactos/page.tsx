import type { Metadata } from "next";

import { ETIQUETA_ROL } from "@/lib/roles";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { AsignaturasDocente, type AsignaturaDocente } from "./asignaturas-docente";
import { ListaContactos } from "./lista-contactos";

export const metadata: Metadata = { title: "Mis contactos · CDE Conecta" };

/** Semestre actual y el siguiente (julio-diciembre = 2), en hora de Bogotá. */
function semestres() {
  const [anio, mes] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date()).split("-").map(Number);
  return mes <= 6 ? [`${anio}-1`, `${anio}-2`] : [`${anio}-2`, `${anio + 1}-1`];
}

const DESCRIPCION: Record<string, string> = {
  admin_cde: "Todos los participantes del CDE: docentes con sus asignaturas, emprendedores con su empresa y estudiantes.",
  cde: "Todos los participantes del CDE: docentes con sus asignaturas, emprendedores con su empresa y estudiantes.",
  docente: "Tus estudiantes, por asignatura y proyecto, y las empresas que acompañas.",
  emprendedor: "El docente a cargo del proyecto de tu empresa, su equipo de estudiantes y tu mentor del CDE.",
  estudiante: "Tus docentes, tu equipo de proyecto y la empresa con la que trabajas.",
};

const VACIO: Record<string, string> = {
  admin_cde: "Aún no hay participantes con acceso aprobado.",
  cde: "Aún no hay participantes con acceso aprobado.",
  docente: "Aún no tienes estudiantes: añade una asignatura e inscríbelos arriba.",
  emprendedor: "Cuando tu empresa tenga un proyecto de aula, aquí verás al docente a cargo y a su equipo.",
  estudiante: "Cuando tu docente te inscriba en una asignatura o proyecto, aparecerá aquí.",
};

// Lo que ve cada rol lo decide la base (mis_contactos, 0021): solo nombre, rol y relación, sin datos de contacto personales.
export default async function PaginaContactos() {
  const sesion = await obtenerSesion();
  if (!sesion) return null; // el layout ya redirige a /login
  const supabase = await crearClienteServidor();
  const esDocente = sesion.rol === "docente";

  const [contactos, misAsignaturas, inscritos, comunidad] = await Promise.all([
    supabase.rpc("mis_contactos"),
    esDocente
      ? supabase.from("asignatura_docentes").select("id_asignatura, semestre, asignaturas (nombre)").eq("id_docente", sesion.id)
      : Promise.resolve({ data: [], error: null }),
    esDocente ? supabase.from("asignatura_estudiantes").select("id_asignatura, semestre, id_estudiante") : Promise.resolve({ data: [], error: null }),
    esDocente ? supabase.rpc("personas_comunidad") : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [contactos, misAsignaturas, inscritos, comunidad]) {
    if (r.error) throw new Error(`No se pudieron consultar los contactos: ${r.error.message}`);
  }

  const estudiantes = (comunidad.data ?? []).filter((p) => p.rol === "estudiante").map(({ id, nombre }) => ({ id, nombre }));
  const nombre = new Map(estudiantes.map((e) => [e.id, e.nombre]));
  const asignaturas: AsignaturaDocente[] = (misAsignaturas.data ?? [])
    .map((a) => ({
      id: a.id_asignatura,
      nombre: a.asignaturas?.nombre ?? "Asignatura",
      semestre: a.semestre,
      estudiantes: (inscritos.data ?? [])
        .filter((i) => i.id_asignatura === a.id_asignatura && i.semestre === a.semestre)
        .map((i) => ({ id: i.id_estudiante, nombre: nombre.get(i.id_estudiante) ?? "Estudiante" }))
        .sort((x, y) => x.nombre.localeCompare(y.nombre)),
    }))
    .sort((x, y) => y.semestre.localeCompare(x.semestre) || x.nombre.localeCompare(y.nombre));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Mis contactos</h1>
        <p className="text-muted-foreground text-sm">{DESCRIPCION[sesion.rol]}</p>
        <p className="text-muted-foreground mt-1 text-xs">Tu rol: {ETIQUETA_ROL[sesion.rol]}</p>
      </header>

      {esDocente && <AsignaturasDocente asignaturas={asignaturas} estudiantes={estudiantes} semestres={semestres()} />}

      <section className="space-y-3">
        {esDocente && <h2 className="text-lg font-semibold">Todos mis contactos</h2>}
        <ListaContactos contactos={contactos.data ?? []} vacio={VACIO[sesion.rol]} />
      </section>
    </div>
  );
}
