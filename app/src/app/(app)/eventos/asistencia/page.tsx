import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Coins } from "lucide-react";

import { PantallaBuho } from "@/components/buho/pantalla-buho";
import { esUuid } from "@/lib/empresas";
import { esRolCde, ETIQUETA_RESPUESTA, type EstadoRespuesta } from "@/lib/eventos";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ListaAsistencia } from "./lista";
import { EscanerAsistencia } from "./escaner";

export const metadata: Metadata = { title: "Tomar asistencia · CDE Conecta" };

const ZONA = "America/Bogota";
const FECHA = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: ZONA });

export default async function PaginaAsistencia({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const sesion = await obtenerSesion();
  if (!sesion || !esRolCde(sesion.rol)) {
    return (
      <PantallaBuho
        sprite="acceso-denegado"
        titulo="Solo para el equipo del CDE"
        descripcion={<p>El CDE registra la asistencia real escaneando el QR de cada participante.</p>}
        acciones={[{ href: "/eventos", etiqueta: "Volver al calendario" }]}
      />
    );
  }
  const { e } = await searchParams;
  const supabase = await crearClienteServidor();

  // Eventos de las últimas dos semanas y los próximos dos días
  const ahora = Date.now();
  const [eventos, personas] = await Promise.all([
    supabase
      .from("eventos")
      .select("id, nombre, tipo, fecha, puntos_gamificacion, inscripciones_eventos(id, id_usuario, estado, asistio)")
      .gte("fecha", new Date(ahora - 14 * 86_400_000).toISOString())
      .lte("fecha", new Date(ahora + 2 * 86_400_000).toISOString())
      .order("fecha", { ascending: false }),
    supabase.rpc("directorio"),
  ]);
  if (eventos.error) throw new Error(`No se pudieron consultar los eventos: ${eventos.error.message}`);
  const lista = eventos.data ?? [];
  const elegido = (e && esUuid(e) ? lista.find((x) => x.id === e) : null) ?? lista[0] ?? null;
  const nombres = new Map((personas.data ?? []).map((p) => [p.id, p]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/eventos" className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Calendario
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Tomar asistencia</h1>
        <p className="text-muted-foreground text-sm">
          Escanea el QR que cada participante ve en su calendario, o márcalo en la lista. Al registrar la asistencia, la base
          suma los puntos del evento y revisa sus insignias.
        </p>
      </div>

      {lista.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">No hay eventos en las últimas dos semanas.</p>
      ) : (
        <>
          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Elegir evento">
            {lista.map((ev) => (
              <Link
                key={ev.id}
                href={`/eventos/asistencia?e=${ev.id}`}
                aria-current={ev.id === elegido?.id ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-xl border px-3 py-2 text-left text-sm",
                  ev.id === elegido?.id ? "border-[var(--primario)] bg-[var(--verde-suave)]" : "bg-white hover:bg-black/5",
                )}
              >
                <span className="block max-w-56 truncate font-medium">{ev.nombre}</span>
                <span className="text-muted-foreground text-xs first-letter:uppercase">{FECHA.format(new Date(ev.fecha))}</span>
              </Link>
            ))}
          </nav>

          {elegido && (
            <section className="space-y-4 rounded-2xl border bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{elegido.nombre}</h2>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    elegido.puntos_gamificacion > 0 ? "bg-[var(--verde-suave)] text-[var(--primario-texto)]" : "bg-amber-100 text-amber-900",
                  )}
                >
                  <Coins className="size-3.5" aria-hidden />
                  {elegido.puntos_gamificacion > 0 ? `${elegido.puntos_gamificacion} puntos por asistir` : "Este evento no da puntos (edítalo en el calendario)"}
                </span>
              </div>
              <EscanerAsistencia />
              <ListaAsistencia
                inscritos={(elegido.inscripciones_eventos ?? []).map((i) => {
                  const p = nombres.get(i.id_usuario);
                  return {
                    id: i.id,
                    asistio: i.asistio,
                    estado: ETIQUETA_RESPUESTA[i.estado as EstadoRespuesta] ?? i.estado,
                    nombre: p?.nombre ?? "Participante",
                    rol: p?.rol ?? null,
                  };
                })}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
