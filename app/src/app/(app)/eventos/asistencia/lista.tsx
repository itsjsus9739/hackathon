"use client";

import { useRouter } from "next/navigation";

import { AvatarRol, EtiquetaRol } from "@/components/personas/rol";
import type { Enums } from "@/lib/supabase/database.types";
import { CasillaAsistencia } from "../asistencia-controles";

type Inscrito = { id: string; asistio: boolean; estado: string; nombre: string; rol: Enums<"rol_usuario"> | null };

/** Lista de inscritos para marcar la asistencia a mano (por si alguien no tiene su QR a la mano). */
export function ListaAsistencia({ inscritos }: { inscritos: Inscrito[] }) {
  const router = useRouter();
  const asistieron = inscritos.filter((i) => i.asistio).length;

  if (!inscritos.length) return <p className="text-muted-foreground text-sm">Nadie se ha inscrito a este evento todavía.</p>;

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">
        Inscritos <span className="text-muted-foreground font-normal">· {asistieron} de {inscritos.length} asistieron</span>
      </h3>
      <ul className="divide-y">
        {[...inscritos]
          .sort((a, b) => Number(a.asistio) - Number(b.asistio) || a.nombre.localeCompare(b.nombre, "es"))
          .map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2 text-sm">
              {i.rol && <AvatarRol nombre={i.nombre} rol={i.rol} className="size-7 text-[10px]" />}
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block truncate">{i.nombre}</span>
                <span className="flex items-center gap-2">
                  {i.rol && <EtiquetaRol rol={i.rol} />}
                  <span className="text-muted-foreground text-xs">{i.estado}</span>
                </span>
              </span>
              <CasillaAsistencia idInscripcion={i.id} asistio={i.asistio} alCambiar={() => router.refresh()} />
            </li>
          ))}
      </ul>
    </div>
  );
}
