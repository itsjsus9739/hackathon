import type { RutaModulo } from "@/lib/navegacion";
import type { Enums } from "@/lib/supabase/database.types";

// Recorrido guiado por la mascota. Cada rol ve solo lo que puede hacer
// (los permisos reales los aplica RLS; esto solo explica la interfaz).

export const NOMBRE_MASCOTA = "Banu";

// Cambiar la versión hace que todos vuelvan a ver el recorrido al entrar.
export const VERSION_RECORRIDO = 1;

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
  /** Página a la que lleva el búho en este paso. */
  ruta?: RutaModulo;
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
  proximamente: true,
});

const formacion = (texto: string): PasoRecorrido => ({
  id: "formacion",
  titulo: "Formación y recompensas",
  texto,
  sprite: "nueva-insignia",
  ruta: "/formacion",
  proximamente: true,
});

const ayuda: PasoRecorrido = {
  id: "ayuda",
  titulo: "¿Me necesitas otra vez?",
  texto: `Cuando quieras repetir el recorrido, toca este botón y ${NOMBRE_MASCOTA} vuelve a explicarte todo.`,
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
  eventos("Publica eventos y capacitaciones, y confirma la asistencia escaneando el código QR de cada participante."),
  formacion("Crea microcursos y recompensas: los emprendedores ganan puntos y completan sus datos a cambio."),
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
    id: "planes",
    titulo: "Planes y proyectos de aula",
    texto:
      "Sigue los planes de acción de tus proyectos. Actualiza el estado y el avance de los compromisos a tu cargo; los vencidos se marcan solos.",
    sprite: "lista-verificacion",
    ruta: "/planes",
    objetivo: "planes-filtros",
  },
  {
    id: "conocimiento",
    titulo: "Conocimiento",
    texto: "Consulta las cifras de las empresas que acompañas: sectores, tamaños y brechas del diagnóstico.",
    sprite: "estadisticas",
    ruta: "/conocimiento",
  },
  eventos("Inscríbete en conversatorios y capacitaciones, y lleva a tus estudiantes a los eventos del CDE."),
  formacion("Recomienda microcursos a tus estudiantes y sigue su progreso en puntos y niveles."),
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
    id: "planes",
    titulo: "Tus compromisos",
    texto:
      "Usa el filtro «Solo donde soy responsable» para ver solo lo que te toca. Actualiza tu avance para que el docente y el CDE sepan cómo vas.",
    sprite: "lista-verificacion",
    ruta: "/planes",
    objetivo: "planes-filtros",
  },
  eventos("Inscríbete en eventos y capacitaciones. Al asistir escaneas el QR y ganas puntos."),
  formacion("Haz microcursos, gana puntos, sube de nivel y desbloquea insignias. ¡Entra al ranking!"),
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
  eventos("Inscríbete en capacitaciones y networking. Al asistir escaneas el QR y ganas puntos."),
  formacion("Completa microcursos y los datos de tu empresa para ganar puntos y canjearlos por recompensas reales del CDE."),
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
