import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Sprites del búho en /public/buho (397 x 382, fondo transparente, para fondos claros).
const SPRITES = {
  "error-404": { src: "/buho/buho-error-404.png", alt: "Búho de CDE Conecta buscando una página perdida" },
  mantenimiento: { src: "/buho/buho-mantenimiento.png", alt: "Búho de CDE Conecta con casco trabajando en este módulo" },
  "acceso-denegado": { src: "/buho/buho-acceso-denegado.png", alt: "Búho de CDE Conecta indicando que no hay acceso" },
} as const;

type Accion = { href: string; etiqueta: string };

type Props = {
  sprite: keyof typeof SPRITES;
  etiqueta?: string;
  titulo: string;
  descripcion: React.ReactNode;
  acciones?: Accion[];
  className?: string;
};

// Pantalla de estado con la mascota: 404, "Próximamente", "En mantenimiento".
export function PantallaBuho({ sprite, etiqueta, titulo, descripcion, acciones = [], className }: Props) {
  const imagen = SPRITES[sprite];

  return (
    <section className={cn("mx-auto flex max-w-xl flex-col items-center px-4 py-10 text-center", className)}>
      <Image src={imagen.src} alt={imagen.alt} width={397} height={382} priority className="h-auto w-56 sm:w-64" />
      {etiqueta && (
        <span className="mt-4 rounded-full bg-[var(--primario)]/10 px-3 py-1 text-xs font-semibold tracking-wide text-[var(--primario)] uppercase">
          {etiqueta}
        </span>
      )}
      <h1 className="mt-3 text-2xl font-semibold text-balance">{titulo}</h1>
      <div className="text-muted-foreground mt-2 text-sm text-pretty">{descripcion}</div>
      {acciones.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {acciones.map((a, i) => (
            <Link key={a.href} href={a.href} className={buttonVariants({ variant: i === 0 ? "default" : "outline" })}>
              {a.etiqueta}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// Atajo para los módulos que aún no están listos.
export function Proximamente({ modulo, descripcion }: { modulo: string; descripcion: string }) {
  return (
    <PantallaBuho
      sprite="mantenimiento"
      etiqueta="Próximamente"
      titulo={`${modulo} está en construcción`}
      descripcion={
        <>
          <p>{descripcion}</p>
          <p className="mt-2">Nuestro búho está trabajando en este módulo. ¡Vuelve pronto!</p>
        </>
      }
      acciones={[
        { href: "/", etiqueta: "Ir al inicio" },
        { href: "/empresas", etiqueta: "Ver empresas" },
      ]}
    />
  );
}
