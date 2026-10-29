"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { AvatarRol, EtiquetaRol } from "@/components/personas/rol";
import { Input } from "@/components/ui/input";
import { COLOR_ROL, ETIQUETA_ROL, ORDEN_ROL } from "@/lib/roles";
import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Rol = Enums<"rol_usuario">;
export type Contacto = { id: string; nombre: string; rol: Rol; relacion: string };

/** Directorio con buscador y filtro por rol; cada rol con su color. */
export function ListaContactos({ contactos, vacio }: { contactos: Contacto[]; vacio: string }) {
  const [rol, setRol] = useState<Rol | null>(null);
  const [q, setQ] = useState("");
  const conteo = useMemo(() => {
    const c = new Map<Rol, number>();
    for (const x of contactos) c.set(x.rol, (c.get(x.rol) ?? 0) + 1);
    return c;
  }, [contactos]);
  const roles = ORDEN_ROL.filter((r) => conteo.has(r));
  const texto = q.trim().toLowerCase();
  const visibles = contactos.filter(
    (c) => (!rol || c.rol === rol) && (!texto || c.nombre.toLowerCase().includes(texto) || c.relacion.toLowerCase().includes(texto)),
  );

  if (!contactos.length) {
    return <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">{vacio}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, asignatura o empresa" className="pl-9" aria-label="Buscar contactos" />
        </div>
        {roles.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por rol">
            <button
              type="button"
              onClick={() => setRol(null)}
              aria-pressed={rol === null}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium", rol === null && "bg-foreground text-background border-foreground")}
            >
              Todos · {contactos.length}
            </button>
            {roles.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRol(rol === r ? null : r)}
                aria-pressed={rol === r}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                  rol === r ? cn(COLOR_ROL[r].fondo, COLOR_ROL[r].texto, COLOR_ROL[r].borde) : "",
                )}
              >
                <span className={cn("size-2 rounded-full", COLOR_ROL[r].punto)} aria-hidden />
                {ETIQUETA_ROL[r]} · {conteo.get(r)}
              </button>
            ))}
          </div>
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">Nadie coincide con la búsqueda.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((c) => (
            <li key={c.id} className={cn("flex items-start gap-3 rounded-xl border border-l-4 bg-white p-3", COLOR_ROL[c.rol].borde)}>
              <AvatarRol nombre={c.nombre} rol={c.rol} />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-semibold">{c.nombre}</p>
                <EtiquetaRol rol={c.rol} />
                <ul className="text-muted-foreground space-y-0.5 text-xs">
                  {c.relacion.split(" | ").map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
