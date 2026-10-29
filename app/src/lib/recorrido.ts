import type { RutaModulo } from "@/lib/navegacion";
import type { Enums } from "@/lib/supabase/database.types";

// Recorrido guiado por la mascota. Cada rol ve solo lo que puede hacer
// (los permisos reales los aplica RLS; esto solo explica la interfaz).

export const NOMBRE_MASCOTA = "Banu";

// Cambiar la versión hace que todos vuelvan a ver el recorrido al entrar.
export const VERSION_RECORRIDO = 2;

export type SpriteRecorrido =
  | "bienvenido"
  | "instrucciones"
  | "buscando-datos"
  | "subir-archivo"
  | "lista-verificacion"
  | "citas"
  | "estadisticas"
  | "consultando-ia"
  | "puntos-ganados"
  | "nueva-insignia"
  | "revisando-cuenta"
  | "pensando-estrategia"
  | "necesitas-ayuda"
  | "hasta-pronto";

export type PasoRecorrido = {
  id: string;
  titulo: string;
  texto: string;
  sprite: SpriteRecorrido;
  /** Página a la que lleva el búho en este paso (un módulo o una subpágina, p. ej. /planes/nuevo). */
  ruta?: RutaModulo | `${RutaModulo}/${string}`;
  /** Elemento a resaltar (atributo data-recorrido). Sin él se resalta el enlace del menú de la ruta. */
  objetivo?: string;
  /** El módulo aún muestra "Próximamente". */
  proximamente?: boolean;
};

type Rol = Enums<"rol_usuario">;

export const rutaSprite = (s: SpriteRecorrido) => `/buho/buho-${s}.png`;

// ---------------------------------------------------------------------
// Pasos reutilizables
// ---------------------------------------------------------------------

const menu: PasoRecorrido = {
  id: "menu",
  titulo: "Tu menú",
  texto:
    "Desde este menú llegas a cada módulo. Abajo ves tu nombre y tu rol: lo que muestra cada pantalla depende de ese rol.",
  sprite: "instrucciones",
  ruta: "/",
  objetivo: "menu",
};

const eventos = (texto: string): PasoRecorrido => ({
  id: "eventos",
  titulo: "Eventos",
  texto,
  sprite: "puntos-ganados",
  ruta: "/eventos",
  objetivo: "eventos-calendario",
});

const formacion = (texto: string): PasoRecorrido => ({
  id: "formacion",
  titulo: "Formación y recompensas",
  texto,
  sprite: "nueva-insignia",
  ruta: "/formacion",
  objetivo: "formacion-progreso",
});

const ayuda: PasoRecorrido = {
  id: "ayuda",
  titulo: "¿Me necesitas otra vez?",
  texto: `Toca este botón cuando quieras: repito el recorrido o te explico cómo ganar puntos. Y al terminar este recorrido ganas tus primeros 20 puntos.`,
  sprite: "necesitas-ayuda",
  objetivo: "boton-ayuda",
};

const despedida = (texto: string): PasoRecorrido => ({
  id: "fin",
  titulo: "¡Listo para empezar!",
  texto,
  sprite: "hasta-pronto",
  ruta: "/",
});

// ---------------------------------------------------------------------
// Equipo del CDE (Admin CDE y Miembro CDE)
// ---------------------------------------------------------------------

