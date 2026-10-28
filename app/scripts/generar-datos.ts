// Genera datos de demostración coherentes con las cifras reales del CDE 2026:
//   - supabase/seed.sql            → base "limpia" para la demo
//   - data/demo/base_cde_sucia.csv → export "sucio" (duplicados, NIT mal escritos,
//                                    campos vacíos) para mostrar el importador en vivo
// Uso: node scripts/generar-datos.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { calcularDV } from "../src/lib/nit.ts";

let semilla = 20261028;
const rnd = () => ((semilla = (semilla * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const elegir = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const entero = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const ponderado = <T,>(pares: [T, number][]): T => {
  let r = rnd() * pares.reduce((s, [, p]) => s + p, 0);
  for (const [v, p] of pares) if ((r -= p) <= 0) return v;
  return pares[pares.length - 1][0];
};
const q = (v: unknown): string =>
  v === null || v === undefined ? "null" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
let contadorUuid = 0;
const uuid = (prefijo: string) => {
  const n = (++contadorUuid).toString(16).padStart(12, "0");
  return `${prefijo.padEnd(8, "0").slice(0, 8)}-0000-4000-8000-${n}`;
};

// Distribución real reportada por el CDE (sobre empresas con sector registrado)
const SECTORES: [string, number][] = [
  ["Alimentos", 28], ["Comercio", 20], ["Servicios", 14], ["Manufactura e Industrial", 11], ["Turismo", 7],
  ["Tecnología", 4], ["Moda y Textil", 3], ["Salud y Bienestar", 3], ["Educación", 2], ["Agroindustria", 2],
  ["Construcción", 1], ["Belleza y Cuidado Personal", 1], ["Arte y Cultura", 1], ["Transporte y Logística", 1],
  ["Ambiental", 1], ["Financiero", 0.5], ["Comunicaciones", 0.5],
];
const MUNICIPIOS: [string, number, number, number][] = [
  ["Bucaramanga", 7.1193, -73.1227, 55], ["Floridablanca", 7.0647, -73.0896, 15], ["Girón", 7.0731, -73.1689, 9],
  ["Piedecuesta", 6.9877, -73.0498, 9], ["Barrancabermeja", 7.0653, -73.8547, 4], ["San Gil", 6.555, -73.134, 3],
  ["Socorro", 6.4682, -73.26, 2], ["Lebrija", 7.1131, -73.2178, 1], ["Barichara", 6.6353, -73.2231, 1], ["Málaga", 6.6982, -72.7322, 1],
];
const DIMENSIONES = ["Estrategia", "Mercadeo y ventas", "Finanzas", "Operaciones", "Talento humano", "Transformación digital", "Formalización y legal"];
const NOMBRES = ["Laura", "Andrés", "Camila", "Juan", "Valentina", "Santiago", "María", "Carlos", "Daniela", "Felipe", "Paula", "Sebastián", "Natalia", "Diego", "Sofía", "Julián", "Manuela", "Miguel", "Isabella", "Jorge"];
const APELLIDOS = ["Rueda", "Gómez", "Pinzón", "Serrano", "Ardila", "Mantilla", "Cadena", "Rincón", "Quintero", "Ortiz", "Prada", "Villamizar", "Díaz", "Suárez", "Duarte", "Becerra", "Plata", "Navas"];
const PREFIJOS: Record<string, string[]> = {
  Alimentos: ["Panadería", "Café", "Arepas", "Dulces", "Hormigas Culonas", "Postres", "Restaurante", "Salsas"],
  Comercio: ["Distribuidora", "Tienda", "Almacén", "Comercializadora", "Variedades"],
  Servicios: ["Consultores", "Soluciones", "Agencia", "Asesorías", "Estudio"],
  "Manufactura e Industrial": ["Metalmecánica", "Calzado", "Muebles", "Empaques", "Industrias"],
  Turismo: ["Ecotours", "Hostal", "Aventura", "Viajes", "Glamping"],
};
const NUCLEOS = ["El Trigal", "Chicamocha", "La Abuela", "Santander", "Los Andes", "Guane", "La Ceiba", "Bonanza", "Mesa de los Santos", "El Cacao", "Oriente", "Sol Naciente", "Tierra Brava", "La Cascada", "Cabecera", "Río de Oro", "La Pradera", "El Roble", "Altamira", "San Pío"];
const AREAS = ["Mercadeo", "Finanzas", "Operaciones", "Formalización", "Transformación digital", "Talento humano"];
const ASIGNATURAS: Record<string, string> = {
  Mercadeo: "Gerencia de Mercadeo", Finanzas: "Finanzas Corporativas", Operaciones: "Gestión de Operaciones",
  Formalización: "Derecho Comercial", "Transformación digital": "Sistemas de Información", "Talento humano": "Gestión Humana",
};
const DOCENTES = ["Dra. Patricia León", "Mg. Ricardo Hernández", "Mg. Adriana Uribe", "Dr. Fernando Castro", "Mg. Lucía Méndez"];

const N_EMPRESAS = 180;
const sql: string[] = ["-- Generado por scripts/generar-datos.ts · datos ficticios coherentes con las cifras del CDE 2026", "begin;"];

sql.push(`insert into sectores (nombre) values ${SECTORES.map(([s]) => `(${q(s)})`).join(", ")};`);
sql.push(`insert into municipios (nombre, lat, lng) values ${MUNICIPIOS.map(([n, la, ln]) => `(${q(n)}, ${la}, ${ln})`).join(", ")};`);
sql.push(`insert into dimensiones_madurez (nombre) values ${DIMENSIONES.map((d) => `(${q(d)})`).join(", ")};`);

type Empresa = { id: string; nombre: string; nit: string | null; sector: string; contacto: { nombre: string; correo: string; telefono: string; documento: string } };
const empresas: Empresa[] = [];
const personas: string[] = [];
const usados = new Set<string>();

for (let i = 0; i < N_EMPRESAS; i++) {
  const sector = ponderado(SECTORES);
  let nombre: string;
  do nombre = `${elegir(PREFIJOS[sector] ?? ["Emprendimiento", "Negocios", "Grupo"])} ${elegir(NUCLEOS)}`;
  while (usados.has(nombre));
  usados.add(nombre);
  const formalizacion = ponderado<"formal" | "en_proceso" | "informal">([["formal", 55], ["en_proceso", 15], ["informal", 30]]);
  const nit = formalizacion === "formal" ? String(entero(900100000, 901899999)) : null;
  const tamano = ponderado([["micro", 78], ["pequena", 16], ["mediana", 5], ["grande", 1]]);
  const ingresos = { micro: entero(8, 400), pequena: entero(400, 3000), mediana: entero(3000, 20000), grande: entero(20000, 90000) }[tamano] * 1e6;
  const [muni] = ponderado(MUNICIPIOS.map((m) => [m, m[3]] as [typeof m, number]));
  const vinculo = ponderado([["estudiante", 18], ["graduado", 15], ["colaborador", 4], ["externo", 63]]);
  // Como en la base real: solo ~36% tiene sector y ~37% tamaño registrados (aquí algo más, ya depurada en parte)
  const conSector = rnd() < 0.65;
  const conTamano = rnd() < 0.7;
  const id = uuid("e");
  const pid = uuid("9");
  const nom = `${elegir(NOMBRES)} ${elegir(APELLIDOS)} ${elegir(APELLIDOS)}`;
  const correo = `${nom.split(" ")[0].toLowerCase()}.${i}@${nombre.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "").slice(0, 14)}.co`;
  const telefono = `3${entero(0, 2)}${entero(10000000, 99999999)}`;
  const documento = String(entero(1090000000, 1099999999));
  empresas.push({ id, nombre, nit, sector, contacto: { nombre: nom, correo, telefono, documento } });
  personas.push(pid);
  sql.push(
    `insert into empresas (id, nombre, nit, nit_dv, tipo_negocio, sector_id, tamano, ingresos_anuales, formalizacion, municipio_id) values (` +
      [q(id), q(nombre), q(nit), nit ? calcularDV(nit) : "null", q(conSector ? sector : null),
        conSector ? `(select id from sectores where nombre=${q(sector)})` : "null", q(conTamano ? tamano : null), rnd() < 0.6 ? ingresos : "null", q(formalizacion), `(select id from municipios where nombre=${q(muni)})`].join(", ") + ");",
    `insert into personas (id, nombre, documento, correo, telefono, vinculo, acepta_tratamiento_datos, acepta_tratamiento_en) values (` +
      [q(pid), q(nom), q(documento), q(correo), q(telefono), q(vinculo), "true", "now()"].join(", ") + ");",
    `insert into empresa_personas (empresa_id, persona_id) values (${q(id)}, ${q(pid)});`,
  );

  // Diagnóstico 2026-1 y, para ~60%, seguimiento 2026-2 (evolución en el tiempo)
  const base = DIMENSIONES.map(() => entero(15, 70));
  for (const [semestre, mejora, fecha] of [["2026-1", 0, "2026-03-15"], ["2026-2", entero(5, 20), "2026-09-20"]] as const) {
    if (semestre === "2026-2" && rnd() > 0.6) continue;
    const did = uuid("d");
    const puntajes = base.map((b) => Math.min(100, b + mejora + entero(-3, 6)));
    const total = puntajes.reduce((a, b) => a + b, 0) / puntajes.length;
    const nivel = total >= 75 ? "Escalable" : total >= 55 ? "Consolidado" : total >= 35 ? "En desarrollo" : "Naciente";
    sql.push(
      `insert into diagnosticos (id, empresa_id, fecha, semestre, puntaje_total, nivel) values (${q(did)}, ${q(id)}, ${q(fecha)}, ${q(semestre)}, ${total.toFixed(2)}, ${q(nivel)});`,
      `insert into diagnostico_puntajes (diagnostico_id, dimension_id, puntaje) values ${puntajes
        .map((p, k) => `(${q(did)}, (select id from dimensiones_madurez where nombre=${q(DIMENSIONES[k])}), ${p})`).join(", ")};`,
    );
  }

  // Proyectos de aula (algunos integradores: varias asignaturas sobre la misma empresa)
  const nProy = ponderado([[0, 45], [1, 35], [2, 15], [3, 5]]);
  for (let k = 0; k < nProy; k++) {
    const area = elegir(AREAS);
    const semestre = elegir(["2025-2", "2026-1", "2026-2"]);
    const estado = semestre === "2026-2" ? "en_progreso" : "completado";
    const prid = uuid("a");
    sql.push(
      `insert into proyectos_aula (id, empresa_id, asignatura, docente_nombre, area_intervenida, semestre, estado, es_integrador, resultados) values (` +
        [q(prid), q(id), q(ASIGNATURAS[area]), q(elegir(DOCENTES)), q(area), q(semestre), q(estado), nProy > 1 ? "true" : "false",
          q(estado === "completado" ? `Entregable de ${area.toLowerCase()} implementado` : null)].join(", ") + ");",
    );
    // Plan de acción derivado con compromisos
    const plid = uuid("b");
    sql.push(`insert into planes_accion (id, empresa_id, origen_proyecto_id, titulo) values (${q(plid)}, ${q(id)}, ${q(prid)}, ${q(`Plan de ${area.toLowerCase()} ${semestre}`)});`);
    for (let c = 0; c < entero(2, 4); c++) {
      const avance = elegir([0, 25, 50, 75, 100]);
      const fl = `2026-${String(entero(8, 12)).padStart(2, "0")}-${String(entero(1, 28)).padStart(2, "0")}`;
      const estadoC = avance === 100 ? "completado" : fl < "2026-10-28" && avance < 100 ? "vencido" : avance > 0 ? "en_progreso" : "pendiente";
      sql.push(
        `insert into compromisos (plan_id, descripcion, responsable, fecha_limite, avance, estado) values (` +
          [q(plid), q(elegir([`Implementar acción de ${area.toLowerCase()}`, "Actualizar registro mercantil", "Publicar catálogo digital", "Construir flujo de caja mensual", "Definir precio por costeo", "Abrir cuenta en Instagram Business"])),
            q(elegir([nom, "Equipo consultor", "Asesor CDE"])), q(fl), avance, q(estadoC)].join(", ") + ");",
      );
    }
  }

  // Citas / asesorías
  for (let k = 0; k < ponderado([[0, 50], [1, 35], [2, 15]]); k++) {
    const futura = rnd() < 0.25;
    const dia = futura ? entero(29, 31) : entero(1, 27);
    const mes = futura ? "10" : String(entero(2, 10)).padStart(2, "0");
    sql.push(
      `insert into citas (empresa_id, persona_id, motivo, estado, inicio, fin, notas_atencion) values (` +
        [q(id), q(pid), q(elegir(["Asesoría en formalización", "Revisión de plan de negocio", "Estrategia de redes sociales", "Acceso a financiación", "Costeo y precios"])),
          q(futura ? "agendada" : ponderado([["atendida", 80], ["no_asistio", 12], ["cancelada", 8]])),
          q(`2026-${mes}-${String(dia).padStart(2, "0")} ${entero(8, 16)}:00:00-05`), q(`2026-${mes}-${String(dia).padStart(2, "0")} ${entero(17, 18)}:00:00-05`),
          q(futura ? null : "Se definieron próximos pasos")].join(", ") + ");",
    );
  }
}

// Eventos y capacitaciones con inscritos vs. asistentes
const EVENTOS: [string, string, string, string, number][] = [
  ["Marketing digital para emprendedores", "capacitacion", "Mercadeo y ventas", "2026-08-12 18:00:00-05", 60],
  ["Formalízate: Cámara de Comercio y RUT", "capacitacion", "Formalización y legal", "2026-08-26 18:00:00-05", 40],
  ["Finanzas para no financieros", "capacitacion", "Finanzas", "2026-09-09 18:00:00-05", 50],
  ["Networking sector Alimentos", "networking", "Mercadeo y ventas", "2026-09-23 17:00:00-05", 80],
  ["Conversatorio: Turismo sostenible en Santander", "conversatorio", "Estrategia", "2026-10-07 16:00:00-05", 60],
  ["Ruta de Acompañamiento: Pitch day", "ruta", "Estrategia", "2026-10-21 15:00:00-05", 40],
  ["IA para tu negocio", "capacitacion", "Transformación digital", "2026-11-04 18:00:00-05", 70],
  ["Feria de emprendimiento UNAB", "evento", "Mercadeo y ventas", "2026-11-18 09:00:00-05", 120],
];
for (const [titulo, tipo, tema, inicio, cupo] of EVENTOS) {
  const eid = uuid("f");
  const pasado = inicio < "2026-10-28";
  sql.push(`insert into eventos (id, titulo, tipo, tema, inicio, lugar, cupo) values (${q(eid)}, ${q(titulo)}, ${q(tipo)}, ${q(tema)}, ${q(inicio)}, 'Campus El Jardín, UNAB', ${cupo});`);
  const inscritos = [...empresas.keys()].sort(() => rnd() - 0.5).slice(0, entero(Math.floor(cupo * 0.5), cupo));
  for (const k of inscritos) {
    const asistio = pasado && rnd() < 0.62;
    sql.push(
      `insert into inscripciones (evento_id, persona_id, empresa_id, inscrito_en, asistio_en) values (${q(eid)}, ${q(personas[k])}, ${q(empresas[k].id)}, ${q(`${inicio.slice(0, 10)} 08:00:00-05`)}::timestamptz - interval '7 days', ${asistio ? q(inicio) : "null"});`,
    );
    if (asistio) sql.push(`insert into puntos_movimientos (persona_id, puntos, motivo) values (${q(personas[k])}, 50, 'asistencia');`);
  }
}

// Gamificación
const CURSOS: [string, string, string, [string, string[], number][]][] = [
  ["¿Por qué formalizar tu negocio?", "Formalización y legal", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", [
    ["¿Qué documento expide la DIAN para identificar tributariamente a tu empresa?", ["RUT", "Cédula", "Matrícula mercantil"], 0],
    ["¿Dónde se renueva la matrícula mercantil?", ["Alcaldía", "Cámara de Comercio", "DIAN"], 1],
  ]],
  ["Costea tu producto en 10 minutos", "Finanzas", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", [
    ["El precio debe cubrir como mínimo…", ["Solo la materia prima", "Costos fijos + variables", "Lo que cobra la competencia"], 1],
  ]],
  ["Instagram para vender", "Mercadeo y ventas", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", [
    ["¿Qué tipo de cuenta da acceso a estadísticas?", ["Personal", "Profesional/Empresa", "Privada"], 1],
  ]],
];
CURSOS.forEach(([titulo, tema, url, preguntas], i) => {
  const mid = uuid("c");
  sql.push(`insert into microcursos (id, titulo, tema, video_url, puntos, orden) values (${q(mid)}, ${q(titulo)}, ${q(tema)}, ${q(url)}, 100, ${i});`);
  for (const [enunciado, opciones, correcta] of preguntas)
    sql.push(`insert into preguntas_quiz (microcurso_id, enunciado, opciones, correcta) values (${q(mid)}, ${q(enunciado)}, ${q(JSON.stringify(opciones))}::jsonb, ${correcta});`);
});
sql.push(
  `insert into insignias (codigo, nombre, descripcion, icono) values
  ('primer_paso', 'Primer paso', 'Completaste tu perfil empresarial', '🌱'),
  ('formal', 'Empresa formal', 'Terminaste la ruta de formalización', '📜'),
  ('asistente', 'Siempre presente', 'Asististe a 3 eventos del CDE', '🎟️'),
  ('cumplidor', 'Cumplidor', 'Completaste 5 compromisos de tu plan de acción', '✅'),
  ('aprendiz', 'Aprendiz', 'Terminaste 3 microcursos', '🎓');`,
  `insert into recompensas (nombre, costo_puntos) values
  ('Certificado digital CDE', 200), ('Prioridad en agenda de asesorías', 400),
  ('Mentoría 1:1 con experto', 700), ('Stand gratuito en Feria de emprendimiento', 1200);`,
  `insert into puntos_movimientos (persona_id, puntos, motivo) select id, 100, 'perfil' from personas;`,
  "commit;",
);

