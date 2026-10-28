import type { Metadata } from "next";

import { esUuid } from "@/lib/empresas";
import { ETIQUETA_ROL, obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { CalendarioEventos } from "./cargador";

export const metadata: Metadata = { title: "Eventos · CDE Conecta" };

export default async function Pagina({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const sesion = await obtenerSesion();
  if (!sesion) return null; // el layout ya redirige a /login
  const supabase = await crearClienteServidor();
  const { data: personas, error } = await supabase.rpc("personas_comunidad");
  if (error) throw new Error(`No se pudo consultar la comunidad: ${error.message}`);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Eventos y calendario</h1>
        <p className="text-muted-foreground text-sm">
          Eventos, networking, conversatorios, citas y coworking del CDE. Crea actividades según tu rol, invita a la
          comunidad y confirma tu asistencia.
        </p>
      </header>
      <CalendarioEventos
        yo={{ id: sesion.id, rol: sesion.rol }}
        personas={personas ?? []}
        etiquetasRol={ETIQUETA_ROL}
        eventoInicial={e && esUuid(e) ? e : null}
      />
    </div>
  );
}