const pasosCde = (esAdmin: boolean): PasoRecorrido[] => [
  menu,
  {
    id: "empresas",
    titulo: "Empresas · Ficha 360°",
    texto:
      "Busca cualquier empresa por nombre o NIT y filtra por sector o tamaño. Su ficha reúne diagnóstico de madurez, planes y toda la línea de tiempo del acompañamiento.",
    sprite: "buscando-datos",
    ruta: "/empresas",
    objetivo: "empresas-buscador",
  },
  {
    id: "importar",
    titulo: "Importar y depurar",
    texto:
      "Sube el Excel o CSV del CDE. Reviso cada NIT con su dígito de verificación y te muestro los posibles duplicados antes de guardar, para que la base quede limpia.",
    sprite: "subir-archivo",
    ruta: "/importar",
    objetivo: "importar-archivo",
  },
  {
    id: "planes",
    titulo: "Planes de acción",
    texto:
      "Crea planes con compromisos, responsable, fecha y avance. Los compromisos vencidos se marcan solos y estos indicadores te dicen dónde poner atención.",
    sprite: "lista-verificacion",
    ruta: "/planes",
    objetivo: "planes-indicadores",
  },
  {
    id: "contactos",
    titulo: "Mis contactos",
    texto: "Todos los participantes del CDE por rol: docentes con sus asignaturas, emprendedores con su empresa y estudiantes.",
    sprite: "citas",
    ruta: "/contactos",
  },
  eventos("Publica eventos, capacitaciones y networking en el calendario, invita a la comunidad y mira quién confirmó su asistencia."),
  formacion(
    "Tu nivel y tus puntos. En «Aportes por validar» y «Gestión del CDE» validas aportes, entregas canjes, otorgas insignias y ajustas puntos.",
  ),
  {
    id: "conocimiento",
    titulo: "Conocimiento",
    texto:
      "Un tablero con las empresas por sector, tamaño y municipio, la calidad de los datos y las brechas del diagnóstico. Sin consolidar nada a mano.",
    sprite: "estadisticas",
    ruta: "/conocimiento",
  },
  {
    id: "asistente",
    titulo: "Asistente IA",
    texto:
      "Pregúntale a tus datos en español, por ejemplo: «¿Cuáles son las mayores brechas del sector Alimentos?». Solo lee la base y te muestra cómo calculó cada cifra.",
    sprite: "consultando-ia",
    ruta: "/asistente",
    objetivo: "asistente-pregunta",
  },
  {
    id: "portal",
    titulo: "Portal del emprendedor",
    texto: "Así verá el emprendedor su etapa, sus compromisos y la oferta del CDE que le conviene.",
    sprite: "revisando-cuenta",
    ruta: "/portal",
    proximamente: true,
  },
  ayuda,
  despedida(
    esAdmin
      ? "Como Admin CDE tienes todos los permisos del equipo y eres quien asigna los roles de los usuarios. ¡A transformar datos en conocimiento!"
      : "Ya conoces todos los módulos del equipo del CDE. ¡A transformar datos en conocimiento!",
  ),
];

// ---------------------------------------------------------------------
// Academia (Docente y Estudiante)
// ---------------------------------------------------------------------

const pasosDocente: PasoRecorrido[] = [
  menu,
  {
    id: "empresas",
    titulo: "Empresas de tus proyectos",
    texto:
      "Aquí aparecen las empresas de tus proyectos de aula. Abre su ficha para ver el diagnóstico de madurez: te dice en qué áreas enfocar la intervención con tus estudiantes.",
    sprite: "pensando-estrategia",
    ruta: "/empresas",
    objetivo: "empresas-buscador",
  },
  {
    id: "contactos",
    titulo: "Tus asignaturas y empresas",
    texto:
      "En Mis contactos registras tus asignaturas, inscribes a tus estudiantes, vinculas la empresa de cada asignatura y asignas quién trabaja con cada una. Todos reciben un aviso.",
    sprite: "citas",
    ruta: "/contactos",
  },
  {
    id: "planes",
    titulo: "Planes de acción",
    texto:
      "Crea planes de acción para las empresas de tus asignaturas, asigna a tus estudiantes y reparte los compromisos. Reporta los avances: la empresa los ve al instante.",
    sprite: "lista-verificacion",
    ruta: "/planes",
    objetivo: "planes-filtros",
  },
  eventos("Crea conversatorios y citas, invita a tus estudiantes y a las empresas, y mira quién confirmó."),
  formacion(
    "Valida los aportes de tus estudiantes en «Aportes por validar»: cada aporte validado les suma puntos. Tú también ganas puntos e insignias en los eventos.",
  ),
  ayuda,
  despedida("Ya sabes dónde seguir tus proyectos de aula. ¡Éxitos con tus estudiantes!"),
];