mkdirSync("supabase", { recursive: true });
writeFileSync("supabase/seed.sql", sql.join("\n") + "\n");

// ---------- Export "sucio" para el importador ----------
const sucio: string[][] = [["Nombre empresa", "NIT", "Emprendedor", "Correo", "Celular", "Sector", "Tamaño", "Municipio"]];
const variar = (n: string) => elegir([n.toUpperCase(), `${n} S.A.S.`, n.normalize("NFD").replace(/[̀-ͯ]/g, ""), `${n} sas`, n.toLowerCase(), `  ${n} `]);
const nitSucio = (nit: string) => elegir([`${nit.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${calcularDV(nit)}`, `${nit}-${calcularDV(nit)}`, nit, `${nit} ${calcularDV(nit)}`]);
for (const e of empresas.slice(0, 25)) {
  sucio.push([variar(e.nombre), e.nit ? nitSucio(e.nit) : "", e.contacto.nombre, rnd() < 0.5 ? e.contacto.correo.toUpperCase() : e.contacto.correo, rnd() < 0.5 ? `+57 ${e.contacto.telefono}` : e.contacto.telefono, rnd() < 0.36 ? e.sector : "", "", ""]);
}
for (let i = 0; i < 35; i++) {
  const sector = ponderado(SECTORES);
  const nombre = `${elegir(PREFIJOS[sector] ?? ["Emprendimiento"])} ${elegir(["Nueva Esperanza", "Las Palmas", "Cañaveral", "Provenza", "El Bosque", "Morrorico", "Lagos", "Ruitoque"])} ${i}`;
  const nit = rnd() < 0.5 ? String(entero(900100000, 901899999)) : "";
  const fila = [nombre, nit ? nitSucio(nit) : "", `${elegir(NOMBRES)} ${elegir(APELLIDOS)}`, `contacto${i}@correo.com`, `3${entero(10, 29)}${entero(1000000, 9999999)}`, rnd() < 0.36 ? sector : "", rnd() < 0.37 ? elegir(["Micro", "Pequeña", "Mediana"]) : "", elegir(["Bucaramanga", "B/manga", "Floridablanca", "Florida", "Girón", "Piedecuesta"])];
  sucio.push(fila);
  if (i % 7 === 0) sucio.push([variar(nombre), fila[1], fila[2], fila[3].toUpperCase(), fila[4], "", "", fila[7]]); // duplicado interno
}
// Un NIT con DV incorrecto, para mostrar la validación
sucio.push(["Comercializadora Error Típico", "900.123.456-0", "Pedro Pérez", "pedro@error.co", "3001112233", "Comercio", "Micro", "Bucaramanga"]);
mkdirSync("data/demo", { recursive: true });
writeFileSync("data/demo/base_cde_sucia.csv", sucio.map((f) => f.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n") + "\n");

console.log(`seed.sql: ${N_EMPRESAS} empresas · base_cde_sucia.csv: ${sucio.length - 1} filas`);
