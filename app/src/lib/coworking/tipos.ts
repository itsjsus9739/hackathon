// Coworking virtual: tipos y mundo de la sala (lógica pura, compartida por el canvas y las pruebas).

export type Accesorio = "ninguno" | "audifonos" | "gafas";
export type Avatar = { piel: string; camiseta: string; pelo: string; accesorio: Accesorio };

export const AVATAR_PREDETERMINADO: Avatar = { piel: "#f1c27d", camiseta: "#e4572e", pelo: "#2b1b17", accesorio: "ninguno" };

const COLOR = /^#[0-9a-f]{6}$/i;

/** Avatar guardado en perfiles.avatar (jsonb libre): se valida y se completa con el predeterminado. */
export function normalizarAvatar(valor: unknown): Avatar {
  const v = (valor && typeof valor === "object" ? valor : {}) as Record<string, unknown>;
  const color = (c: unknown, def: string) => (typeof c === "string" && COLOR.test(c) ? c : def);
  return {
    piel: color(v.piel, AVATAR_PREDETERMINADO.piel),
    camiseta: color(v.camiseta, AVATAR_PREDETERMINADO.camiseta),
    pelo: color(v.pelo, AVATAR_PREDETERMINADO.pelo),
    accesorio: v.accesorio === "audifonos" || v.accesorio === "gafas" ? v.accesorio : "ninguno",
  };
}

/** Lo que cada persona comparte con la sala (presencia de Realtime). */
export type Presencia = {
  id: string;
  nombre: string;
  rol: string;
  avatar: Avatar;
  /** Casilla destino (centro de la baldosa): los demás animan el desplazamiento */
  x: number;
  y: number;
  enVoz: boolean;
  silenciado: boolean;
};

export type MensajeChat = { id: string; autor: string; idAutor: string; texto: string; fecha: string };

// ----- Sala -----
export const LADO = 8; // baldosas por lado

export type Objeto = { x: number; y: number; tipo: "mesa" | "pc" | "silla" | "planta" | "pizarra" };

export const OBJETOS: Objeto[] = [
  { x: 2.5, y: 2.5, tipo: "mesa" },
  { x: 2.5, y: 2.5, tipo: "pc" },
  { x: 1.5, y: 2.5, tipo: "silla" },
  { x: 6.5, y: 5.5, tipo: "mesa" },
  { x: 6.5, y: 5.5, tipo: "pc" },
  { x: 7.5, y: 5.5, tipo: "silla" },
  { x: 4.5, y: 1.5, tipo: "planta" },
  { x: 0.5, y: 6.5, tipo: "planta" },
];

/** Baldosa libre: dentro de la sala, sin muebles (las sillas sí se pueden ocupar) y sin otra persona. */
export function baldosaLibre(gx: number, gy: number, ocupadas: { x: number; y: number }[]): boolean {
  if (gx < 0 || gy < 0 || gx >= LADO || gy >= LADO) return false;
  const misma = (p: { x: number; y: number }) => Math.floor(p.x) === gx && Math.floor(p.y) === gy;
  return !OBJETOS.some((o) => o.tipo !== "silla" && misma(o)) && !ocupadas.some(misma);
}

/** Primera baldosa libre recorriendo la sala desde un punto (para entrar sin caer encima de alguien). */
export function baldosaInicial(ocupadas: { x: number; y: number }[], semilla = 0): { x: number; y: number } {
  const total = LADO * LADO;
  for (let i = 0; i < total; i++) {
    const k = (semilla + i * 7) % total;
    const gx = k % LADO;
    const gy = Math.floor(k / LADO);
    if (baldosaLibre(gx, gy, ocupadas)) return { x: gx + 0.5, y: gy + 0.5 };
  }
  return { x: 3.5, y: 3.5 };
}

/**
 * Volumen de la voz según la distancia en baldosas (como en Habbo/Gather):
 * a 2 o menos se oye completo, se apaga linealmente hasta 6 y más lejos no se oye.
 */
export function volumenPorDistancia(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  if (d <= 2) return 1;
  if (d >= 6) return 0;
  return Number((1 - (d - 2) / 4).toFixed(2));
}

/** Semilla estable a partir del id, para repartir a la gente por la sala. */
export const semillaDe = (id: string) => [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7) % (LADO * LADO);
