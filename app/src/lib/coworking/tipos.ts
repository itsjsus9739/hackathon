// Coworking virtual: tipos y mundo de la sala (lógica pura, compartida por el canvas y las pruebas).
// Sala isométrica de 8×8 con oficina y zona de descanso; los sprites viven en /public/coworking.

// ---------------------------------------------------------------------
// Avatar por capas: cuerpo + pantalón + camisa + cabello + accesorio
// ---------------------------------------------------------------------
export const OPCIONES_AVATAR = {
  camisa: [
    { valor: "cms_1", etiqueta: "Camiseta roja" },
    { valor: "cms_2", etiqueta: "Camisa blanca formal" },
    { valor: "cms_mj", etiqueta: "Camiseta gris" },
  ],
  pantalon: [
    { valor: "pnt_1", etiqueta: "Jeans claros" },
    { valor: "pnt_2", etiqueta: "Jeans oscuros con zapatos" },
  ],
  pelo: [
    { valor: "H", etiqueta: "Corto" },
    { valor: "M", etiqueta: "Largo" },
  ],
  accesorio: [
    { valor: "ninguno", etiqueta: "Ninguno" },
    { valor: "audifonos", etiqueta: "Audífonos" },
    { valor: "gafas", etiqueta: "Gafas" },
  ],
} as const;

type Valor<K extends keyof typeof OPCIONES_AVATAR> = (typeof OPCIONES_AVATAR)[K][number]["valor"];
export type Avatar = { camisa: Valor<"camisa">; pantalon: Valor<"pantalon">; pelo: Valor<"pelo">; accesorio: Valor<"accesorio"> };
export type Accesorio = Avatar["accesorio"];

export const AVATAR_PREDETERMINADO: Avatar = { camisa: "cms_1", pantalon: "pnt_1", pelo: "H", accesorio: "ninguno" };

/** Avatar guardado en perfiles.avatar (jsonb libre): se valida y se completa con el predeterminado. */
export function normalizarAvatar(valor: unknown): Avatar {
  const v = (valor && typeof valor === "object" ? valor : {}) as Record<string, unknown>;
  const elegir = <K extends keyof typeof OPCIONES_AVATAR>(k: K): Avatar[K] =>
    (OPCIONES_AVATAR[k].some((o) => o.valor === v[k]) ? v[k] : AVATAR_PREDETERMINADO[k]) as Avatar[K];
  return { camisa: elegir("camisa"), pantalon: elegir("pantalon"), pelo: elegir("pelo"), accesorio: elegir("accesorio") };
}

// ---------------------------------------------------------------------
// Lo que viaja por la red
// ---------------------------------------------------------------------
/** Lo que cada persona comparte con la sala (presencia de Realtime). */
export type Presencia = {
  id: string;
  nombre: string;
  rol: string;
  avatar: Avatar;
  /** Casilla destino (centro de la baldosa): los demás animan el recorrido */
  x: number;
  y: number;
  /** Silla en la que está (o hacia la que va), como "x,y"; null si está de pie */
  silla: string | null;
  enVoz: boolean;
  silenciado: boolean;
};

export type MensajeChat = { id: string; autor: string; idAutor: string; texto: string; fecha: string };

// ---------------------------------------------------------------------
// Sala
// ---------------------------------------------------------------------
export const LADO = 8; // baldosas por lado

export type TipoObjeto = "Pc" | "silla" | "mesa" | "cafetera" | "Sillon" | "planta" | "planta_2";
/** tipo + dir forman el nombre del sprite (tipo «Pc», dir «bck_drch» → Pc_bck_drch.png) */
export type Objeto = { x: number; y: number; tipo: TipoObjeto; dir?: string };

