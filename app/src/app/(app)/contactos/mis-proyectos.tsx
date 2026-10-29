import { BookOpen, Building2, FolderKanban } from "lucide-react";

type Proyecto = { id: string; asignatura: string; empresa: string; semestre: string };

/** Estudiante y emprendedor: a qué proyecto (empresa) corresponde cada asignatura. */
export function MisProyectos({ rol, proyectos, sinProyecto }: { rol: "estudiante" | "emprendedor"; proyectos: Proyecto[]; sinProyecto: string[] }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FolderKanban className="size-5" aria-hidden /> {rol === "estudiante" ? "Mis proyectos" : "Proyectos de mi empresa"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {rol === "estudiante"
            ? proyectos.length > 1
              ? `Estás en ${proyectos.length} proyectos: cada asignatura trabaja con una empresa distinta.`
              : "La empresa con la que trabajas en cada asignatura."
            : "Las asignaturas de la UNAB que acompañan a tu empresa."}
        </p>
      </div>
      {proyectos.length === 0 && sinProyecto.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          {rol === "estudiante"
            ? "Aún no estás en ningún proyecto. Tu docente te asignará a una empresa."
            : "Tu empresa aún no está vinculada a una asignatura."}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {proyectos.map((p) => (
            <li key={p.id} className="space-y-2 rounded-xl border bg-card p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-sky-800">
                <BookOpen className="size-4" aria-hidden /> {p.asignatura}
              </p>
              <p className="flex items-center gap-2 text-sm">
                <Building2 className="text-muted-foreground size-4" aria-hidden />
                {rol === "estudiante" ? `Empresa: ${p.empresa}` : p.empresa}
              </p>
              <p className="text-muted-foreground text-xs">Semestre {p.semestre}</p>
            </li>
          ))}
          {sinProyecto.map((a) => (
            <li key={a} className="text-muted-foreground space-y-1 rounded-xl border border-dashed p-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <BookOpen className="size-4" aria-hidden /> {a}
              </p>
              <p className="text-xs">Aún sin empresa asignada para ti.</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
