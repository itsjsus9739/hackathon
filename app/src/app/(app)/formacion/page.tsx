import type { Metadata } from "next";
import Image from "next/image";
import { Coins, Info, Medal, Trophy, TrendingUp } from "lucide-react";

import { BotonCanjear } from "@/components/gamificacion/boton-canjear";
import { MisInsignias, type InsigniaVista } from "@/components/gamificacion/insignias";
import { Medalla } from "@/components/gamificacion/medalla";
import { BotonIniciarRecorrido } from "@/components/buho/recorrido-buho";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calcularNivel,
  esCde,
  estadoInsignia,
  leerRecompensa,
  progresoInsignia,
  recompensaParaRol,
  reglasPuntos,
} from "@/lib/gamificacion";
import { COLOR_ROL, ETIQUETA_ROL } from "@/lib/roles";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Formación y recompensas · CDE Conecta" };

const ZONA = "America/Bogota";
const FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: ZONA });

const ESTADO_CANJE: Record<string, string> = {
  Solicitado: "bg-amber-100 text-amber-900",
  Entregado: "bg-emerald-100 text-emerald-800",
  Rechazado: "bg-red-100 text-red-800",
};

export default async function PaginaFormacion() {
  const sesion = await obtenerSesion();
  if (!sesion) return null;
  const supabase = await crearClienteServidor();

  // RLS: cada quien recibe lo suyo; las insignias ajenas solo de su círculo (0023)
  const [resumen, catalogo, ganadas, aportesOk, progreso, recompensas, canjes, movimientos, ranking, directorio] = await Promise.all([
    supabase.from("puntos_usuario").select("puntos, saldo, eventos_asistidos, insignias").eq("id_usuario", sesion.id).maybeSingle(),
    supabase
      .from("insignias")
      .select("id, nombre, descripcion, nivel, criterio, meta, id_area, roles, areas (nombre)")
      .eq("activa", true)
      .order("nivel")
      .order("nombre"),
    supabase.from("insignias_usuario").select("id_usuario, id_insignia, otorgada_en"),
    supabase.from("aportes").select("id_area").eq("id_usuario", sesion.id).eq("estado", "Validado"),
    supabase.from("progreso_onboarding").select("completado_en").eq("id_usuario", sesion.id).maybeSingle(),
    supabase.from("recompensas").select("id, nombre, descripcion, costo_puntos, stock").eq("activa", true).order("costo_puntos"),
    supabase
      .from("canjes")
      .select("id, estado, puntos, creado_en, comentario, recompensas (nombre)")
      .eq("id_usuario", sesion.id)
      .order("creado_en", { ascending: false })
      .limit(5),
    supabase
      .from("puntos_movimientos")
      .select("id, puntos, motivo, creado_en")
      .eq("id_usuario", sesion.id)
      .order("creado_en", { ascending: false })
      .limit(10),
    supabase.rpc("ranking_puntos", { limite: 10 }),
    supabase.rpc("directorio"),
  ]);
  for (const r of [resumen, catalogo, ganadas, aportesOk, progreso, recompensas, canjes, movimientos, ranking, directorio]) {
    if (r.error) throw new Error(`No se pudo cargar la gamificación: ${r.error.message}`);
  }

  // Un usuario sin movimientos no tiene fila en puntos_usuario: todo en 0
  const puntos = resumen.data?.puntos ?? 0;
  const saldo = resumen.data?.saldo ?? 0;
  const nivel = calcularNivel(puntos);
  const cde = esCde(sesion.rol);

  // --- Insignias propias ---
  const mias = new Map((ganadas.data ?? []).filter((g) => g.id_usuario === sesion.id).map((g) => [g.id_insignia, g.otorgada_en]));
  const aportesPorArea = new Map<string, number>();
  for (const a of aportesOk.data ?? []) aportesPorArea.set(a.id_area, (aportesPorArea.get(a.id_area) ?? 0) + 1);
  const contexto = {
    puntos,
    eventos: resumen.data?.eventos_asistidos ?? 0,
    aportesPorArea,
    aportesTotal: aportesOk.data?.length ?? 0,
    onboarding: Boolean(progreso.data?.completado_en),
  };
  const catalogoPorId = new Map((catalogo.data ?? []).map((i) => [i.id, i]));
  const insignias: InsigniaVista[] = (catalogo.data ?? [])
    // El catálogo también trae las insignias de otros roles que tiene alguien de mi círculo: aquí solo las que puedo ganar
    .filter((i) => !i.roles || i.roles.includes(sesion.rol) || mias.has(i.id))
    .map((i) => {
      const p = progresoInsignia(i, contexto);
      return {
        id: i.id,
        nombre: i.nombre,
        descripcion: i.descripcion,
        nivel: i.nivel,
        criterio: i.criterio,
        area: i.areas?.nombre ?? null,
        estado: estadoInsignia(mias.has(i.id), p),
        progreso: p,
        otorgadaEn: mias.get(i.id) ?? null,
      };
    })
    .sort((a, b) => Number(b.estado === "ganada") - Number(a.estado === "ganada") || (b.progreso?.actual ?? 0) - (a.progreso?.actual ?? 0));

  // --- Círculo: insignias de las personas que puedo ver ---
  const personas = new Map((directorio.data ?? []).map((p) => [p.id, p]));
  const circulo = new Map<string, { id: string; nombre: string; rol: (typeof sesion)["rol"]; insignias: { id: string; nombre: string; nivel: number; criterio: string; area: string | null }[] }>();
  for (const g of ganadas.data ?? []) {
    const persona = personas.get(g.id_usuario);
    const insignia = catalogoPorId.get(g.id_insignia);
    if (g.id_usuario === sesion.id || !persona || !insignia) continue;
    const fila = circulo.get(g.id_usuario) ?? { id: g.id_usuario, nombre: persona.nombre, rol: persona.rol, insignias: [] };
    fila.insignias.push({ id: insignia.id, nombre: insignia.nombre, nivel: insignia.nivel, criterio: insignia.criterio, area: insignia.areas?.nombre ?? null });
    circulo.set(g.id_usuario, fila);
  }
  const circuloLista = [...circulo.values()].sort((a, b) => b.insignias.length - a.insignias.length).slice(0, 12);

  // --- Recompensas: las que aplican a mi rol (el CDE ve el catálogo completo) ---
  const catalogoRecompensas = (recompensas.data ?? []).filter((r) => cde || recompensaParaRol(r.descripcion, sesion.rol));
  const posicion = (ranking.data ?? []).find((r) => r.id === sesion.id)?.posicion ?? null;

  // Búho de la cabecera según el estado
  const buho =
    puntos === 0
      ? { src: "/buho/buho-cero-puntos.png", alt: "Búho esperando tus primeros puntos" }
      : posicion !== null && posicion <= 3
        ? { src: "/buho/buho-en-el-ranking.png", alt: "Búho celebrando en el podio" }
        : { src: "/buho/buho-puntos-ganados.png", alt: "Búho celebrando tus puntos" };

  return (
    <div className="space-y-8">
      {/* A. Cabecera de progreso */}
      <section
        data-recorrido="formacion-progreso"
        className="flex flex-col gap-5 rounded-3xl border bg-gradient-to-br from-white to-[var(--verde-suave)] p-5 sm:flex-row sm:items-center sm:p-6"
      >
        <Image src={buho.src} alt={buho.alt} width={397} height={382} priority className="mx-auto h-auto w-32 shrink-0 sm:mx-0 sm:w-40" />
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[var(--primario-texto)] uppercase">Nivel {nivel.actual.nivel} de 5</p>
            <h2 className="text-2xl font-bold text-[var(--tinta)]">{nivel.actual.nombre}</h2>
            <div
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/10"
              role="progressbar"
              aria-valuenow={nivel.progreso}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progreso hacia el siguiente nivel"
            >
              <div className="h-full rounded-full bg-[var(--primario)] transition-all" style={{ width: `${nivel.progreso}%` }} />
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {nivel.siguiente ? (
                <>
                  Te faltan <b className="text-foreground">{nivel.faltan} puntos</b> para {nivel.siguiente.nombre}
                </>
              ) : (
                "¡Llegaste al nivel más alto!"
              )}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2">
            <Cifra icono={TrendingUp} etiqueta="Puntos ganados" valor={puntos} />
            <Cifra icono={Coins} etiqueta="Saldo canjeable" valor={saldo} />
            <Cifra icono={Medal} etiqueta="Insignias" valor={mias.size} />
          </dl>
          {puntos === 0 && (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-[var(--primario)] bg-white/70 p-3 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm">
                Aún no tienes puntos. Completa el recorrido con el búho y gana tus primeros <b>20 puntos</b> y la insignia Bienvenida.
              </p>
              <BotonIniciarRecorrido />
            </div>
          )}
        </div>
      </section>

      {/* Reglas */}
      <section id="como-gano" className="scroll-mt-20 rounded-2xl border bg-white p-4">
        <h2 className="flex items-center gap-2 font-semibold text-[var(--tinta)]">
          <Info className="size-4 text-[var(--primario-texto)]" aria-hidden /> ¿Cómo gano puntos?
        </h2>
        <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {reglasPuntos(sesion.rol).map((r) => (
            <li key={r.accion} className="flex justify-between gap-3 border-b border-dashed py-1.5 last:border-0">
              <span>{r.accion}</span>
              <span className="shrink-0 font-semibold text-[var(--primario-texto)]">{r.puntos}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-2 text-xs">El nivel se calcula con los puntos ganados: canjear no te baja de nivel.</p>
      </section>

      {/* B. Mis insignias */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--tinta)]">Mis insignias</h2>
        <MisInsignias insignias={insignias} />
      </section>

      {/* C. Recompensas y canje */}
      <section className="space-y-3" data-recorrido="formacion-recompensas">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-[var(--tinta)]">Recompensas</h2>
          <p className="text-muted-foreground text-xs">Catálogo propuesto, sujeto a la aprobación de la UNAB.</p>
        </div>
        {catalogoRecompensas.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {catalogoRecompensas.map((r) => {
              const { publico, detalle } = leerRecompensa(r.descripcion);
              const agotada = r.stock !== null && r.stock <= 0;
              return (
                <li key={r.id} className="flex flex-col rounded-2xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="leading-tight font-semibold">{r.nombre}</p>
                    <span className="shrink-0 rounded-full bg-[var(--verde-suave)] px-2 py-0.5 text-sm font-bold text-[var(--primario-texto)] tabular-nums">
                      {r.costo_puntos} pts
                    </span>
                  </div>
                  {detalle && <p className="text-muted-foreground mt-1 text-sm">{detalle}</p>}
                  <p className="text-muted-foreground mt-2 text-xs">
                    {cde && publico && <>Para {publico} · </>}
                    {r.stock === null ? "Sin límite" : agotada ? "Agotada" : `Quedan ${r.stock}`}
                  </p>
                  <div className="mt-auto pt-3">
                    <BotonCanjear id={r.id} costo={r.costo_puntos} saldo={saldo} agotada={agotada} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
            Todavía no hay recompensas para tu rol. El CDE las publicará pronto.
          </p>
        )}

        {!!canjes.data?.length && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mis canjes recientes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {canjes.data.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {c.recompensas?.nombre ?? "Recompensa"} <span className="text-muted-foreground">· {FECHA.format(new Date(c.creado_en))}</span>
                      {c.comentario && <span className="text-muted-foreground block text-xs">{c.comentario}</span>}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", ESTADO_CANJE[c.estado])}>{c.estado}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* D. Historial */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de puntos</CardTitle>
            <CardDescription>Tus últimos 10 movimientos</CardDescription>
          </CardHeader>
          <CardContent>
            {movimientos.data?.length ? (
              <ul className="divide-y">
                {movimientos.data.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">{m.motivo}</span>
                      <span className="text-muted-foreground text-xs">{FECHA.format(new Date(m.creado_en))}</span>
                    </span>
                    <span className={cn("shrink-0 font-semibold tabular-nums", m.puntos > 0 ? "text-[var(--primario-texto)]" : "text-red-700")}>
                      {m.puntos > 0 ? "+" : ""}
                      {m.puntos}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Aquí verás cada punto que ganes o canjees.</p>
            )}
          </CardContent>
        </Card>

        {/* E. Ranking */}
        <Card data-recorrido="formacion-ranking">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-[#d4a017]" aria-hidden /> Ranking
            </CardTitle>
            <CardDescription>{cde ? "Toda la comunidad del CDE" : "Tu círculo: las personas de tus proyectos que ya puedes ver"}</CardDescription>
          </CardHeader>
          <CardContent>
            {ranking.data?.length ? (
              <ol className="space-y-1">
                {ranking.data.map((r) => {
                  const yo = r.id === sesion.id;
                  return (
                    <li
                      key={r.id}
                      className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm", yo && "bg-[var(--verde-suave)] font-semibold")}
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                          r.posicion === 1 ? "bg-[#ffe08a] text-[#7a5a00]" : r.posicion === 2 ? "bg-[#e8edf0] text-[#4d5a62]" : r.posicion === 3 ? "bg-[#f1cfb3] text-[#7a4a24]" : "bg-black/5",
                        )}
                      >
                        {r.posicion}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {r.nombre}
                        {yo && " (tú)"}
                        <span className={cn("ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium", COLOR_ROL[r.rol].fondo, COLOR_ROL[r.rol].texto)}>
                          {ETIQUETA_ROL[r.rol]}
                        </span>
                      </span>
                      <span className="text-muted-foreground flex items-center gap-0.5 text-xs tabular-nums" title="Insignias">
                        <Medal className="size-3" aria-hidden /> {r.insignias}
                      </span>
                      <span className="w-14 text-right tabular-nums">{r.puntos} pts</span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-muted-foreground text-sm">Nadie de tu círculo tiene puntos todavía. ¡Sé el primero!</p>
            )}
            {posicion === null && puntos > 0 && !!ranking.data?.length && (
              <p className="text-muted-foreground mt-2 text-xs">Aún no estás en el top 10. ¡Sigue sumando!</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* F. Insignias de mi círculo */}
      {circuloLista.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--tinta)]">Insignias de tu círculo</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {circuloLista.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border bg-white p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.nombre}</p>
                  <p className={cn("text-xs", COLOR_ROL[p.rol].texto)}>{ETIQUETA_ROL[p.rol]}</p>
                </div>
                <div className="flex -space-x-2">
                  {p.insignias.slice(0, 5).map((i) => (
                    <span key={i.id} title={i.nombre} className="rounded-full ring-2 ring-white">
                      <Medalla nivel={i.nivel} criterio={i.criterio} area={i.area} tamano="sm" />
                    </span>
                  ))}
                  {p.insignias.length > 5 && (
                    <span className="flex size-9 items-center justify-center rounded-full bg-black/5 text-xs font-semibold ring-2 ring-white">
                      +{p.insignias.length - 5}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Cifra({ icono: Icono, etiqueta, valor }: { icono: typeof Coins; etiqueta: string; valor: number }) {
  return (
    <div className="rounded-xl border bg-white p-2.5 sm:p-3">
      <dt className="text-muted-foreground flex items-center gap-1 text-[11px] sm:text-xs">
        <Icono className="hidden size-3.5 sm:block" aria-hidden /> {etiqueta}
      </dt>
      <dd className="text-xl font-bold text-[var(--tinta)] tabular-nums sm:text-2xl">{valor}</dd>
    </div>
  );
}
