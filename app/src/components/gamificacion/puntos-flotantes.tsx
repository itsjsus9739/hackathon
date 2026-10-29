"use client";

import { useEffect, useState } from "react";

type Movimiento = { id: number; puntos: number; motivo: string };

const llave = (id: string) => `cde-ultimo-movimiento:${id}`;
const DURACION_MS = 2600;
const ESCALONADO_MS = 450;

/**
 * Cada punto ganado se ve: al llegar movimientos nuevos (desde la última visita o tras una acción),
 * aparece un «+20 pts» que sube y se desvanece. La primera vez solo se toma nota (no se repasa el historial).
 */
export function PuntosFlotantes({ idUsuario, movimientos }: { idUsuario: string; movimientos: Movimiento[] }) {
  const [visibles, setVisibles] = useState<Movimiento[]>([]);
  const ultimo = movimientos[0]?.id ?? 0;

  useEffect(() => {
    if (!ultimo) return;
    let visto: number | null = null;
    try {
      const guardado = localStorage.getItem(llave(idUsuario));
      visto = guardado ? Number(guardado) : null;
      localStorage.setItem(llave(idUsuario), String(Math.max(ultimo, visto ?? 0)));
    } catch {
      return; // sin almacenamiento no se sabe qué es nuevo: mejor no mostrar nada
    }
    if (visto === null) return;
    const nuevos = movimientos.filter((m) => m.id > visto && m.puntos > 0).reverse();
    if (!nuevos.length) return;

    const relojes: ReturnType<typeof setTimeout>[] = [];
    nuevos.forEach((m, i) => {
      relojes.push(setTimeout(() => setVisibles((v) => [...v, m]), i * ESCALONADO_MS));
      relojes.push(setTimeout(() => setVisibles((v) => v.filter((x) => x.id !== m.id)), i * ESCALONADO_MS + DURACION_MS));
    });
    return () => relojes.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando llega un movimiento nuevo
  }, [idUsuario, ultimo]);

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[75] flex flex-col items-end gap-2 md:right-6 md:bottom-6"
      aria-live="polite"
    >
      {visibles.map((m) => (
        <div key={m.id} className="puntos-flotantes rounded-2xl bg-[var(--primario)] px-4 py-2 text-white shadow-lg">
          <p className="text-2xl leading-none font-extrabold tabular-nums">+{m.puntos} pts</p>
          <p className="mt-0.5 max-w-56 truncate text-xs text-white/90">{m.motivo}</p>
        </div>
      ))}
    </div>
  );
}
