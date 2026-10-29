"use client";

import { NOMBRE_MASCOTA } from "@/lib/recorrido";
import { LADO, OBJETOS, pisoDe, spriteDe, type Avatar, type Objeto } from "./tipos";

// Motor de dibujo de la sala isométrica (canvas 2D). Portado del prototipo del equipo de diseño:
// los números de ajuste (anclas, cajas de ropa, recortes de pared) salen de los sprites originales.

export const ANCHO = 1000;
export const ALTO = 680;
const TW = 120; // ancho de la baldosa
const TH = TW / 2;
const ESC = TW / 224; // las baldosas originales miden 224 px de ancho
const OX = 500; // esquina superior del piso en el canvas
const OY = 160;

const ALTO_PARED_K = 1.4;
const PARED_DY = 6;
const AVATAR_K = 1.12;
const PIES_AVATAR_DY = 7;
const SENTADO_DY = 2;
const SENTADO_ESP_DY = 18; // de espaldas el personaje baja: la silla lo tapa
export const BUHO_ALTO = 100;
const BUHO_PIES_DY = 8;
const VENTANAS_DER = [1.1, 5.0];
const VENTANAS_IZQ = [3.0];
const MARGEN = 14;

export const aPantalla = (gx: number, gy: number) => ({ x: ((gx - gy) * TW) / 2 + OX, y: ((gx + gy) * TH) / 2 + OY });
export const aCuadricula = (px: number, py: number) => {
  const a = (px - OX) / (TW / 2);
  const b = (py - OY) / (TH / 2);
  return { gx: Math.floor((a + b) / 2), gy: Math.floor((b - a) / 2) };
};

// ---------------------------------------------------------------------
// Sprites
//   PJ_fr_drch mira a +x · PJ_fr_izq a +y · PJ_Esp_drch a −y · PJ_Esp_izq a −x
//   silla_drch mira a +y · silla_izq a +x · silla_Esp_drch a −y · silla_Esp_izq a −x
// ---------------------------------------------------------------------
export type Pose = "fr_drch" | "fr_izq" | "Esp_drch" | "Esp_izq" | "snt_drch" | "snt_izq";
const POSES: Pose[] = ["fr_drch", "fr_izq", "Esp_drch", "Esp_izq", "snt_drch", "snt_izq"];

// El búho se redujo a 1/3 del original: sus medidas (centro y pie) también
const POSES_BUHO = {
  frente_izq: { img: "Buho_fr_izq", cx: 295.0 / 3, fondo: 856 / 3 },
  frente_der: { img: "Buho_fr_drch", cx: 307.0 / 3, fondo: 860 / 3 },
  espalda_izq: { img: "Buho_Esp_izq", cx: 243.5 / 3, fondo: 862 / 3 },
  espalda_der: { img: "Buho_Esp_drch", cx: 350.5 / 3, fondo: 778 / 3 },
  sentado: { img: "Buho_sentado", cx: 265.5 / 3, fondo: 735 / 3 },
} as const;
export type PoseBuho = keyof typeof POSES_BUHO;

function rutasSprites(): Record<string, string> {
  const r: Record<string, string> = {};
  for (const d of Object.values(POSES_BUHO)) r[d.img] = `/coworking/buho/${d.img}.png`;
  const sala = (n: string) => (r[n] = `/coworking/sala/${n}.png`);
  ["piso_prd", "piso_mdr", "pared_izq", "pared_der", "ventana", "ventana_izq", "mesa", "planta", "planta_2",
   "cms_1", "cms_2", "cms_mj", "pnt_1", "pnt_2"].forEach(sala);
  ["drch", "izq", "bck_drch", "bck_izq"].forEach((d) => { sala(`Pc_${d}`); sala(`Sillon_${d}`); });
  ["drch", "izq", "Esp_drch", "Esp_izq"].forEach((d) => { sala(`silla_${d}`); sala(`cafetera_${d}`); });
  POSES.forEach((p) => sala(`PJ_${p}`));
  ["pnt_1", "pnt_2"].forEach((pn) => ["snt_drch", "snt_izq"].forEach((p) => sala(`${pn}_${p}`)));
  ["Pelo_H_drch", "pelo_H_izq", "pelo_H_Esp_drch", "pelo_H_Esp_izq", "Pelo_M_drch", "Pelo_M_izq", "Pelo_M_Esp_drch", "Pelo_M_Esp_izq"].forEach(sala);
  return r;
}