export const OBJETOS: Objeto[] = [
  // Oficina: escritorios vistos de espaldas (la persona se sienta detrás, de frente a la cámara)
  { x: 1.5, y: 2.5, tipo: "Pc", dir: "bck_drch" }, { x: 1.5, y: 1.5, tipo: "silla", dir: "drch" },
  { x: 3.5, y: 2.5, tipo: "Pc", dir: "bck_drch" }, { x: 3.5, y: 1.5, tipo: "silla", dir: "drch" },
  { x: 6.5, y: 5.5, tipo: "Pc", dir: "bck_izq" }, { x: 5.5, y: 5.5, tipo: "silla", dir: "izq" },
  // Escritorios de frente: la silla queda de espaldas a la cámara
  { x: 1.5, y: 4.5, tipo: "Pc", dir: "drch" }, { x: 1.5, y: 5.5, tipo: "silla", dir: "Esp_drch" },
  { x: 3.5, y: 4.5, tipo: "Pc", dir: "drch" }, { x: 3.5, y: 5.5, tipo: "silla", dir: "Esp_drch" },
  { x: 6.5, y: 3.5, tipo: "Pc", dir: "izq" }, { x: 7.5, y: 3.5, tipo: "silla", dir: "Esp_izq" },
  { x: 0.5, y: 6.5, tipo: "mesa" },
  // Zona de descanso (piso de madera, esquina superior derecha)
  { x: 6.5, y: 0.5, tipo: "cafetera", dir: "izq" },
  { x: 5.5, y: 0.5, tipo: "Sillon", dir: "izq" },
  { x: 5.5, y: 1.5, tipo: "mesa" },
  { x: 7.5, y: 1.5, tipo: "Sillon", dir: "bck_izq" },
  { x: 7.5, y: 0.5, tipo: "planta" },
  // Plantas
  { x: 0.5, y: 0.5, tipo: "planta_2" },
  { x: 0.5, y: 3.5, tipo: "planta_2" },
  { x: 7.5, y: 7.5, tipo: "planta" },
];

export const spriteDe = (o: Objeto) => (o.dir ? `${o.tipo}_${o.dir}` : o.tipo);
export const claveSilla = (o: { x: number; y: number }) => `${o.x},${o.y}`;
export const objetoEn = (gx: number, gy: number) => OBJETOS.find((o) => Math.floor(o.x) === gx && Math.floor(o.y) === gy);
export const sillaPorClave = (clave: string | null) => (clave ? (OBJETOS.find((o) => o.tipo === "silla" && claveSilla(o) === clave) ?? null) : null);

/** Piso: madera en la zona de descanso, baldosa en la oficina. */
export const pisoDe = (gx: number, gy: number) => (gx >= 5 && gy <= 2 ? "piso_mdr" : "piso_prd");

type Punto = { x: number; y: number };
const misma = (gx: number, gy: number) => (p: Punto) => Math.floor(p.x) === gx && Math.floor(p.y) === gy;

/** Casilla bloqueada: fuera de la sala, con mueble (sillas incluidas) o con otra persona. */
export function casillaBloqueada(gx: number, gy: number, ocupadas: Punto[]): boolean {
  if (gx < 0 || gy < 0 || gx >= LADO || gy >= LADO) return true;
  return Boolean(objetoEn(gx, gy)) || ocupadas.some(misma(gx, gy));
}

/** Se puede caminar hasta ella (las sillas se ocupan aparte, haciendo clic en ellas). */
export const baldosaLibre = (gx: number, gy: number, ocupadas: Punto[]) => !casillaBloqueada(gx, gy, ocupadas);

/**
 * Ruta ortogonal (BFS) de baldosa en baldosa, como lista de centros. Si `destinoLibre`, la casilla final
 * puede tener mueble (una silla). Vacía si no hay camino o si ya se está ahí.
 */
