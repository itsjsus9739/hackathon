import { LogoCde } from "@/components/marca/logo-cde";
import { calcularNivel } from "@/lib/gamificacion";
import { compromisosPendientes, ejesAMejorar, leerDiagnostico, nombreEje, rutaAcompanamiento, type PortalDatos } from "@/lib/portal";

// Informe imprimible del portal (se guarda como PDF desde el navegador). Colores fijos claros:
// sale igual aunque el usuario use el modo oscuro, y las tablas no se parten a mitad de fila.

const ZONA = "America/Bogota";
const fechaDia = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: ZONA }).format(new Date(`${iso.slice(0, 10)}T12:00:00-05:00`)) : "—";
const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: ZONA }).format(new Date(iso));
const TIPO_HITO: Record<string, string> = {
  atencion: "Atención",
  proyecto_aula: "Proyecto de aula",
  cita: "Cita o asesoría",
  diagnostico: "Diagnóstico",
  evento: "Evento",
  plan_accion: "Plan de acción",
};

export function InformePortal({ datos, generadoPor, generadoEn }: { datos: PortalDatos; generadoPor: string; generadoEn: Date }) {
  const e = datos.empresa;
  const ruta = rutaAcompanamiento(datos);
  const diag = leerDiagnostico(datos.diagnosticos);
  const pendientes = compromisosPendientes(datos.planes);
  const ejes = ejesAMejorar(datos);
  const nivel = datos.progreso ? calcularNivel(datos.progreso.puntos) : null;
  const hayEjemplos = datos.diagnosticos.some((d) => d.es_ejemplo) || datos.planes.some((p) => p.es_ejemplo) || datos.brechas.some((b) => b.es_ejemplo);

  return (
    <article className="informe mx-auto max-w-[210mm] bg-white p-8 text-[11pt] leading-snug text-[#0b3d2a] print:max-w-none print:p-0">
      <header className="flex items-end justify-between gap-4 border-b-2 border-[#00a862] pb-3">
        <div>
          <p className="text-[9pt] font-semibold tracking-wide text-[#00784a] uppercase">Portal del emprendedor · Informe</p>
          <h1 className="text-[20pt] leading-tight font-bold">{e.nombre}</h1>
          <p className="text-[9pt] text-[#36564a]">
            {[e.sector, e.tamano, [e.municipio, e.departamento].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
          </p>
        </div>
        <LogoCde className="w-40 dark:brightness-100" />
      </header>

      {hayEjemplos && <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[9pt]">Incluye datos de ejemplo del CDE (marcados como «Ejemplo»).</p>}

      <Seccion titulo="Resumen">
        <div className="grid grid-cols-4 gap-2">
          <Cifra etiqueta="Etapa actual" valor={ruta.find((p) => p.estado === "actual")?.nombre ?? "Ruta completa"} />
          <Cifra etiqueta="Madurez" valor={diag ? `${Number(diag.ultimo.promedio).toFixed(2)} / 5 · ${diag.ultimo.nivel ?? ""}` : "Sin diagnóstico"} />
          <Cifra etiqueta="Compromisos pendientes" valor={`${pendientes.length} (${pendientes.filter((c) => c.vencido).length} vencidos)`} />
          <Cifra etiqueta="Progreso" valor={nivel && datos.progreso ? `${nivel.actual.nombre} · ${datos.progreso.puntos} pts` : "—"} />
        </div>
      </Seccion>

      <Seccion titulo="Ruta de acompañamiento" nota="Estimada a partir de los registros: una etapa cuenta solo si hay un registro que la respalde.">
        <ol className="grid grid-cols-5 gap-2">
          {ruta.map((p, i) => (
            <li key={p.clave} className={`rounded border p-2 ${p.estado === "completada" ? "border-[#00a862] bg-[#e6f6ee]" : p.estado === "actual" ? "border-[#00a862]" : "border-[#ddefe5] text-[#5e7a6c]"}`}>
              <p className="text-[9pt] font-semibold">
                {i + 1}. {p.nombre}
              </p>
              <p className="text-[8pt]">{p.estado === "completada" ? "✓ " : p.estado === "actual" ? "▶ Etapa actual · " : ""}{p.evidencia ?? "Sin registros"}</p>
            </li>
          ))}
        </ol>
      </Seccion>

      <Seccion titulo="Perfil del emprendimiento">
        <table className="w-full">
          <tbody>
            {[
              ["NIT", e.nit],
              ["Formalización", e.formalizacion],
              ["Vínculo UNAB", e.vinculo_unab],
              ["Emprendedor", e.representante],
              ["Mentor del CDE", e.mentor],
              ["Productos y servicios", e.descripcion],
              ["Datos por confirmar", e.datos_estimados.length ? e.datos_estimados.join(", ") + " (estimados por el CDE)" : "Ninguno"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-[#ddefe5]">
                <th className="w-44 py-1 pr-2 text-left align-top text-[9pt] font-medium text-[#5e7a6c]">{k}</th>
                <td className="py-1">{v ?? <span className="text-[#5e7a6c] italic">No registrado</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Seccion>

      <Seccion titulo="Diagnóstico de madurez" nota={diag ? `Último: ${fechaDia(diag.ultimo.fecha)}${diag.cambio !== null ? ` · cambio desde el ${fechaDia(diag.desde)}: ${diag.cambio >= 0 ? "+" : ""}${diag.cambio.toFixed(2)}` : ""}` : undefined}>
        {diag ? (
          <>
            <table className="w-full">
              <tbody>
                {diag.areas.map((a) => (
                  <tr key={a.eje} className="border-b border-[#ddefe5]">
                    <td className="w-64 py-1">{a.nombre}</td>
                    <td className="py-1">
                      <div className="h-2.5 w-full rounded bg-[#eef6f1]">
                        <div className={`h-2.5 rounded ${a.valor < 2.5 ? "bg-[#e11d48]" : a.valor < 3.5 ? "bg-[#f59e0b]" : "bg-[#00a862]"}`} style={{ width: `${(a.valor / 5) * 100}%` }} />
                      </div>
                    </td>
                    <td className="w-12 py-1 text-right font-semibold tabular-nums">{a.valor.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[9pt]">
              <b>Fortalezas:</b> {diag.fortalezas.map((f) => f.nombre).join(", ") || "—"}
              <br />
              <b>Áreas de mejora:</b> {ejes.map(nombreEje).join(", ") || "—"}
            </p>
          </>
        ) : (
          <p className="text-[#5e7a6c]">Aún no tiene diagnóstico de madurez.</p>
        )}
        {datos.brechas.length > 0 && (
          <Tabla
            columnas={["Brecha", "Área", "Detectada", "Estado"]}
            filas={datos.brechas.map((b) => [b.descripcion + (b.es_ejemplo ? " (Ejemplo)" : ""), b.area, fechaDia(b.detectada_en), b.cerrada_en ? `Cerrada ${fechaDia(b.cerrada_en)}` : "Abierta"])}
          />
        )}
      </Seccion>

      <Seccion titulo="Planes de acción y compromisos">
        {datos.planes.length ? (
          datos.planes.map((p) => (
            <div key={p.id} className="mb-3 break-inside-avoid">
              <p className="font-semibold">
                {p.titulo} <span className="font-normal text-[#5e7a6c]">· {p.estado} · {p.avance} % · vence {fechaDia(p.fecha_limite)}{p.responsable ? ` · ${p.responsable}` : ""}{p.es_ejemplo ? " · Ejemplo" : ""}</span>
              </p>
              {p.compromisos.length > 0 && (
                <Tabla
                  columnas={["Compromiso", "Responsable", "Fecha límite", "Estado", "Avance"]}
                  filas={p.compromisos.map((c) => [c.descripcion, c.responsable ?? "—", fechaDia(c.fecha_limite), c.vencido ? `${c.estado} · VENCIDO` : c.estado, `${c.avance} %`])}
                />
              )}
            </div>
          ))
        ) : (
          <p className="text-[#5e7a6c]">Aún no hay planes de acción.</p>
        )}
      </Seccion>

      {datos.mis_eventos.length > 0 && (
        <Seccion titulo="Próximas actividades">
          <Tabla
            columnas={["Actividad", "Tipo", "Fecha", "Respuesta"]}
            filas={datos.mis_eventos.map((ev) => [ev.nombre, ev.tipo, fechaHora(ev.fecha), ev.estado === "pendiente" ? "Sin responder" : ev.asistio ? "Asistió" : "Asistirá"])}
          />
        </Seccion>
      )}

      {datos.progreso && (
        <Seccion titulo="Progreso y aprendizaje">
          <p>
            {nivel?.actual.nombre} · {datos.progreso.puntos} puntos · {datos.progreso.eventos_asistidos} eventos asistidos · {datos.progreso.insignias.length} insignias
            {datos.progreso.insignias.length > 0 && `: ${datos.progreso.insignias.map((i) => i.nombre).join(", ")}`}
          </p>
        </Seccion>
      )}

      {datos.historial.length > 0 && (
        <Seccion titulo="Historial con el CDE" nota="Los 20 registros más recientes.">
          <Tabla columnas={["Fecha", "Tipo", "Detalle", "Estado"]} filas={datos.historial.slice(0, 20).map((h) => [fechaDia(h.fecha), TIPO_HITO[h.tipo] ?? h.tipo, [h.titulo, h.detalle].filter(Boolean).join(" · "), h.estado ?? ""])} />
        </Seccion>
      )}

      <footer className="mt-6 border-t border-[#ddefe5] pt-2 text-[8pt] text-[#5e7a6c]">
        Generado por {generadoPor} el {fechaHora(generadoEn.toISOString())} desde CDE Conecta · Centro de Desarrollo Empresarial UNAB. Contiene datos
        personales y empresariales: compártelo solo con personas autorizadas (Ley 1581 de 2012).
      </footer>
    </article>
  );
}

function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-1.5 border-b border-[#ddefe5] pb-1 text-[12pt] font-bold text-[#00784a] [break-after:avoid]">{titulo}</h2>
      {nota && <p className="mb-1.5 text-[8.5pt] text-[#5e7a6c]">{nota}</p>}
      {children}
    </section>
  );
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded border border-[#ddefe5] p-2">
      <p className="text-[8pt] text-[#5e7a6c]">{etiqueta}</p>
      <p className="text-[10.5pt] font-semibold">{valor}</p>
    </div>
  );
}

function Tabla({ columnas, filas }: { columnas: string[]; filas: string[][] }) {
  return (
    <table className="mt-1 w-full border-collapse text-[9pt]">
      <thead>
        <tr className="bg-[#e6f6ee]">
          {columnas.map((c) => (
            <th key={c} className="border border-[#ddefe5] px-1.5 py-1 text-left font-semibold">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={i} className="break-inside-avoid">
            {f.map((v, j) => (
              <td key={j} className="border border-[#ddefe5] px-1.5 py-1 align-top">
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
