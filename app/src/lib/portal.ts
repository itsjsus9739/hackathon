import { AREAS_DIAGNOSTICO } from "@/lib/constantes";

// Portal del emprendedor: lógica de presentación (pura y probada en __tests__).
// Los datos llegan de portal_datos (0029_portal_emprendedor.sql), que valida el permiso en la base.
// Nada aquí inventa registros: la ruta, las alertas y las recomendaciones salen de lo que existe.

export type Eje = (typeof AREAS_DIAGNOSTICO)[number]["campo"];

export type DiagnosticoPortal = { id: string; fecha: string; promedio: number; nivel: string | null; tipo_iniciativa: string | null; es_ejemplo: boolean } & Record<Eje, number>;
export type BrechaPortal = { id: string; area: string; descripcion: string; eje_diagnostico: Eje | null; detectada_en: string; cerrada_en: string | null; es_ejemplo: boolean };
export type CompromisoPortal = { id: string; descripcion: string; estado: string; avance: number; fecha_limite: string | null; responsable: string | null; vencido: boolean };
export type PlanPortal = {
  id: string;
  titulo: string;
  area: string | null;
  estado: string;
  fecha_inicio: string | null;
  fecha_limite: string | null;
  responsable: string | null;
  avance: number;
  es_ejemplo: boolean;
  compromisos: CompromisoPortal[];
};
export type EventoPortal = {
  id: string;
  nombre: string;
  tipo: string;
  fecha: string;
  lugar: string | null;
  descripcion?: string | null;
  puntos_gamificacion: number;
  estado?: string;
  asistio?: boolean;
  es_ejemplo?: boolean;
};
export type HitoPortal = { tipo: string; fecha: string; titulo: string; detalle: string | null; estado: string | null; id_registro: string };

export type PortalDatos = {
  empresa: {
    id: string;
    nombre: string;
    nit: string | null;
    sector: string | null;
    tamano: string | null;
    municipio: string | null;
    departamento: string | null;
    formalizacion: string | null;
    descripcion: string | null;
    vinculo_unab: string | null;
    datos_estimados: string[];
    creado_en: string;
    representante: string | null;
    mentor: string | null;
  };
  diagnosticos: DiagnosticoPortal[];
  brechas: BrechaPortal[];
  planes: PlanPortal[];
  historial: HitoPortal[];
  mis_eventos: EventoPortal[];
  oferta: EventoPortal[];
  progreso: { puntos: number; saldo: number; eventos_asistidos: number; insignias: { nombre: string; nivel: number; criterio: string; otorgada_en: string }[] } | null;
  equipo: { nombre: string; rol: string }[];
};

export const nombreEje = (eje: string) => AREAS_DIAGNOSTICO.find((a) => a.campo === eje)?.nombre ?? eje;

// ---------------------------------------------------------------------
// Ruta de acompañamiento (estimada a partir de los registros)
// ---------------------------------------------------------------------
export type EtapaRuta = { clave: string; nombre: string; estado: "completada" | "actual" | "pendiente"; evidencia: string | null };

export function rutaAcompanamiento(d: Pick<PortalDatos, "diagnosticos" | "planes" | "brechas" | "historial">): EtapaRuta[] {
  const compromisos = d.planes.flatMap((p) => p.compromisos);
  const atenciones = d.historial.filter((h) => h.tipo === "atencion" || (h.tipo === "cita" && h.estado === "Atendida")).length;
  const conAvance = compromisos.filter((c) => c.avance > 0 || c.estado === "Cumplido").length;
  const cumplidos = compromisos.filter((c) => c.estado === "Cumplido").length;
  const cerradas = d.brechas.filter((b) => b.cerrada_en).length;
  const planCompletado = d.planes.some((p) => p.estado === "Completado");

  const hechos: [string, string, string | null][] = [
    ["diagnostico", "Diagnóstico", d.diagnosticos.length ? `${d.diagnosticos.length} diagnóstico${d.diagnosticos.length > 1 ? "s" : ""}` : null],
    ["plan", "Plan de acción", d.planes.length ? `${d.planes.length} plan${d.planes.length > 1 ? "es" : ""} de acción` : null],
    [
      "acompanamiento",
      "Acompañamiento",
      conAvance || atenciones
        ? [conAvance && `${conAvance} compromiso${conAvance > 1 ? "s" : ""} con avance`, atenciones && `${atenciones} asesoría${atenciones > 1 ? "s" : ""}`]
            .filter(Boolean)
            .join(" · ")
        : null,
    ],
    [
      "seguimiento",
      "Seguimiento",
      cumplidos || cerradas
        ? [cumplidos && `${cumplidos} cumplido${cumplidos > 1 ? "s" : ""}`, cerradas && `${cerradas} brecha${cerradas > 1 ? "s" : ""} cerrada${cerradas > 1 ? "s" : ""}`]
            .filter(Boolean)
            .join(" · ")
        : null,
    ],
    ["evaluacion", "Evaluación", d.diagnosticos.length >= 2 ? "Diagnóstico repetido" : planCompletado ? "Plan completado" : null],
  ];

  // Etapa actual: la primera sin registro. Las posteriores quedan pendientes aunque tengan algo.
  const actual = hechos.findIndex(([, , evidencia]) => !evidencia);
  return hechos.map(([clave, nombre, evidencia], i) => ({
    clave,
    nombre,
    evidencia,
    estado: actual === -1 || i < actual ? "completada" : i === actual ? "actual" : "pendiente",
  }));
}