export function buscarRuta(desde: Punto, finX: number, finY: number, ocupadas: Punto[], destinoLibre = false): Punto[] {
  const sx = Math.max(0, Math.min(LADO - 1, Math.floor(desde.x)));
  const sy = Math.max(0, Math.min(LADO - 1, Math.floor(desde.y)));
  if (!destinoLibre && casillaBloqueada(finX, finY, ocupadas)) return [];
  const esFin = (x: number, y: number) => x === finX && y === finY;
  const cola: [number, number][] = [[sx, sy]];
  const padre = new Map<string, [number, number]>();
  const vistos = new Set([`${sx},${sy}`]);
  while (cola.length) {
    const [x, y] = cola.shift()!;
    if (esFin(x, y)) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= LADO || ny >= LADO || vistos.has(k)) continue;
      if (casillaBloqueada(nx, ny, ocupadas) && !(destinoLibre && esFin(nx, ny))) continue;
      vistos.add(k);
      padre.set(k, [x, y]);
      cola.push([nx, ny]);
    }
  }
  if (!vistos.has(`${finX},${finY}`) || (sx === finX && sy === finY)) return [];
  const ruta: Punto[] = [];
  let actual: [number, number] | undefined = [finX, finY];
  while (actual && !(actual[0] === sx && actual[1] === sy)) {
    ruta.push({ x: actual[0] + 0.5, y: actual[1] + 0.5 });
    actual = padre.get(`${actual[0]},${actual[1]}`);
  }
  return ruta.reverse();
}

const CENTRO = { x: 4.5, y: 3.5 }; // pasillo central, siempre libre de muebles

/**
 * Primera baldosa libre recorriendo la sala desde un punto (para entrar sin caer encima de alguien).
 * Solo vale si se puede llegar desde el pasillo central: hay rincones encerrados entre muebles.
 */
export function baldosaInicial(ocupadas: Punto[], semilla = 0): Punto {
  const total = LADO * LADO;
  for (let i = 0; i < total; i++) {
    const k = (semilla + i * 7) % total;
    const gx = k % LADO;
    const gy = Math.floor(k / LADO);
    const centro = gx === Math.floor(CENTRO.x) && gy === Math.floor(CENTRO.y);
    if (baldosaLibre(gx, gy, ocupadas) && (centro || buscarRuta(CENTRO, gx, gy, []).length)) return { x: gx + 0.5, y: gy + 0.5 };
  }
  return CENTRO;
}

/** Pose al caminar según la dirección en la cuadrícula (+x baja a la derecha, +y baja a la izquierda). */
export function poseDesde(dx: number, dy: number) {
  const sx = dx - dy;
  const sy = dx + dy;
  return `${sy >= 0 ? "fr" : "Esp"}${sx >= 0 ? "_drch" : "_izq"}` as "fr_drch" | "fr_izq" | "Esp_drch" | "Esp_izq";
}

export const VOZ_COMPLETA = 3; // baldosas a las que se oye completo
export const VOZ_ALCANCE = 9; // más lejos no se oye (solo las esquinas opuestas de la sala)

/**
 * Volumen de la voz según la distancia en baldosas (como en Habbo/Gather): completo hasta 3 baldosas
 * y se apaga poco a poco hasta 9. Antes se cortaba a 6 y dos personas en escritorios distintos no se oían.
 */
export function volumenPorDistancia(a: Punto, b: Punto): number {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  if (d <= VOZ_COMPLETA) return 1;
  if (d >= VOZ_ALCANCE) return 0;
  return Number((1 - (d - VOZ_COMPLETA) / (VOZ_ALCANCE - VOZ_COMPLETA)).toFixed(2));
}

/** Semilla estable a partir del id, para repartir a la gente por la sala. */
export const semillaDe = (id: string) => [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7) % (LADO * LADO);

// ---------------------------------------------------------------------
// Chat: se reinicia todos los días a las 4:00 a. m. (hora de Colombia, UTC−5 todo el año)
// ---------------------------------------------------------------------
const HORA_REINICIO_UTC = 9; // 4:00 a. m. en Bogotá

/** Último reinicio del chat: el chat solo muestra (y conserva) mensajes desde ese momento. */
export function ultimoReinicioChat(ahora = new Date()): Date {
  const corte = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate(), HORA_REINICIO_UTC));
  if (corte > ahora) corte.setUTCDate(corte.getUTCDate() - 1);
  return corte;
}

export const proximoReinicioChat = (ahora = new Date()) => new Date(ultimoReinicioChat(ahora).getTime() + 24 * 3600 * 1000);