const pasosEstudiante: PasoRecorrido[] = [
  menu,
  {
    id: "empresas",
    titulo: "Empresas de tus proyectos",
    texto:
      "Encuentra la empresa con la que trabajas en tu asignatura. En su ficha está el diagnóstico de madurez: ahí ves qué necesita mejorar.",
    sprite: "buscando-datos",
    ruta: "/empresas",
    objetivo: "empresas-buscador",
  },
  {
    id: "contactos",
    titulo: "Tus proyectos",
    texto: "En Mis contactos ves con qué empresa trabajas en cada asignatura, a tus docentes y a tu equipo.",
    sprite: "citas",
    ruta: "/contactos",
  },
  {
    id: "planes",
    titulo: "Tus compromisos",
    texto:
      "Usa el filtro «Solo donde soy responsable» para ver solo lo que te toca. Actualiza tu avance para que el docente y el CDE sepan cómo vas.",
    sprite: "lista-verificacion",
    ruta: "/planes",
    objetivo: "planes-filtros",
  },
  eventos("Inscríbete en eventos y capacitaciones, y agenda citas o sesiones de coworking con tu equipo."),
  formacion(
    "Registra tus aportes al proyecto: cuando tu docente los valida ganas puntos, subes de nivel y desbloqueas insignias. ¡Entra al ranking!",
  ),
  ayuda,
  despedida("¡Todo listo! Cumple tus compromisos y acumula puntos en el camino."),
];

// ---------------------------------------------------------------------
// Emprendedor
// ---------------------------------------------------------------------

const pasosEmprendedor: PasoRecorrido[] = [
  menu,
  {
    id: "portal",
    titulo: "Tu portal",
    texto: "Aquí verás en qué etapa de la ruta de acompañamiento estás, tus compromisos pendientes y los eventos que te convienen.",
    sprite: "revisando-cuenta",
    ruta: "/portal",
    proximamente: true,
  },
  {
    id: "empresas",
    titulo: "Tu empresa",
    texto:
      "Abre la ficha de tu empresa: verás tu diagnóstico de madurez y toda la historia de tu acompañamiento con el CDE.",
    sprite: "buscando-datos",
    ruta: "/empresas",
    objetivo: "empresas-buscador",
  },
  {
    id: "mi-empresa",
    titulo: "Actualiza los datos de tu empresa",
    texto:
      "Revisa tu sector, tamaño, municipio y lo que vendes. Si el CDE marcó algún dato como estimado, confírmalo aquí: así te recomendamos lo que de verdad te sirve.",
    sprite: "subir-archivo",
    ruta: "/mi-empresa",
  },
  {
    id: "planes",
    titulo: "Tu plan de acción",
    texto:
      "Estos son los compromisos que acordaste con el CDE. Revisa las fechas y reporta tu avance para no dejar nada vencido.",
    sprite: "lista-verificacion",
    ruta: "/planes",
    objetivo: "planes-indicadores",
  },
  {
    id: "contactos",
    titulo: "Mis contactos",
    texto: "Aquí ves al docente a cargo del proyecto de tu empresa, al equipo de estudiantes y a tu mentor del CDE.",
    sprite: "citas",
    ruta: "/contactos",
  },
  eventos("Inscríbete en capacitaciones y networking, agenda citas con el CDE y responde las invitaciones que te lleguen."),
  formacion(
    "Gana puntos en capacitaciones y eventos, sube de nivel, colecciona insignias y canjéalas por mentorías o un día de coworking.",
  ),
  ayuda,
  despedida("¡Bienvenido a la ruta del CDE! Cada paso que das suma puntos."),
];

// ---------------------------------------------------------------------

const BIENVENIDA: Record<Rol, string> = {
  admin_cde: "Como Admin CDE gestionas todo el sistema. Te muestro cada módulo en menos de un minuto.",
  cde: "Como miembro del CDE acompañas empresas, depuras la base y haces seguimiento a los planes. Te muestro cómo.",
  docente: "Como docente acompañas empresas desde tus proyectos de aula. Te muestro dónde seguirlas.",
  estudiante: "Como estudiante trabajas con una empresa real en tu asignatura. Te muestro dónde está todo.",
  emprendedor: "El CDE te acompaña a hacer crecer tu empresa. Te muestro todo lo que puedes hacer aquí.",
};

/** Pasos del recorrido para un rol, con el saludo personalizado. */
export function pasosRecorrido(rol: Rol, nombre: string): PasoRecorrido[] {
  const primerNombre = nombre.includes("@") ? "" : nombre.trim().split(/\s+/)[0];
  const bienvenida: PasoRecorrido = {
    id: "bienvenida",
    titulo: primerNombre ? `¡Hola, ${primerNombre}! Soy ${NOMBRE_MASCOTA}` : `¡Hola! Soy ${NOMBRE_MASCOTA}`,
    texto: `${BIENVENIDA[rol]} Puedes saltar el recorrido cuando quieras.`,
    sprite: "bienvenido",
    ruta: "/",
  };
  const pasos = {
    admin_cde: pasosCde(true),
    cde: pasosCde(false),
    docente: pasosDocente,
    estudiante: pasosEstudiante,
    emprendedor: pasosEmprendedor,
  }[rol];
  return [bienvenida, ...pasos];
}