// ---------------------------------------------------------------------
// Diagnóstico: fortalezas, áreas de mejora y cambio desde el primero
// ---------------------------------------------------------------------
export function leerDiagnostico(diagnosticos: DiagnosticoPortal[]) {
  const [ultimo] = diagnosticos; // vienen del más reciente al más antiguo
  if (!ultimo) return null;
  const areas = AREAS_DIAGNOSTICO.map((a) => ({ eje: a.campo, nombre: a.nombre, valor: Number(ultimo[a.campo]) }));
  const primero = diagnosticos.length > 1 ? diagnosticos[diagnosticos.length - 1] : null;
  return {
    ultimo,
    areas,
    fortalezas: areas.filter((a) => a.valor >= 3.5).sort((a, b) => b.valor - a.valor),
    mejoras: areas.filter((a) => a.valor < 3).sort((a, b) => a.valor - b.valor),
    cambio: primero ? Math.round((Number(ultimo.promedio) - Number(primero.promedio)) * 100) / 100 : null,
    desde: primero?.fecha ?? null,
  };
}

// ---------------------------------------------------------------------
// Oportunidades: regla sencilla por palabras clave del área a mejorar
// ---------------------------------------------------------------------
const PALABRAS: Record<Eje, string[]> = {
  estrategia: ["estrateg", "modelo de negocio", "plan de negocio", "liderazgo", "planeación", "innovaci"],
  mercadeo_ventas: ["mercad", "marketing", "ventas", "vender", "clientes", "marca", "redes sociales", "comercial"],
  financiera: ["financ", "flujo de caja", "costos", "costeo", "contab", "precios", "inversi", "crédito", "credito"],
  normativa_legal: ["formaliz", "legal", "normativ", "tribut", "impuesto", "registro mercantil", "contrato"],
  productividad: ["productiv", "procesos", "calidad", "operaci", "logística", "logistica", "inventario"],
  transformacion_digital: ["digital", "tecnolog", "redes sociales", "comercio electrónico", "en línea", "software", "ia "],
};

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type Oportunidad = EventoPortal & { recomendada: Eje | null };

/** Marca como recomendadas las actividades que tratan un área a mejorar (diagnóstico bajo o brecha abierta). */
export function recomendarOportunidades(oferta: EventoPortal[], ejesAMejorar: Eje[]): Oportunidad[] {
  const marcadas = oferta.map((ev) => {
    const texto = ` ${sinTildes(`${ev.nombre} ${ev.descripcion ?? ""}`)} `;
    const eje = ejesAMejorar.find((e) => PALABRAS[e].some((p) => texto.includes(sinTildes(p)))) ?? null;
    return { ...ev, recomendada: eje };
  });
  // Primero las recomendadas (en el orden de prioridad de las áreas), luego por fecha
  return marcadas.sort(
    (a, b) =>
      Number(b.recomendada !== null) - Number(a.recomendada !== null) ||
      (a.recomendada && b.recomendada ? ejesAMejorar.indexOf(a.recomendada) - ejesAMejorar.indexOf(b.recomendada) : 0) ||
      Date.parse(a.fecha) - Date.parse(b.fecha),
  );
}

/** Áreas a mejorar en orden: brechas abiertas por eje y luego el diagnóstico más bajo. */
export function ejesAMejorar(d: Pick<PortalDatos, "diagnosticos" | "brechas">): Eje[] {
  const deBrechas = d.brechas.filter((b) => !b.cerrada_en && b.eje_diagnostico).map((b) => b.eje_diagnostico as Eje);
  const delDiagnostico = leerDiagnostico(d.diagnosticos)?.mejoras.map((m) => m.eje) ?? [];
  return [...new Set([...deBrechas, ...delDiagnostico])];
}

// ---------------------------------------------------------------------
// Compromisos y alertas
// ---------------------------------------------------------------------
export function compromisosPendientes(planes: PlanPortal[]) {
  return planes
    .flatMap((p) => p.compromisos.filter((c) => c.estado === "Pendiente" || c.estado === "En curso").map((c) => ({ ...c, plan: p.titulo, idPlan: p.id })))
    .sort((a, b) => Number(b.vencido) - Number(a.vencido) || (a.fecha_limite ?? "9999").localeCompare(b.fecha_limite ?? "9999"));
}

export type Alerta = { clave: string; tono: "rojo" | "ambar" | "azul" | "violeta"; titulo: string; valor: number; href: string; accion: string };

export function alertasPortal(d: PortalDatos): Alerta[] {
  const pendientes = compromisosPendientes(d.planes);
  const vencidos = pendientes.filter((c) => c.vencido).length;
  const invitaciones = d.mis_eventos.filter((e) => e.estado === "pendiente").length;
  const proximos7 = pendientes.filter((c) => {
    if (c.vencido || !c.fecha_limite) return false;
    const dias = (Date.parse(`${c.fecha_limite}T00:00:00-05:00`) - Date.now()) / 86_400_000;
    return dias <= 7;
  }).length;
  const estimados = d.empresa.datos_estimados.length;
  const alertas: Alerta[] = [
    { clave: "vencidos", tono: "rojo", titulo: "Compromisos vencidos", valor: vencidos, href: "/planes?vista=vencidos", accion: "Ver compromisos" },
    { clave: "semana", tono: "ambar", titulo: "Vencen en 7 días", valor: proximos7, href: "/planes", accion: "Ver compromisos" },
    { clave: "invitaciones", tono: "azul", titulo: "Invitaciones sin responder", valor: invitaciones, href: "/eventos", accion: "Responder" },
    { clave: "datos", tono: "violeta", titulo: "Datos por confirmar", valor: estimados, href: "/mi-empresa", accion: "Confirmar datos" },
  ];
  return alertas.filter((a) => a.valor > 0);
}
