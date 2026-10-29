// Movimiento por tiempo, no por cuadro: el navegador dibuja tantas veces por segundo como hercios tiene
// el monitor (60, 75, 120, 144…). Antes cada cuadro avanzaba una distancia fija y en un monitor de 144 Hz
// los personajes caminaban 2,4 veces más rápido que en uno de 60 Hz. Ahora la distancia de cada cuadro
// sale de los segundos transcurridos, así que la velocidad es la misma en cualquier pantalla.

type Punto = { x: number; y: number };

/** Baldosas por segundo (las de antes a 60 Hz: 0,08 y 0,03 por cuadro). */
export const VELOCIDAD_PERSONA = 4.8;
export const VELOCIDAD_BUHO = 1.8;
/**
 * Tope del tiempo de un cuadro: si la pestaña estuvo en segundo plano (el navegador deja de dibujar),
 * al volver nadie «salta» varias baldosas de golpe; sigue caminando desde donde iba.
 */
export const CUADRO_MAXIMO_S = 0.1;

/** Segundos entre dos cuadros (marcas de requestAnimationFrame en milisegundos), con tope. */
export const segundosEntre = (anteriorMs: number, ahoraMs: number) => Math.min(Math.max(0, (ahoraMs - anteriorMs) / 1000), CUADRO_MAXIMO_S);

/**
 * Recorre la ruta `distancia` baldosas. En un cuadro largo puede pasar por varias baldosas sin frenar en
 * cada una. Devuelve si se movió, la última dirección (para la pose) y si terminó la ruta en este cuadro.
 */
export function recorrer(m: { px: number; py: number; ruta: Punto[] }, distancia: number) {
  let resto = distancia;
  let direccion: Punto | null = null;
  const habia = m.ruta.length > 0;
  while (resto > 0 && m.ruta.length) {
    const destino = m.ruta[0];
    const dx = destino.x - m.px;
    const dy = destino.y - m.py;
    const d = Math.hypot(dx, dy);
    if (d > 0.001) direccion = { x: dx, y: dy };
    if (d <= resto) {
      m.px = destino.x;
      m.py = destino.y;
      m.ruta.shift();
      resto -= d;
    } else {
      m.px += (dx / d) * resto;
      m.py += (dy / d) * resto;
      resto = 0;
    }
  }
  return { movio: habia, direccion, termino: habia && m.ruta.length === 0 };
}