/** Llave de localStorage: el recorrido se muestra solo la primera vez por usuario y versión. */
export const llaveRecorrido = (idUsuario: string) => `cde-recorrido:v${VERSION_RECORRIDO}:${idUsuario}`;

// ---------------------------------------------------------------------
// Tutoriales paso a paso (se abren desde «Tutoriales y capacitaciones» del inicio con ?tutorial=<id>)
// ---------------------------------------------------------------------

export type Tutorial = {
  titulo: string;
  /** Texto de la tarjeta en el inicio */
  resumen: string;
  /** Página donde arranca (el enlace de la tarjeta) */
  inicio: string;
  /** Roles que lo ven en el inicio */
  roles: readonly Rol[];
  pasos: PasoRecorrido[];
};

const TODOS: readonly Rol[] = ["admin_cde", "cde", "docente", "estudiante", "emprendedor"];
const CDE: readonly Rol[] = ["admin_cde", "cde"];

const fin = (texto: string): PasoRecorrido => ({ id: "fin", titulo: "¡Eso es todo!", texto, sprite: "hasta-pronto" });

export const TUTORIALES = {
  "agendar-cita": {
    titulo: "Agendar una cita",
    resumen: "Elige la hora, invita y recibe la confirmación",
    inicio: "/eventos",
    roles: TODOS,
    pasos: [
      { id: "cal-1", titulo: "Tu calendario", texto: `Este es el calendario del CDE. Te muestro, paso a paso, cómo agendar una cita.`, sprite: "citas", ruta: "/eventos", objetivo: "eventos-calendario" },
      { id: "cal-2", titulo: "1. Pulsa «Crear actividad»", texto: "También puedes arrastrar sobre el calendario, en la vista Semana, para elegir el horario directamente.", sprite: "instrucciones", objetivo: "eventos-crear" },
      { id: "cal-3", titulo: "2. Elige el tipo «Cita»", texto: "Las citas son privadas: solo las ven tú, las personas que invitas y el CDE. Ponle un título, la hora de inicio y de fin, y el lugar o el enlace de Meet o Teams.", sprite: "lista-verificacion", objetivo: "eventos-crear" },
      { id: "cal-4", titulo: "3. Invita y guarda", texto: "Busca a las personas por nombre o rol y márcalas. Cada invitado recibe un aviso en la campana 🔔 y responde Asistiré o No asistiré.", sprite: "instrucciones", objetivo: "eventos-crear" },
      { id: "cal-5", titulo: "4. Sigue las respuestas", texto: "Abre la cita en el calendario para ver quién confirmó. Para moverla, arrástrala a otra hora.", sprite: "revisando-cuenta", objetivo: "eventos-calendario" },
      { id: "cal-6", titulo: "Tus invitaciones", texto: "Cuando alguien te invite, aparece aquí para que respondas en un clic.", sprite: "citas", objetivo: "eventos-invitaciones" },
      fin("Ya sabes agendar citas. ¡Usa el filtro «Solo donde participo» para ver solo las tuyas!"),
    ],
  },
  "inscribirse-evento": {
    titulo: "Inscribirte a un evento",
    resumen: "Encuentra capacitaciones y confirma tu asistencia",
    inicio: "/eventos",
    roles: TODOS,
    pasos: [
      { id: "ins-1", titulo: "Eventos del CDE", texto: "Los eventos, capacitaciones, ferias y networking son públicos: aparecen en el calendario de todos.", sprite: "puntos-ganados", ruta: "/eventos", objetivo: "eventos-calendario" },
      { id: "ins-2", titulo: "1. Filtra lo que te interesa", texto: "Deja marcados solo los tipos que quieres ver, por ejemplo Capacitación y Networking. Cada tipo tiene su color.", sprite: "buscando-datos", objetivo: "eventos-filtros" },
      { id: "ins-3", titulo: "2. Abre el evento", texto: "Toca el evento en el calendario: verás la fecha, el lugar, el cupo y quién lo organiza.", sprite: "instrucciones", objetivo: "eventos-calendario" },
      { id: "ins-4", titulo: "3. Pulsa «Asistiré»", texto: "Quedas inscrito al instante. Si el evento tiene cupo, se descuenta; si cambias de planes, pulsa «No asistiré».", sprite: "lista-verificacion", objetivo: "evento-asistire" },
      fin("¡Listo! Los eventos a los que asistes suman puntos en Formación y recompensas."),
    ],
  },
  "crear-evento": {
    titulo: "Publicar un evento o conversatorio",
    resumen: "Convoca a la comunidad y mira quién confirma",
    inicio: "/eventos",
    roles: ["admin_cde", "cde", "docente"],
    pasos: [
      { id: "ev-1", titulo: "Publica en el calendario", texto: "Los eventos, ferias y capacitaciones del CDE los ve toda la comunidad. Los conversatorios de los docentes son solo para sus invitados.", sprite: "puntos-ganados", ruta: "/eventos", objetivo: "eventos-calendario" },
      { id: "ev-2", titulo: "1. Pulsa «Crear actividad»", texto: "Elige el tipo: Evento, Capacitación, Networking o Conversatorio (según tu rol). Define el cupo si es limitado.", sprite: "instrucciones", objetivo: "eventos-crear" },
      { id: "ev-3", titulo: "2. Invita", texto: "Invita a personas o grupos por rol. En los eventos públicos, además, cualquiera puede inscribirse por su cuenta.", sprite: "citas", objetivo: "eventos-crear" },
      { id: "ev-4", titulo: "3. Revisa las confirmaciones", texto: "En el detalle del evento ves cuántos confirmaron, cuántos están pendientes y quiénes no asistirán.", sprite: "estadisticas", objetivo: "eventos-calendario" },
      fin("¡Tu evento está listo para recibir inscripciones!"),
    ],
  },
  "crear-plan": {
    titulo: "Crear un plan de acción",
    resumen: "Compromisos, responsables, estudiantes y fechas",
    inicio: "/planes/nuevo",
    roles: ["admin_cde", "cde", "docente"],
    pasos: [
      { id: "plan-1", titulo: "1. Elige la empresa", texto: "Si eres docente, aparecen las empresas vinculadas a tus asignaturas (las vinculas en Mis contactos). El área y el título se sugieren con su diagnóstico.", sprite: "pensando-estrategia", ruta: "/planes/nuevo", objetivo: "plan-empresa" },
      { id: "plan-2", titulo: "2. Asigna estudiantes", texto: "Marca los estudiantes que trabajarán en el plan: lo verán, recibirán un aviso y podrán reportar avances. Puedes quitarlos o agregar más después.", sprite: "citas", objetivo: "plan-estudiantes" },
      { id: "plan-3", titulo: "3. Define los compromisos", texto: "Cada compromiso tiene responsable y fecha. Repártelos entre tú y tus estudiantes; los vencidos se marcan solos.", sprite: "lista-verificacion", objetivo: "plan-compromisos" },
      fin("Al crear el plan, la empresa recibe un aviso. Reporta los avances desde Planes de acción."),
    ],
  },
  "planes-estudiante": {
    titulo: "Tus planes y avances",
    resumen: "Reporta lo que avanzas con la empresa",
    inicio: "/planes",
    roles: ["estudiante"],
    pasos: [
      { id: "pe-1", titulo: "Tus planes", texto: "Aquí están los planes de acción en los que tu docente te asignó, con la empresa y sus compromisos.", sprite: "lista-verificacion", ruta: "/planes", objetivo: "planes-indicadores" },
      { id: "pe-2", titulo: "Solo lo tuyo", texto: "Usa «Solo donde soy responsable» para ver los compromisos a tu cargo y actualiza su porcentaje de avance.", sprite: "instrucciones", objetivo: "planes-filtros" },
      fin("En cada plan, «Reportar avance» deja constancia de lo que hicieron. La empresa y tu docente reciben el aviso."),
    ],
  },
  importar: {
    titulo: "Importar y depurar un Excel",
    resumen: "Del archivo del CDE a fichas sin duplicados",
    inicio: "/importar",
    roles: CDE,
    pasos: [
      { id: "imp-1", titulo: "1. Sube el archivo", texto: "Arrastra el Excel o CSV del CDE. Reconozco las columnas aunque tengan nombres distintos (NIT, Razón social, Municipio…).", sprite: "subir-archivo", ruta: "/importar", objetivo: "importar-archivo" },
      { id: "imp-2", titulo: "2. Revisa la validación", texto: "Verifico el NIT con su dígito de verificación, limpio nombres y municipios, y te muestro qué filas tienen errores antes de guardar nada.", sprite: "buscando-datos", objetivo: "importar-archivo" },
      { id: "imp-3", titulo: "3. Fusiona duplicados", texto: "Si una empresa ya existe (mismo NIT o nombre equivalente), propongo fusionarla en una sola ficha en vez de crear otra.", sprite: "lista-verificacion", objetivo: "importar-archivo" },
      fin("Al confirmar, la base queda depurada y el tablero de Conocimiento se actualiza solo."),
    ],
  },
  coworking: {
    titulo: "Entrar al coworking",
    resumen: "Salas con chat y voz para trabajar en equipo",
    inicio: "/coworking",
    roles: TODOS,
    pasos: [
      { id: "cw-1", titulo: "La Sala principal", texto: "Está abierta para toda la comunidad del CDE. Entra, muévete con clics o con las flechas y saluda por el chat.", sprite: "bienvenido", ruta: "/coworking", objetivo: "coworking-principal" },
      { id: "cw-2", titulo: "Crea una sala para tu equipo", texto: "Ponle nombre y, si quieres, una contraseña. Compártela con tu equipo para que entren con «Entrar con contraseña».", sprite: "instrucciones", objetivo: "coworking-crear" },
      { id: "cw-3", titulo: "Habla por voz", texto: "Dentro de la sala pulsa «Entrar a la voz» y permite el micrófono. Oyes más fuerte a quien está cerca de tu personaje, como en una oficina real.", sprite: "citas", objetivo: "coworking-principal" },
      fin("¡Nos vemos en el coworking! Usa audífonos para evitar el eco."),
    ],
  },
  "mis-contactos": {
    titulo: "Vincular empresas y estudiantes",
    resumen: "Asignaturas, empresas y equipos en un solo lugar",
    inicio: "/contactos",
    roles: ["docente"],
    pasos: [
      { id: "mc-1", titulo: "1. Registra tu asignatura", texto: "Escribe el nombre y el semestre. Si la asignatura ya existe, la reutilizo.", sprite: "instrucciones", ruta: "/contactos", objetivo: "contactos-asignatura" },
      { id: "mc-2", titulo: "2. Inscribe a tus estudiantes", texto: "Elige a cada estudiante registrado. Reciben un aviso y te ven en sus contactos.", sprite: "citas", objetivo: "contactos-asignaturas" },
      { id: "mc-3", titulo: "3. Vincula la empresa", texto: "Busca la empresa por nombre o NIT y vincúlala. La empresa y tus estudiantes reciben un aviso.", sprite: "buscando-datos", objetivo: "contactos-asignaturas" },
      { id: "mc-4", titulo: "4. Arma los equipos", texto: "Asigna los estudiantes a cada empresa: cada uno sabe en qué proyecto está en cada asignatura.", sprite: "lista-verificacion", objetivo: "contactos-asignaturas" },
      fin("Con la empresa vinculada ya puedes crearle un plan de acción y asignarle a tus estudiantes."),
    ],
  },
} satisfies Record<string, Tutorial>;

export type IdTutorial = keyof typeof TUTORIALES;

export const esTutorial = (id: string | null): id is IdTutorial => id !== null && Object.hasOwn(TUTORIALES, id);

/** Enlace que abre el tutorial en su página. */
export const enlaceTutorial = (id: IdTutorial) => `${TUTORIALES[id].inicio}?tutorial=${id}`;

/** Tutoriales del inicio para un rol, en orden (Importar es solo del CDE; los demás ven el del coworking). */
export function tutorialesPara(rol: Rol): (Tutorial & { id: IdTutorial })[] {
  const orden: Record<Rol, IdTutorial[]> = {
    admin_cde: ["importar", "crear-plan", "agendar-cita", "crear-evento"],
    cde: ["importar", "crear-plan", "agendar-cita", "crear-evento"],
    docente: ["mis-contactos", "crear-plan", "agendar-cita", "coworking"],
    estudiante: ["coworking", "planes-estudiante", "agendar-cita", "inscribirse-evento"],
    emprendedor: ["coworking", "agendar-cita", "inscribirse-evento"],
  };
  return orden[rol].filter((id) => (TUTORIALES[id].roles as readonly Rol[]).includes(rol)).map((id) => ({ id, ...TUTORIALES[id] }));
}
