"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { marcarCelebradas } from "@/app/(app)/formacion/actions";
import { EVENTO_FIN_RECORRIDO, recorridoAbierto } from "@/components/buho/recorrido-buho";
import { Button } from "@/components/ui/button";

type Props = {
  idUsuario: string;
  insignias: { id: string; nombre: string }[];
  nivel: { numero: number; nombre: string };
};

type Momento = { tipo: "insignia"; nombres: string[]; ids: string[] } | { tipo: "nivel"; nombre: string };

const llaveNivel = (id: string) => `cde-nivel:${id}`;

async function lanzarConfeti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  const colores = ["#00a862", "#7ed8a9", "#ffe08a", "#d4a017", "#ffffff"];
  confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 }, colors: colores, zIndex: 80 });
  setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.5 }, colors: colores, zIndex: 80 }), 250);
}

/**
 * Celebra una insignia nueva (aviso de tipo «insignia» sin leer) o una subida de nivel
 * (comparando con el último nivel visto en este navegador). Se muestra en cualquier pantalla.
 */
export function Celebracion({ idUsuario, insignias, nivel }: Props) {
  const [momento, setMomento] = useState<Momento | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const claveInsignias = insignias.map((i) => i.id).join(",");

  useEffect(() => {
    let anterior: number | null = null;
    try {
      const guardado = localStorage.getItem(llaveNivel(idUsuario));
      anterior = guardado ? Number(guardado) : null;
      localStorage.setItem(llaveNivel(idUsuario), String(nivel.numero));
    } catch {
      // sin almacenamiento: solo se celebran las insignias
    }
    let siguiente: Momento | null = null;
    if (claveInsignias) {
      siguiente = { tipo: "insignia", nombres: insignias.map((i) => i.nombre), ids: insignias.map((i) => i.id) };
    } else if (anterior !== null && nivel.numero > anterior) {
      siguiente = { tipo: "nivel", nombre: nivel.nombre };
    }
    if (!siguiente) return;
    const mostrar = () => setMomento(siguiente);
    // Si el búho está dando el recorrido, se celebra al terminar
    if (!recorridoAbierto()) return mostrar();
    window.addEventListener(EVENTO_FIN_RECORRIDO, mostrar, { once: true });
    return () => window.removeEventListener(EVENTO_FIN_RECORRIDO, mostrar);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se recalcula solo cuando cambian las insignias o el nivel
  }, [idUsuario, claveInsignias, nivel.numero]);

  useEffect(() => {
    if (!momento) return;
    lanzarConfeti();
    boton.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cerrar depende solo de momento
  }, [momento]);

  function cerrar() {
    if (momento?.tipo === "insignia") marcarCelebradas(momento.ids);
    setMomento(null);
  }

  if (!momento) return null;
  const esInsignia = momento.tipo === "insignia";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/55 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebracion-titulo"
        className="w-full max-w-sm rounded-3xl bg-card p-6 text-center shadow-2xl"
      >
        <Image
          src={esInsignia ? "/buho/buho-nueva-insignia.png" : "/buho/buho-nivel-completado.png"}
          alt=""
          width={397}
          height={382}
          priority
          className="mx-auto h-auto w-44"
        />
        <h2 id="celebracion-titulo" className="mt-2 text-xl font-bold text-[var(--tinta)]">
          {esInsignia ? (momento.nombres.length > 1 ? "¡Ganaste nuevas insignias!" : "¡Ganaste una insignia!") : "¡Subiste de nivel!"}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {esInsignia ? (
            momento.nombres.map((n, i) => (
              <span key={n}>
                {i > 0 && ", "}
                <b className="text-foreground">{n}</b>
              </span>
            ))
          ) : (
            <>
              Ahora eres <b className="text-foreground">{momento.nombre}</b>. ¡Sigue así!
            </>
          )}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button ref={boton} onClick={cerrar}>
            ¡Genial!
          </Button>
          <Link href="/formacion" onClick={cerrar} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-foreground/5">
            Ver mis logros
          </Link>
        </div>
      </div>
    </div>
  );
}
