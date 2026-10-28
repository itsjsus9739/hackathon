import Link from "next/link";

const PILARES = [
  { href: "/empresas", titulo: "Conocer a cada empresa", texto: "Ficha única sin duplicados e historial completo en segundos." },
  { href: "/importar", titulo: "Depurar los datos", texto: "Importa los Excel del CDE, valida NIT con DV y fusiona duplicados." },
  { href: "/planes", titulo: "Seguimiento", texto: "Proyectos de aula y planes de acción con responsable, estado y avance." },
  { href: "/citas", titulo: "Citas sin trabajo manual", texto: "Solicitud, agenda y recordatorios automáticos por correo." },
  { href: "/eventos", titulo: "Eventos con QR", texto: "Convocatoria segmentada, inscripción y asistencia real escaneando QR." },
  { href: "/formacion", titulo: "Formación por recompensas", texto: "Microcursos, puntos, niveles, insignias y recompensas reales." },
  { href: "/conocimiento", titulo: "Datos → conocimiento", texto: "Brechas por sector y tamaño, impacto y preguntas en lenguaje natural." },
  { href: "/portal", titulo: "Portal del emprendedor", texto: "Su etapa, compromisos pendientes y la oferta que le conviene." },
];

export default function Inicio() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">De datos dispersos a conocimiento que innova</h1>
      <p className="mt-1 text-sm text-black/60">Centro de Desarrollo Empresarial · UNAB</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PILARES.map((p) => (
          <Link key={p.href} href={p.href} className="rounded-xl border border-black/10 p-4 transition hover:border-[var(--primario)]">
            <h2 className="font-medium">{p.titulo}</h2>
            <p className="mt-1 text-sm text-black/60">{p.texto}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
