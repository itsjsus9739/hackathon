"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NOMBRE_MASCOTA, llaveRecorrido, pasosRecorrido, rutaSprite } from "@/lib/recorrido";
import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Props = { idUsuario: string; rol: Enums<"rol_usuario">; nombre: string };
type Caja = { top: number; left: number; width: number; height: number };

const ANCHO_BURBUJA = 360;
const MARGEN = 16;
const HOLGURA = 6; // espacio alrededor del elemento resaltado

// Recorrido guiado por el búho: se abre solo la primera vez y se repite con el botón flotante.
// Lleva al usuario a cada módulo y resalta el elemento del que habla (atributo data-recorrido).
export function RecorridoBuho({ idUsuario, rol, nombre }: Props) {
  const pasos = useMemo(() => pasosRecorrido(rol, nombre), [rol, nombre]);
  const llave = llaveRecorrido(idUsuario);
  const router = useRouter();
  const pathname = usePathname();

  const [indice, setIndice] = useState<number | null>(null);
  const [caja, setCaja] = useState<Caja | null>(null);
  const [ventana, setVentana] = useState({ ancho: 1280, alto: 800 });
  const [altoBurbuja, setAltoBurbuja] = useState(280);
  const burbuja = useRef<HTMLDivElement>(null);
  const botonSiguiente = useRef<HTMLButtonElement>(null);

  const paso = indice === null ? null : pasos[indice];
  const esUltimo = indice === pasos.length - 1;

  // Primera visita de este usuario (y versión del recorrido): se abre solo
  useEffect(() => {
    let visto = true;
    try {
      visto = localStorage.getItem(llave) !== null;
    } catch {
      // sin almacenamiento (modo privado): no se abre solo, queda el botón
    }
    if (!visto) setIndice(0);
  }, [llave]);

  const terminar = useCallback(() => {
    setIndice(null);
    setCaja(null);
    try {
      localStorage.setItem(llave, new Date().toISOString());
    } catch {
      // ignorar
    }
  }, [llave]);

  const avanzar = useCallback(() => {
    if (indice === null) return;
    if (indice >= pasos.length - 1) terminar();
    else setIndice(indice + 1);
  }, [indice, pasos.length, terminar]);

  const retroceder = useCallback(() => {
    if (indice !== null && indice > 0) setIndice(indice - 1);
  }, [indice]);

  // Llevar al usuario a la página del paso
  useEffect(() => {
    if (paso?.ruta && paso.ruta !== pathname) router.push(paso.ruta);
  }, [paso, pathname, router]);

  // Buscar el elemento a resaltar (cuando la página ya cargó) y seguirlo al hacer scroll o cambiar el tamaño
  useEffect(() => {
    if (!paso) return;
    setCaja(null);
    if (paso.ruta && paso.ruta !== pathname) return;

    const selectores = [paso.objetivo, paso.ruta && `nav:${paso.ruta}`]
      .filter(Boolean)
      .map((s) => `[data-recorrido="${s}"]`);
    const visible = (el: Element | null) => {
      const r = el?.getBoundingClientRect();
      return r && r.width > 0 && r.height > 0 ? el : null;
    };
    const buscar = () => selectores.map((s) => visible(document.querySelector(s))).find(Boolean) ?? null;

    let elemento: Element | null = null;
    setVentana({ ancho: window.innerWidth, alto: window.innerHeight });
    const medir = () => {
      setVentana({ ancho: window.innerWidth, alto: window.innerHeight });
      if (!elemento) return;
      const r = elemento.getBoundingClientRect();
      setCaja({ top: r.top - HOLGURA, left: r.left - HOLGURA, width: r.width + HOLGURA * 2, height: r.height + HOLGURA * 2 });
    };

    let intentos = 0;
    const sondeo = window.setInterval(() => {
      elemento = buscar();
      intentos++;
      if (elemento || intentos > 20) {
        window.clearInterval(sondeo);
        if (elemento) {
          const r = elemento.getBoundingClientRect();
          if (r.top < 0 || r.bottom > window.innerHeight) elemento.scrollIntoView({ block: "center" });
        }
        medir();
      }
    }, 100);

    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.clearInterval(sondeo);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [paso, pathname]);

  // Alto real de la burbuja para ubicarla sin salirse de la pantalla
  useEffect(() => {
    const el = burbuja.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAltoBurbuja(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [indice]);

  // Teclado: Esc cierra, flechas navegan; el foco va al botón principal
  useEffect(() => {
    if (indice === null) return;
    botonSiguiente.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") terminar();
      else if (e.key === "ArrowRight") avanzar();
      else if (e.key === "ArrowLeft") retroceder();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [indice, avanzar, retroceder, terminar]);

  const posicion = ubicarBurbuja(caja, ventana, altoBurbuja);

  return (
    <>
      <button
        type="button"
        data-recorrido="boton-ayuda"
        onClick={() => setIndice(0)}
        className="fixed right-4 bottom-4 z-40 flex size-16 items-center justify-center overflow-hidden rounded-full border bg-white shadow-lg transition hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-[var(--primario)]/40 focus-visible:outline-none"
        aria-label={`Ver el recorrido guiado con ${NOMBRE_MASCOTA}`}
        title={`¿Necesitas ayuda? ${NOMBRE_MASCOTA} te guía`}
      >
        <Image src={rutaSprite("necesitas-ayuda")} alt="" width={397} height={382} className="h-auto w-14 translate-y-1" />
      </button>

      {paso && indice !== null && (
        <>
          {/* Capa que oscurece la página y bloquea clics mientras dura el recorrido */}
          <div className={cn("fixed inset-0 z-50", !caja && "bg-slate-900/55")} aria-hidden />
          {caja && (
            <div
              className="pointer-events-none fixed z-50 rounded-lg ring-2 ring-[var(--primario)] transition-all duration-300"
              style={{ ...caja, boxShadow: "0 0 0 9999px rgb(15 23 42 / 0.55)" }}
              aria-hidden
            />
          )}

          <div
            ref={burbuja}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recorrido-titulo"
            aria-describedby="recorrido-texto"
            className="fixed z-[60] rounded-2xl border bg-white p-4 shadow-2xl transition-[top,left,bottom] duration-300"
            style={posicion}
          >
            <button
              type="button"
              onClick={terminar}
              className="text-muted-foreground hover:text-foreground absolute top-2 right-2 rounded-md p-1"
              aria-label="Cerrar el recorrido"
            >
              <X className="size-4" aria-hidden />
            </button>

            <div className="flex gap-3">
              <Image
                key={paso.sprite}
                src={rutaSprite(paso.sprite)}
                alt=""
                width={397}
                height={382}
                priority
                className="h-auto w-24 shrink-0 self-start"
              />
              <div className="min-w-0 pr-4">
                {paso.proximamente && (
                  <span className="mb-1 inline-block rounded-full bg-[var(--primario)]/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--primario)] uppercase">
                    Próximamente
                  </span>
                )}
                <h2 id="recorrido-titulo" className="font-semibold text-balance">
                  {paso.titulo}
                </h2>
                <p id="recorrido-texto" className="text-muted-foreground mt-1 text-sm text-pretty">
                  {paso.texto}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1" aria-label={`Paso ${indice + 1} de ${pasos.length}`}>
                {pasos.map((p, i) => (
                  <span
                    key={p.id}
                    className={cn(
                      "size-1.5 rounded-full bg-black/15 transition-all",
                      i === indice && "w-4 bg-[var(--primario)]",
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                {indice > 0 ? (
                  <Button variant="ghost" size="sm" onClick={retroceder}>
                    <ChevronLeft aria-hidden /> Atrás
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={terminar}>
                    Saltar
                  </Button>
                )}
                <Button ref={botonSiguiente} size="sm" onClick={avanzar}>
                  {esUltimo ? (
                    "¡Entendido!"
                  ) : (
                    <>
                      Siguiente <ChevronRight aria-hidden />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// Junto al elemento resaltado (derecha, izquierda, abajo o arriba, lo que quepa); centrada si no hay elemento.
// En celular va como hoja inferior o superior, sin tapar lo resaltado.
function ubicarBurbuja(caja: Caja | null, v: { ancho: number; alto: number }, alto: number): React.CSSProperties {
  const ancho = Math.min(ANCHO_BURBUJA, v.ancho - MARGEN * 2);
  if (v.ancho < 640) {
    const abajo = !caja || caja.top + caja.height / 2 < v.alto / 2;
    return { left: MARGEN, right: MARGEN, ...(abajo ? { bottom: MARGEN } : { top: MARGEN }) };
  }
  if (!caja) return { width: ancho, left: (v.ancho - ancho) / 2, top: Math.max(MARGEN, (v.alto - alto) / 2) };

  const limitar = (n: number, max: number) => Math.min(Math.max(n, MARGEN), Math.max(MARGEN, max));
  const topLateral = limitar(caja.top, v.alto - alto - MARGEN);
  const leftVertical = limitar(caja.left, v.ancho - ancho - MARGEN);

  if (caja.left + caja.width + MARGEN + ancho <= v.ancho - MARGEN)
    return { width: ancho, top: topLateral, left: caja.left + caja.width + MARGEN };
  if (caja.left - MARGEN - ancho >= MARGEN) return { width: ancho, top: topLateral, left: caja.left - MARGEN - ancho };
  if (caja.top + caja.height + MARGEN + alto <= v.alto - MARGEN)
    return { width: ancho, top: caja.top + caja.height + MARGEN, left: leftVertical };
  if (caja.top - MARGEN - alto >= MARGEN) return { width: ancho, top: caja.top - MARGEN - alto, left: leftVertical };
  // Elemento enorme (p. ej. el tablero completo): esquina inferior derecha
  return { width: ancho, right: MARGEN, bottom: MARGEN };
}
