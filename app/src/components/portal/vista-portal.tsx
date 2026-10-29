import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CalendarPlus,
  Check,
  ClipboardList,
  Flag,
  GraduationCap,
  ListChecks,
  MapPin,
  Medal,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { DiagnosticoMadurez } from "@/components/empresas/diagnostico-madurez";
import { LineaTiempo } from "@/components/empresas/linea-tiempo";
import { Medalla } from "@/components/gamificacion/medalla";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { calcularNivel } from "@/lib/gamificacion";
import type { Hito, TipoHito } from "@/lib/empresas";
import {
  alertasPortal,
  compromisosPendientes,
  ejesAMejorar,
  leerDiagnostico,
  nombreEje,
  recomendarOportunidades,
  rutaAcompanamiento,
  type PortalDatos,
} from "@/lib/portal";
import { cn } from "@/lib/utils";

const ZONA = "America/Bogota";
const FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: ZONA });
const FECHA_HORA = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: ZONA });
const fechaDia = (iso: string) => FECHA.format(new Date(`${iso}T12:00:00-05:00`));
const TIPOS_HITO: TipoHito[] = ["proyecto_aula", "plan_accion", "cita", "diagnostico", "evento", "atencion"];

type Props = {
  datos: PortalDatos;
  /** propio: el emprendedor (acciones habilitadas). lectura: CDE, docente o estudiante con acceso. */
  modo: "propio" | "lectura";
  /** Quien puede abrir la Ficha 360° de la empresa (CDE y docente del proyecto) */
  verFicha: boolean;
  saludo: string;
};