let carga: Promise<Record<string, HTMLImageElement>> | null = null;
/** Se descargan una sola vez por pestaña (entrar a otra sala no las vuelve a pedir). */
export function cargarSprites() {
  carga ??= Promise.all(
    Object.entries(rutasSprites()).map(
      ([clave, src]) =>
        new Promise<[string, HTMLImageElement | null]>((resolve) => {
          const im = new Image();
          im.onload = () => resolve([clave, im]);
          im.onerror = () => resolve([clave, null]); // un sprite faltante no tumba la sala
          im.src = src;
        }),
    ),
  ).then((pares) => Object.fromEntries(pares.filter((p): p is [string, HTMLImageElement] => p[1] !== null)));
  return carga;
}

/** Fracción del ancho del sprite que sube desde el borde inferior hasta el centro de la base del mueble. */
const ANCLAS: Record<string, number> = { Pc: 0.22, Sillon: 0.24, silla: 0.14, cafetera: 0.2, mesa: 0.23, planta: 0.14, planta_2: 0.17 };

const PELOS: Record<Avatar["pelo"], Record<Pose, string>> = {
  H: { fr_drch: "Pelo_H_drch", fr_izq: "pelo_H_izq", Esp_drch: "pelo_H_Esp_drch", Esp_izq: "pelo_H_Esp_izq", snt_drch: "Pelo_H_drch", snt_izq: "pelo_H_izq" },
  M: { fr_drch: "Pelo_M_drch", fr_izq: "Pelo_M_izq", Esp_drch: "Pelo_M_Esp_drch", Esp_izq: "Pelo_M_Esp_izq", snt_drch: "Pelo_M_drch", snt_izq: "Pelo_M_izq" },
};

/** Caja [x, y, ancho, alto] de cada prenda sobre el cuerpo de cada pose; «SENTADO» = pantalón ya doblado. */
type Caja = [number, number, number, number];
type Cajas = Record<string, Caja | "SENTADO" | boolean | undefined> & { flip?: boolean };
const CAJAS: Record<Pose, Cajas> = {
  fr_drch: { H: [8, -4, 58, 54], M: [6, -4, 61, 79], cms_1: [-8, 57, 86, 80], cms_2: [-6, 57, 82, 82], cms_mj: [-6, 58, 82, 78], pnt_1: [7, 120, 63, 82], pnt_2: [4, 116, 69, 96] },
  fr_izq: { H: [6, -4, 59, 53], M: [4, -4, 60, 79], cms_1: [-8, 57, 86, 80], cms_2: [-6, 57, 82, 82], cms_mj: [-6, 58, 82, 78], pnt_1: [1, 120, 64, 82], pnt_2: [-2, 116, 70, 96], flip: true },
  Esp_drch: { H: [9, -4, 54, 54], M: [6, -4, 61, 77], cms_1: [-8, 57, 86, 80], cms_2: [-6, 57, 82, 82], cms_mj: [-6, 58, 82, 78], pnt_1: [10, 120, 61, 82], pnt_2: [7, 116, 67, 96] },
  Esp_izq: { H: [10, -4, 53, 55], M: [8, -4, 58, 78], cms_1: [-4, 57, 86, 80], cms_2: [-2, 57, 82, 82], cms_mj: [-2, 58, 82, 78], pnt_1: [3, 120, 61, 82], pnt_2: [0, 116, 67, 96], flip: true },
  snt_drch: { H: [8, -4, 58, 54], M: [6, -4, 61, 79], cms_1: [-8, 57, 86, 80], cms_2: [-6, 57, 82, 82], cms_mj: [-6, 58, 82, 78], pnt_1: "SENTADO", pnt_2: "SENTADO" },
  snt_izq: { H: [21, -4, 59, 53], M: [19, -4, 60, 79], cms_1: [10, 57, 86, 80], cms_2: [12, 57, 82, 82], cms_mj: [12, 58, 82, 78], pnt_1: "SENTADO", pnt_2: "SENTADO", flip: true },
};

