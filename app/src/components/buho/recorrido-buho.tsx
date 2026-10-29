"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Coins, PlayCircle, X } from "lucide-react";

import { completarRecorrido } from "@/app/(app)/formacion/actions";
import { Button } from "@/components/ui/button";
import { NOMBRE_MASCOTA, TUTORIALES, esTutorial, llaveRecorrido, pasosRecorrido, rutaSprite, type IdTutorial } from "@/lib/recorrido";
import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Props = { idUsuario: string; rol: Enums<"rol_usuario">; nombre: string };
type Caja = { top: number; left: number; width: number; height: number };

const ANCHO_BURBUJA = 360;
const MARGEN = 16;
const HOLGURA = 6; // espacio alrededor del elemento resaltado
const EVENTO_INICIAR = "recorrido:iniciar";
export const EVENTO_FIN_RECORRIDO = "recorrido:fin";

/** Mientras el recorrido está abierto, otras ventanas (p. ej. las celebraciones) esperan. */
export const recorridoAbierto = () => document.documentElement.dataset.recorrido === "abierto";

/** Botón para abrir el recorrido desde cualquier pantalla (p. ej. el estado vacío de Formación). */
export function BotonIniciarRecorrido({ etiqueta = "Hacer el recorrido" }: { etiqueta?: string }) {
  return (
    <Button size="sm" onClick={() => window.dispatchEvent(new Event(EVENTO_INICIAR))}>
      <PlayCircle aria-hidden /> {etiqueta}
    </Button>
  );
}

// Recorrido guiado por el búho: se abre solo la primera vez y se repite con el botón flotante.
// Lleva al usuario a cada módulo y resalta el elemento del que habla (atributo data-recorrido).
// Con ?tutorial=<id> en la URL (tarjetas de «Tutoriales» del inicio) muestra ese tutorial paso a paso.
export function RecorridoBuho({ idUsuario, rol, nombre }: Props) {
  const [tutorial, setTutorial] = useState<IdTutorial | null>(null);
  const pasos = useMemo(() => (tutorial ? TUTORIALES[tutorial].pasos : pasosRecorrido(rol, nombre)), [tutorial, rol, nombre]);
  const llave = llaveRecorrido(idUsuario);
  const router = useRouter();
  const pathname = usePathname();

  const [indice, setIndice] = useState<number | null>(null);
  const [caja, setCaja] = useState<Caja | null>(null);
  const [ventana, setVentana] = useState({ ancho: 1280, alto: 800 });
  const [altoBurbuja, setAltoBurbuja] = useState(280);
  const [menuAbierto, setMenuAbierto] = useState(false);
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
    if (!visto) {
      document.documentElement.dataset.recorrido = "abierto";
      setIndice(0);
    }
  }, [llave]);

  // Marca global de recorrido abierto; al cerrarse, avisa a quien estaba esperando
  useEffect(() => {
    if (indice === null) return;
    document.documentElement.dataset.recorrido = "abierto";
    return () => {
      delete document.documentElement.dataset.recorrido;
      window.dispatchEvent(new Event(EVENTO_FIN_RECORRIDO));
    };
  }, [indice === null]); // eslint-disable-line react-hooks/exhaustive-deps -- solo al abrir y cerrar

  // Otros componentes lo abren con un evento (BotonIniciarRecorrido)
  useEffect(() => {
    const iniciar = () => setIndice(0);
    window.addEventListener(EVENTO_INICIAR, iniciar);
    return () => window.removeEventListener(EVENTO_INICIAR, iniciar);
  }, []);

  // Menú del búho flotante: se cierra con Esc o al tocar fuera
  useEffect(() => {
    if (!menuAbierto) return;
    const cerrar = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as Element).closest("[data-menu-buho]")) setMenuAbierto(false);
    };
    window.addEventListener("keydown", cerrar);
    window.addEventListener("pointerdown", cerrar);
    return () => {
      window.removeEventListener("keydown", cerrar);
      window.removeEventListener("pointerdown", cerrar);
    };
  }, [menuAbierto]);

  // Tutorial pedido en la URL: se abre y se quita el parámetro (al recargar no vuelve a empezar)
  useEffect(() => {
    const url = new URL(window.location.href);
    const pedido = url.searchParams.get("tutorial");
    if (!esTutorial(pedido)) return;
    url.searchParams.delete("tutorial");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    setTutorial(pedido);
    setIndice(0);
  }, [pathname]);

  const terminar = useCallback(() => {
    setIndice(null);
    setCaja(null);
    if (tutorial) {
      setTutorial(null); // un tutorial no cuenta como el recorrido general visto
      return;
    }
    try {
      localStorage.setItem(llave, new Date().toISOString());
    } catch {
      // ignorar
    }
  }, [llave, tutorial]);

  const avanzar = useCallback(() => {
    if (indice === null) return;
    if (indice >= pasos.length - 1) {
      // Recorrido general completo: la base suma 20 puntos y la insignia Bienvenida (solo la primera vez).
      // Los tutoriales de un módulo no cuentan.
      if (!tutorial) completarRecorrido(pasos.map((p) => p.id));
      terminar();
    } else setIndice(indice + 1);
  }, [indice, pasos, terminar, tutorial]);

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
    // El mismo destino puede estar en el menú lateral (escritorio) y en la barra inferior (celular): el primero visible
    const buscar = () => selectores.flatMap((s) => [...document.querySelectorAll(s)]).find((el) => visible(el)) ?? null;

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
      <div data-menu-buho className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 md:bottom-4">
        {menuAbierto && (
          <div className="absolute right-0 bottom-full mb-2 w-56 rounded-2xl border bg-card p-1.5 shadow-xl" role="menu">
            <p className="text-muted-foreground px-2.5 pt-1 pb-1.5 text-xs">¿En qué te ayudo?</p>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuAbierto(false);
                setTutorial(null); // el menú siempre repite el recorrido general
                setIndice(0);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-foreground/5"
            >
              <PlayCircle className="size-4 text-[var(--primario-texto)]" aria-hidden /> Repetir el recorrido
            </button>
            <Link
              href="/formacion#como-gano"
              role="menuitem"
              onClick={() => setMenuAbierto(false)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-foreground/5"
            >
              <Coins className="size-4 text-[var(--primario-texto)]" aria-hidden /> ¿Cómo gano puntos?
            </Link>
          </div>
        )}
        <button
          type="button"
          data-recorrido="boton-ayuda"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-expanded={menuAbierto}
          aria-haspopup="menu"
          className="flex size-14 items-center justify-center overflow-hidden rounded-full border bg-card shadow-lg transition hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-[var(--primario)]/40 focus-visible:outline-none md:size-16"
          aria-label={`Ayuda de ${NOMBRE_MASCOTA}: recorrido guiado y cómo ganar puntos`}
          title={`¿Necesitas ayuda? ${NOMBRE_MASCOTA} te guía`}
        >
          <Image src={rutaSprite("necesitas-ayuda")} alt="" width={397} height={382} className="h-auto w-14 translate-y-1" />
        </button>
      </div>

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
            className="fixed z-[60] rounded-2xl border bg-card p-4 shadow-2xl transition-[top,left,bottom] duration-300"
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
                      "size-1.5 rounded-full bg-foreground/15 transition-all",
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