export function VistaPortal({ datos, modo, verFicha, saludo }: Props) {
  const propio = modo === "propio";
  const ruta = rutaAcompanamiento(datos);
  const etapa = ruta.find((e) => e.estado === "actual") ?? ruta[ruta.length - 1];
  const diag = leerDiagnostico(datos.diagnosticos);
  const pendientes = compromisosPendientes(datos.planes);
  const vencidos = pendientes.filter((c) => c.vencido).length;
  const ejes = ejesAMejorar(datos);
  const oportunidades = recomendarOportunidades(datos.oferta, ejes).slice(0, 6);
  const alertas = alertasPortal(datos);
  const proxima = datos.mis_eventos.find((e) => Date.parse(e.fecha) >= Date.now() - 3_600_000) ?? null;
  const nivel = datos.progreso ? calcularNivel(datos.progreso.puntos) : null;
  const hitos: Hito[] = datos.historial
    .filter((h) => (TIPOS_HITO as string[]).includes(h.tipo))
    .map((h) => ({ id: `${h.tipo}-${h.id_registro}`, tipo: h.tipo as TipoHito, fecha: h.fecha, titulo: h.titulo, detalle: h.detalle, estado: h.estado }));
  const hayEjemplos =
    datos.diagnosticos.some((d) => d.es_ejemplo) || datos.planes.some((p) => p.es_ejemplo) || datos.brechas.some((b) => b.es_ejemplo);
  const e = datos.empresa;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--primario-texto)]">{saludo}</p>
          <h1 className="text-2xl font-semibold text-[var(--tinta)]">{e.nombre}</h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {e.sector && <span>{e.sector}</span>}
            {e.municipio && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden /> {e.municipio}
              </span>
            )}
            {e.mentor && (
              <span className="inline-flex items-center gap-1">
                <UserRound className="size-3.5" aria-hidden /> Mentor: {e.mentor}
              </span>
            )}
          </p>
        </div>
        {hayEjemplos && (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
            Incluye datos de ejemplo del CDE
          </Badge>
        )}
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-recorrido="portal-indicadores">
        <Indicador icono={Flag} titulo="Etapa actual" valor={etapa.nombre} pie={etapa.evidencia ?? "Según tus registros en el CDE"} color="verde" />
        <Indicador
          icono={ClipboardList}
          titulo="Madurez empresarial"
          valor={diag ? `${Number(diag.ultimo.promedio).toFixed(1)} / 5` : "Sin diagnóstico"}
          pie={
            diag ? (
              diag.cambio !== null ? (
                <span className={cn("inline-flex items-center gap-1 font-medium", diag.cambio >= 0 ? "text-emerald-700" : "text-red-700")}>
                  {diag.cambio >= 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
                  {diag.cambio >= 0 ? "+" : ""}
                  {diag.cambio.toFixed(2)} desde el primero
                </span>
              ) : (
                `Nivel ${diag.ultimo.nivel ?? "—"} · ${fechaDia(diag.ultimo.fecha)}`
              )
            ) : (
              "Pide tu diagnóstico al CDE"
            )
          }
          color="azul"
        />
        <Indicador
          icono={ListChecks}
          titulo="Compromisos pendientes"
          valor={String(pendientes.length)}
          pie={vencidos ? <span className="font-medium text-red-700">{vencidos} vencido{vencidos > 1 ? "s" : ""}</span> : "Ninguno vencido"}
          color="ambar"
        />
        <Indicador
          icono={Medal}
          titulo="Mi progreso"
          valor={nivel ? nivel.actual.nombre : "—"}
          pie={datos.progreso ? `${datos.progreso.puntos} puntos · ${datos.progreso.insignias.length} insignias` : "Sin representante vinculado"}
          color="violeta"
        />
      </div>

      {/* Ruta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="size-5 text-[var(--primario-texto)]" aria-hidden /> Mi ruta de acompañamiento
          </CardTitle>
          <CardDescription>Estimada a partir de tus registros en el CDE: una etapa se marca solo cuando hay un registro que la respalda.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 sm:grid-cols-5">
            {ruta.map((paso, i) => (
              <li key={paso.clave} className="relative flex gap-3 sm:flex-col sm:items-center sm:text-center">
                {i < ruta.length - 1 && (
                  <span
                    className={cn(
                      "absolute top-4 left-[calc(50%+1.25rem)] hidden h-0.5 w-[calc(100%-2.5rem)] sm:block",
                      paso.estado === "completada" ? "bg-[var(--primario)]" : "bg-black/10",
                    )}
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                    paso.estado === "completada" && "border-[var(--primario)] bg-[var(--primario)] text-white",
                    paso.estado === "actual" && "border-[var(--primario)] bg-white text-[var(--primario-texto)] ring-4 ring-[var(--primario)]/15",
                    paso.estado === "pendiente" && "text-muted-foreground border-black/15 bg-white",
                  )}
                >
                  {paso.estado === "completada" ? <Check className="size-4" aria-hidden /> : i + 1}
                </span>
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold", paso.estado === "pendiente" && "text-muted-foreground")}>
                    {paso.nombre}
                    {paso.estado === "actual" && <span className="sr-only"> (etapa actual)</span>}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {paso.evidencia ?? (paso.estado === "actual" ? "Tu siguiente paso" : "Aún sin registros")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Mi emprendimiento + diagnóstico + próxima actividad */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-5 text-[var(--primario-texto)]" aria-hidden /> Mi emprendimiento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
              <Dato etiqueta="Sector" valor={e.sector} estimado={e.datos_estimados.includes("sector")} />
              <Dato etiqueta="Tamaño" valor={e.tamano} estimado={e.datos_estimados.includes("tamano")} />
              <Dato etiqueta="Formalización" valor={e.formalizacion} estimado={e.datos_estimados.includes("formalizacion")} />
              <Dato etiqueta="Municipio" valor={[e.municipio, e.departamento].filter(Boolean).join(", ") || null} />
              <Dato etiqueta="NIT" valor={e.nit} />
              <Dato etiqueta="En el CDE desde" valor={new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: ZONA }).format(new Date(e.creado_en))} />
              <Dato etiqueta="Actividad económica" valor={null} />
              <Dato etiqueta="Tiempo de funcionamiento" valor={null} />
            </dl>
            {e.descripcion && (
              <div>
                <p className="text-muted-foreground text-xs">Productos y servicios</p>
                <p>{e.descripcion}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {propio && (
                <Link href="/mi-empresa" className={buttonVariants({ size: "sm", variant: "outline" })}>
                  Actualizar datos
                </Link>
              )}
              {verFicha && (
                <Link href={`/empresas/${e.id}`} className={buttonVariants({ size: "sm", variant: "ghost" })}>
                  Ficha 360° <ArrowRight aria-hidden />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <DiagnosticoMadurez diagnostico={datos.diagnosticos[0] ?? null} historial={datos.diagnosticos} />
        </div>

        <div className="space-y-6">
          {/* Fortalezas y áreas de mejora */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fortalezas y áreas de mejora</CardTitle>
              <CardDescription>Del último diagnóstico y de las brechas que registró el CDE.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!diag && !datos.brechas.length ? (
                <p className="text-muted-foreground">Cuando tengas un diagnóstico verás aquí tus fortalezas y lo que conviene mejorar.</p>
              ) : (
                <>
                  {!!diag?.fortalezas.length && (
                    <div>
                      <p className="text-xs font-semibold text-emerald-700">Fortalezas</p>
                      <ul className="mt-1 flex flex-wrap gap-1.5">
                        {diag.fortalezas.map((f) => (
                          <li key={f.eje} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                            {f.nombre} · {f.valor.toFixed(1)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!!ejes.length && (
                    <div>
                      <p className="text-xs font-semibold text-amber-800">Áreas de mejora</p>
                      <ul className="mt-1 flex flex-wrap gap-1.5">
                        {ejes.map((eje) => (
                          <li key={eje} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900">
                            {nombreEje(eje)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {datos.brechas.filter((b) => !b.cerrada_en).length > 0 && (
                    <ul className="text-muted-foreground list-disc space-y-0.5 pl-4 text-xs">
                      {datos.brechas
                        .filter((b) => !b.cerrada_en)
                        .slice(0, 4)
                        .map((b) => (
                          <li key={b.id}>{b.descripcion}</li>
                        ))}
                    </ul>
                  )}
                  {ejes[0] && (
                    <p className="rounded-lg bg-[var(--verde-suave)] p-2 text-xs">
                      <b>Sugerencia:</b> empieza por <b>{nombreEje(ejes[0])}</b>; abajo verás las capacitaciones relacionadas.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Próxima actividad */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="size-5 text-[var(--primario-texto)]" aria-hidden /> Próxima actividad
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {proxima ? (
                <div className="space-y-1">
                  <p className="font-semibold">{proxima.nombre}</p>
                  <p className="text-muted-foreground first-letter:uppercase">
                    {proxima.tipo} · {FECHA_HORA.format(new Date(proxima.fecha))}
                    {proxima.lugar && ` · ${proxima.lugar}`}
                  </p>
                  <p className="text-xs">
                    {proxima.estado === "pendiente" ? (
                      <span className="font-medium text-amber-800">Invitación sin responder</span>
                    ) : (
                      <span className="font-medium text-emerald-700">Asistencia confirmada</span>
                    )}
                    {proxima.puntos_gamificacion > 0 && ` · vale ${proxima.puntos_gamificacion} puntos`}
                  </p>
                  <Link href={`/eventos?e=${proxima.id}`} className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-[var(--primario-texto)] underline underline-offset-4">
                    {propio ? "Ver detalle y mi QR" : "Ver detalle"} <ArrowRight className="size-3" aria-hidden />
                  </Link>
                </div>
              ) : (
                <p className="text-muted-foreground">No hay actividades confirmadas próximamente. Revisa las oportunidades de abajo.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Compromisos + accesos rápidos */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="size-5 text-[var(--primario-texto)]" aria-hidden /> Compromisos pendientes
            </CardTitle>
            <CardDescription>De los planes de acción acordados con el CDE. El avance se reporta en Planes de acción.</CardDescription>
          </CardHeader>
          <CardContent>
            {pendientes.length ? (
              <ul className="divide-y">
                {pendientes.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 text-sm">
                    <div className="min-w-0 flex-1 basis-full sm:basis-0">
                      <p className="font-medium">{c.descripcion}</p>
                      <p className="text-muted-foreground text-xs">
                        {c.plan}
                        {c.responsable && ` · ${c.responsable}`}
                      </p>
                    </div>
                    <div className="w-24 sm:ml-0">
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuenow={c.avance} aria-valuemin={0} aria-valuemax={100} aria-label={`Avance: ${c.avance} %`}>
                        <div className="h-full rounded-full bg-[var(--primario)]" style={{ width: `${c.avance}%` }} />
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-right text-xs tabular-nums">{c.avance} %</p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        c.vencido ? "bg-red-100 text-red-800" : "bg-amber-50 text-amber-900",
                      )}
                    >
                      {c.vencido ? "Vencido · " : ""}
                      {c.fecha_limite ? fechaDia(c.fecha_limite) : "Sin fecha"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                {datos.planes.length ? "¡Todo al día! No tienes compromisos pendientes." : "Aún no hay un plan de acción. El CDE lo crea contigo después del diagnóstico."}
              </p>
            )}
            {datos.planes.length > 0 && (
              <Link href={`/planes?empresa=${e.id}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--primario-texto)] underline underline-offset-4">
                {propio ? "Reportar avance en Planes de acción" : "Ver en Planes de acción"} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accesos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {propio && <Acceso href="/mi-empresa" icono={Building2} texto="Mi emprendimiento" />}
            {verFicha && <Acceso href={`/empresas/${e.id}`} icono={ClipboardList} texto="Diagnóstico y Ficha 360°" />}
            <Acceso href={`/planes?empresa=${e.id}`} icono={ListChecks} texto="Compromisos" />
            <Acceso href="/eventos" icono={GraduationCap} texto="Capacitaciones y eventos" />
            {propio ? (
              <Acceso href="/eventos" icono={CalendarPlus} texto="Solicitar asesoría" nota="Crea una actividad tipo «Cita» e invita a tu mentor" />
            ) : null}
            <Acceso href="/formacion" icono={Medal} texto="Formación y recompensas" />
          </CardContent>
        </Card>
      </div>

      {/* Oportunidades */}
      <section className="space-y-3" data-recorrido="portal-oportunidades">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-[var(--tinta)]">Oportunidades para mi negocio</h2>
            <p className="text-muted-foreground text-sm">
              {ejes.length
                ? "«Recomendada» = trata un área a mejorar de tu diagnóstico o de tus brechas. El resto es oferta general del CDE."
                : "Oferta general del CDE. Con un diagnóstico, te señalaremos las que más te convienen."}
            </p>
          </div>
          <Link href="/eventos" className="text-sm font-semibold text-[var(--primario-texto)] underline underline-offset-4">
            Ver calendario completo
          </Link>
        </div>
        {oportunidades.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {oportunidades.map((o) => (
              <li key={o.id} className={cn("flex flex-col rounded-2xl border bg-white p-4", o.recomendada && "border-[var(--primario)]/50 ring-1 ring-[var(--primario)]/20")}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{o.tipo}</Badge>
                  {o.recomendada ? (
                    <Badge className="bg-[var(--primario)] text-white">
                      <Sparkles aria-hidden /> Recomendada · {nombreEje(o.recomendada)}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Oferta general</Badge>
                  )}
                  {o.es_ejemplo && <Badge variant="outline">Ejemplo</Badge>}
                </div>
                <p className="mt-2 leading-tight font-semibold">{o.nombre}</p>
                {o.descripcion && <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{o.descripcion}</p>}
                <p className="text-muted-foreground mt-2 text-xs first-letter:uppercase">
                  {FECHA_HORA.format(new Date(o.fecha))}
                  {o.lugar && ` · ${o.lugar}`}
                  {o.puntos_gamificacion > 0 && ` · ${o.puntos_gamificacion} puntos`}
                </p>
                <Link href={`/eventos?e=${o.id}`} className={cn(buttonVariants({ size: "sm", variant: o.recomendada ? "default" : "outline" }), "mt-3 self-start")}>
                  {propio ? "Ver e inscribirme" : "Ver detalle"}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">No hay capacitaciones ni eventos abiertos próximamente.</p>
        )}
      </section>

      {/* Progreso + historial */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Medal className="size-5 text-[var(--primario-texto)]" aria-hidden /> Mi progreso y aprendizaje
            </CardTitle>
            <CardDescription>Puntos por asistir a capacitaciones y eventos, completar el recorrido y más.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {datos.progreso && nivel ? (
              <>
                <div className="flex items-center gap-3">
                  <Image
                    src={datos.progreso.puntos ? "/buho/buho-puntos-ganados.png" : "/buho/buho-cero-puntos.png"}
                    alt=""
                    width={397}
                    height={382}
                    className="h-auto w-16"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {nivel.actual.nombre} · {datos.progreso.puntos} puntos
                    </p>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuenow={nivel.progreso} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso hacia el siguiente nivel">
                      <div className="h-full rounded-full bg-[var(--primario)]" style={{ width: `${nivel.progreso}%` }} />
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {nivel.siguiente ? `Faltan ${nivel.faltan} para ${nivel.siguiente.nombre}` : "Nivel máximo"} · {datos.progreso.eventos_asistidos} eventos asistidos
                    </p>
                  </div>
                </div>
                {datos.progreso.insignias.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {datos.progreso.insignias.slice(0, 6).map((i) => (
                      <li key={i.nombre} title={i.nombre} className="flex items-center gap-1.5 rounded-full border bg-white py-0.5 pr-2 pl-0.5 text-xs">
                        <Medalla nivel={i.nivel} criterio={i.criterio} tamano="sm" className="size-6" /> {i.nombre}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-xs">Aún sin insignias.</p>
                )}
                <Link href="/formacion" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primario-texto)] underline underline-offset-4">
                  {propio ? "Ver mis logros y recompensas" : "Formación y recompensas"} <ArrowRight className="size-3" aria-hidden />
                </Link>
              </>
            ) : (
              <p className="text-muted-foreground">La empresa aún no tiene un representante con cuenta, así que no hay puntos que mostrar.</p>
            )}
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <LineaTiempo hitos={hitos} />
        </div>
      </div>

      {/* Alertas */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--tinta)]">Alertas y avisos</h2>
        {alertas.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {alertas.map((a) => (
              <li key={a.clave} className={cn("flex items-start gap-3 rounded-2xl border p-4", TONO[a.tono].caja)}>
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", TONO[a.tono].icono)}>
                  <AlertTriangle className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm">{a.titulo}</p>
                  <p className="text-xl font-bold tabular-nums">{a.valor}</p>
                  {(propio || a.clave === "vencidos" || a.clave === "semana") && (
                    <Link href={a.href} className="text-xs font-semibold underline underline-offset-4">
                      {a.accion}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-center text-sm">Sin alertas: todo está al día.</p>
        )}
      </section>
    </div>
  );
}

const TONO = {
  rojo: { caja: "border-red-100 bg-red-50/60", icono: "bg-red-100 text-red-700" },
  ambar: { caja: "border-amber-100 bg-amber-50/60", icono: "bg-amber-100 text-amber-800" },
  azul: { caja: "border-sky-100 bg-sky-50/60", icono: "bg-sky-100 text-sky-800" },
  violeta: { caja: "border-violet-100 bg-violet-50/60", icono: "bg-violet-100 text-violet-800" },
};

const COLORES = {
  verde: "bg-[var(--verde-suave)] text-[var(--primario-texto)]",
  azul: "bg-sky-50 text-sky-700",
  ambar: "bg-amber-50 text-amber-700",
  violeta: "bg-violet-50 text-violet-700",
};

function Indicador({ icono: Icono, titulo, valor, pie, color }: { icono: LucideIcon; titulo: string; valor: string; pie: React.ReactNode; color: keyof typeof COLORES }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-2xl border bg-white p-4">
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs sm:text-sm">{titulo}</p>
        <p className="mt-1 truncate text-lg font-bold text-[var(--tinta)] sm:text-xl">{valor}</p>
        <p className="text-muted-foreground mt-1 text-xs">{pie}</p>
      </div>
      <span className={cn("hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex", COLORES[color])}>
        <Icono className="size-5" aria-hidden />
      </span>
    </div>
  );
}

function Dato({ etiqueta, valor, estimado }: { etiqueta: string; valor: string | null; estimado?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className={cn(!valor && "text-muted-foreground italic")}>
        {valor ?? "No registrado"}
        {valor && estimado && <span className="ml-1 text-xs text-amber-700">(estimado)</span>}
      </dd>
    </>
  );
}

function Acceso({ href, icono: Icono, texto, nota }: { href: string; icono: LucideIcon; texto: string; nota?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl border p-2.5 text-sm transition hover:border-[var(--primario)] hover:bg-[var(--verde-suave)]/40">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--verde-suave)] text-[var(--primario-texto)]">
        <Icono className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{texto}</span>
        {nota && <span className="text-muted-foreground block text-xs">{nota}</span>}
      </span>
      <ArrowRight className="text-muted-foreground size-4" aria-hidden />
    </Link>
  );
}