/** Silla → pose de quien se sienta en ella */
export const POSE_EN_SILLA: Record<string, Pose> = { drch: "snt_izq", izq: "snt_drch", Esp_drch: "Esp_drch", Esp_izq: "Esp_izq" };

const PARED_SPR = {
  pared_izq: { s: -0.5187, b: 239.83, c0: 21, c1: 161, tapa0: 6, tapa1: 21 },
  pared_der: { s: 0.5187, b: 150.1, c0: 13, c1: 153, tapa0: 153, tapa1: 168 },
  ventana: { s: 0.5125, b: 149.55, c0: 21, c1: 156 },
  ventana_izq: { s: -0.5125, b: 240.26, c0: 22, c1: 157 },
} as const;

// ---------------------------------------------------------------------
// Lo que se dibuja en cada cuadro
// ---------------------------------------------------------------------
export type Personaje = {
  nombre: string;
  rol: string;
  avatar: Avatar;
  px: number;
  py: number;
  pose: Pose;
  sentado: Objeto | null;
  moviendose: boolean;
  esYo: boolean;
  enVoz: boolean;
  silenciado: boolean;
};
export type Mascota = { px: number; py: number; pose: PoseBuho; moviendose: boolean; mensaje: string | null };

type Lienzo = HTMLCanvasElement;
function escalar(img: CanvasImageSource & { naturalWidth?: number }, w: number, h: number): Lienzo {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export class Escena {
  private E: Record<string, Lienzo> = {};
  private paredes: Lienzo;
  private avatares = new Map<string, { canvas: Lienzo; margen: number; w: number; h: number }>();
  private escBuho: number;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private sprites: Record<string, HTMLImageElement>,
  ) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    for (const k of ["piso_mdr", "piso_prd"]) {
      const s = sprites[k];
      if (s) this.E[k] = escalar(s, TW, (s.naturalHeight * TW) / s.naturalWidth);
    }
    const muebles = new Set([...OBJETOS.map(spriteDe), ...["drch", "izq", "Esp_drch", "Esp_izq"].map((d) => `silla_${d}`)]);
    for (const k of muebles) {
      const s = sprites[k];
      if (s) this.E[k] = escalar(s, s.naturalWidth * ESC, s.naturalHeight * ESC);
    }
    const sentado = sprites[POSES_BUHO.sentado.img];
    this.escBuho = sentado ? BUHO_ALTO / sentado.naturalHeight : 1;
    for (const [pose, d] of Object.entries(POSES_BUHO)) {
      const s = sprites[d.img];
      if (s) this.E[`buho_${pose}`] = escalar(s, s.naturalWidth * this.escBuho, s.naturalHeight * this.escBuho);
    }
    this.paredes = this.hornearParedes();
  }

  private anclaDe = (o: Objeto) => ANCLAS[spriteDe(o)] ?? ANCLAS[o.tipo] ?? 0.2;

  // ----- Paredes (se hornean una vez en una capa) -----
  private hornearParedes(): Lienzo {
    const capa = document.createElement("canvas");
    capa.width = ANCHO;
    capa.height = ALTO;
    const g = capa.getContext("2d")!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    const pieza = (nombre: keyof typeof PARED_SPR, sx0: number, sw: number, dx: number, yBase: number, dw: number, pendiente: number) => {
      const img = this.sprites[nombre];
      if (!img) return;
      const p = PARED_SPR[nombre];
      const sy = ESC * ALTO_PARED_K;
      const a = dw / sw;
      const k = pendiente * a - sy * p.s;
      const dy = yBase + PARED_DY - sy * (p.b + p.s * sx0);
      g.setTransform(a, k, 0, sy, dx - a * sx0, dy - k * sx0);
      g.drawImage(img, sx0, 0, sw, img.naturalHeight, sx0, 0, sw, img.naturalHeight);
      g.setTransform(1, 0, 0, 1, 0, 0);
    };
    const T = aPantalla(0, 0);
    const L = aPantalla(0, LADO);
    const R = aPantalla(LADO, 0);
    const arista = TW / 2;
    const caida = TH / 2;
    const pi = PARED_SPR.pared_izq;
    pieza("pared_izq", pi.c0, pi.c1 - pi.c0, L.x, L.y, LADO * arista, -0.5);
    pieza("pared_izq", pi.tapa0, pi.tapa1 - pi.tapa0, L.x - (pi.tapa1 - pi.tapa0) * ESC, L.y + (pi.tapa1 - pi.tapa0) * ESC * 0.5, (pi.tapa1 - pi.tapa0) * ESC, -0.5);
    const pd = PARED_SPR.pared_der;
    pieza("pared_der", pd.c0, pd.c1 - pd.c0, T.x, T.y, LADO * arista, 0.5);
    pieza("pared_der", pd.tapa0, pd.tapa1 - pd.tapa0, R.x, R.y, (pd.tapa1 - pd.tapa0) * ESC, 0.5);
    for (const e of VENTANAS_DER) {
      const p = PARED_SPR.ventana;
      const sw = p.c1 - p.c0;
      pieza("ventana", p.c0, sw, T.x + e * arista, T.y + e * caida, sw * ESC, 0.5);
    }
    for (const e of VENTANAS_IZQ) {
      const p = PARED_SPR.ventana_izq;
      const sw = p.c1 - p.c0;
      pieza("ventana_izq", p.c0, sw, T.x - e * arista - sw * ESC, T.y + e * caida + sw * ESC * 0.5, sw * ESC, -0.5);
    }
    return capa;
  }

  // ----- Personaje por capas (se arma una vez por combinación y pose) -----
  private armarAvatar(a: Avatar, pose: Pose) {
    const clave = [pose, a.pantalon, a.camisa, a.pelo, a.accesorio].join("|");
    const hecho = this.avatares.get(clave);
    if (hecho) return hecho;
    const cuerpo = this.sprites[`PJ_${pose}`];
    if (!cuerpo) return null;
    const cajas = CAJAS[pose];
    const s = ESC * AVATAR_K;
    const W = cuerpo.naturalWidth;
    const H = cuerpo.naturalHeight;
    const c = document.createElement("canvas");
    c.width = Math.ceil((W + 2 * MARGEN) * s);
    c.height = Math.ceil((H + 2 * MARGEN) * s);
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    const poner = (img: HTMLImageElement, [x, y, w, h]: Caja, voltear = false) => {
      const px = (MARGEN + x) * s;
      const py = (MARGEN + y) * s;
      const pw = w * s;
      const ph = h * s;
      if (voltear) {
        g.save();
        g.translate(px + pw, py);
        g.scale(-1, 1);
        g.drawImage(img, 0, 0, pw, ph);
        g.restore();
      } else g.drawImage(img, px, py, pw, ph);
    };
    poner(cuerpo, [0, 0, W, H]);
    const cp = cajas[a.pantalon];
    if (cp === "SENTADO") {
      const im = this.sprites[`${a.pantalon}_${pose}`];
      if (im) poner(im, [0, 0, W, H]);
    } else if (Array.isArray(cp) && this.sprites[a.pantalon]) poner(this.sprites[a.pantalon], cp, cajas.flip);
    const cc = cajas[a.camisa];
    if (Array.isArray(cc) && this.sprites[a.camisa]) poner(this.sprites[a.camisa], cc, cajas.flip);
    const pelo = this.sprites[PELOS[a.pelo][pose]];
    const cpel = cajas[a.pelo];
    if (pelo && Array.isArray(cpel)) poner(pelo, cpel);
    this.accesorio(g, a.accesorio, s, pose, W);
    const listo = { canvas: c, margen: MARGEN * s, w: W * s, h: H * s };
    this.avatares.set(clave, listo);
    return listo;
  }

  // Accesorios en coordenadas de la pose «drch»; en las poses «izq» se reflejan
  private accesorio(g: CanvasRenderingContext2D, tipo: Avatar["accesorio"], s: number, pose: Pose, W: number) {
    if (tipo === "ninguno" || (tipo === "gafas" && pose.startsWith("Esp"))) return; // de espaldas no se ven las gafas
    const X = (v: number) => (MARGEN + v) * s;
    g.save();
    if (pose.endsWith("izq")) {
      g.translate((2 * MARGEN + W) * s, 0);
      g.scale(-1, 1);
    }
    if (tipo === "audifonos") {
      g.strokeStyle = "#1f2937";
      g.lineWidth = 3.4 * s;
      g.lineCap = "round";
      g.beginPath();
      g.arc(X(37), X(30), 28 * s, Math.PI * 1.02, Math.PI * 1.98);
      g.stroke();
      g.fillStyle = "#111827";
      for (const [x, y] of [[6, 26], [60, 26]]) {
        g.beginPath();
        g.roundRect(X(x), X(y), 9 * s, 18 * s, 3 * s);
        g.fill();
      }
      g.fillStyle = "#4b5563";
      for (const [x, y] of [[8, 30], [62, 30]]) g.fillRect(X(x), X(y), 2 * s, 9 * s);
    } else {
      g.strokeStyle = "#111827";
      g.lineWidth = 1.8 * s;
      g.lineJoin = "round";
      g.fillStyle = "rgba(170, 210, 235, 0.35)";
      for (const [x, y] of [[33, 33], [49, 32]]) {
        g.beginPath();
        g.roundRect(X(x), X(y), 11 * s, 9 * s, 2 * s);
        g.fill();
        g.stroke();
      }
      g.beginPath();
      g.moveTo(X(44), X(37));
      g.lineTo(X(49), X(36.5));
      g.stroke();
      g.beginPath();
      g.moveTo(X(33), X(37));
      g.lineTo(X(19), X(35));
      g.stroke();
    }
    g.restore();
  }

  // ----- Dibujo -----
  private etiqueta(x: number, yTop: number, p: Personaje) {
    const { ctx } = this;
    const nombre = `${p.enVoz ? (p.silenciado ? "🔇 " : "🎤 ") : ""}${p.nombre}${p.esYo ? " (tú)" : ""}`;
    const rol = `[${p.rol}]`;
    ctx.textAlign = "center";
    ctx.font = "bold 12px sans-serif";
    const w1 = ctx.measureText(nombre).width;
    ctx.font = "10px sans-serif";
    const w2 = ctx.measureText(rol).width;
    const w = Math.max(w1, w2) + 16;
    const h = 30;
    const color = p.esYo ? "#4fd59a" : "#38bdf8";
    ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
    ctx.fillRect(Math.round(x - w / 2), yTop, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x - w / 2) + 0.5, yTop + 0.5, w - 1, h - 1);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(nombre, x, yTop + 13);
    ctx.fillStyle = color;
    ctx.font = "10px sans-serif";
    ctx.fillText(rol, x, yTop + 25);
  }

  private personaje(p: Personaje) {
    const { ctx } = this;
    const { x, y } = aPantalla(p.px, p.py);
    const silla = p.sentado;
    const pose = silla ? POSE_EN_SILLA[silla.dir ?? "drch"] : p.pose;
    const deEspaldas = Boolean(silla) && pose.startsWith("Esp");
    const rebote = p.moviendose ? Math.abs(Math.sin(Date.now() / 110)) * 3 : 0;
    const av = this.armarAvatar(p.avatar, pose);
    const piesY = silla ? y + (deEspaldas ? SENTADO_ESP_DY : SENTADO_DY) : y + PIES_AVATAR_DY;
    if (!silla) {
      ctx.fillStyle = p.esYo ? "rgba(0, 168, 98, 0.35)" : "rgba(0, 0, 0, 0.22)";
      ctx.beginPath();
      ctx.ellipse(x, piesY - 2, TW * 0.14, TW * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!av) return;
    const dx = Math.round(x - (av.margen + av.w / 2));
    const dy = Math.round(piesY - rebote - (av.margen + av.h));
    if (deEspaldas && silla) {
      // Solo la parte que asoma por encima del asiento; el respaldo se dibuja encima
      const cs = this.E[spriteDe(silla)];
      const tope = cs ? y - (cs.height - this.anclaDe(silla) * cs.width) : y;
      const corte = tope + (cs ? cs.height * 0.55 : 40);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, ANCHO, corte);
      ctx.clip();
      ctx.drawImage(av.canvas, dx, dy);
      ctx.restore();
    } else ctx.drawImage(av.canvas, dx, dy);
    this.etiqueta(x, dy + av.margen - 38, p);
  }

  private mascota(m: Mascota) {
    const { ctx } = this;
    const { x, y } = aPantalla(m.px, m.py);
    const d = POSES_BUHO[m.pose];
    const c = this.E[`buho_${m.pose}`];
    const rebote = m.moviendose ? Math.abs(Math.sin(Date.now() / 130)) * 2 : 0;
    let cabezaY = y - BUHO_ALTO;
    if (c) {
      const dy = Math.round(y + BUHO_PIES_DY - rebote - d.fondo * this.escBuho);
      ctx.drawImage(c, Math.round(x - d.cx * this.escBuho), dy);
      cabezaY = dy;
    }
    const nombre = `🦉 ${NOMBRE_MASCOTA}`;
    ctx.textAlign = "center";
    ctx.font = "bold 12px sans-serif";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineJoin = "round";
    ctx.strokeText(nombre, x, cabezaY - 4);
    ctx.fillStyle = "#00784a";
    ctx.fillText(nombre, x, cabezaY - 4);
    if (!m.mensaje) return;
    // Globo con el consejo, partido en líneas
    ctx.font = "12px sans-serif";
    const palabras = m.mensaje.split(" ");
    const lineas: string[] = [];
    let linea = "";
    for (const p of palabras) {
      const prueba = linea ? `${linea} ${p}` : p;
      if (ctx.measureText(prueba).width > 200 && linea) {
        lineas.push(linea);
        linea = p;
      } else linea = prueba;
    }
    lineas.push(linea);
    const bw = 220;
    const bh = 12 + lineas.length * 15;
    const bx = x - bw / 2;
    const by = cabezaY - 14 - bh - 6;
    ctx.fillStyle = "rgba(255, 255, 255, 0.97)";
    ctx.strokeStyle = "#00a862";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 6);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 6, by + bh);
    ctx.lineTo(x, by + bh + 8);
    ctx.lineTo(x + 6, by + bh);
    ctx.fillStyle = "rgba(255,255,255,0.97)";
    ctx.fill();
    ctx.fillStyle = "#1e293b";
    lineas.forEach((l, i) => ctx.fillText(l, x, by + 17 + i * 15));
  }

  private objeto(o: Objeto) {
    const c = this.E[spriteDe(o)];
    if (!c) return;
    const { x, y } = aPantalla(o.x, o.y);
    this.ctx.drawImage(c, Math.round(x - c.width / 2), Math.round(y - (c.height - this.anclaDe(o) * c.width)));
  }

  /** ¿El clic (en coordenadas del canvas) cae sobre el búho? */
  tocaMascota(m: Mascota, px: number, py: number) {
    const p = aPantalla(m.px, m.py);
    return Math.hypot(px - p.x, py - (p.y - BUHO_ALTO * 0.45)) < BUHO_ALTO * 0.45;
  }

  dibujar(personajes: Personaje[], mascota: Mascota) {
    const { ctx } = this;
    ctx.clearRect(0, 0, ANCHO, ALTO);
    for (let gx = 0; gx < LADO; gx++) {
      for (let gy = 0; gy < LADO; gy++) {
        const p = aPantalla(gx, gy);
        const img = this.E[pisoDe(gx, gy)];
        if (img) ctx.drawImage(img, Math.round(p.x - TW / 2), Math.round(p.y));
      }
    }
    ctx.drawImage(this.paredes, 0, 0);
    // Profundidad isométrica; en la misma casilla: silla de frente → persona → silla de espaldas
    type Item = { k: number; dibujar: () => void };
    const items: Item[] = [
      ...OBJETOS.map((o) => ({ k: o.x + o.y + (o.tipo === "silla" && o.dir?.startsWith("Esp") ? 0.02 : 0), dibujar: () => this.objeto(o) })),
      ...personajes.map((p) => ({ k: p.px + p.py + 0.01, dibujar: () => this.personaje(p) })),
      { k: mascota.px + mascota.py, dibujar: () => this.mascota(mascota) },
    ];
    items.sort((a, b) => a.k - b.k).forEach((i) => i.dibujar());
  }
}
