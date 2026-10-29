"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { textoQrAsistencia } from "@/lib/eventos";
import { cn } from "@/lib/utils";
import { marcarAsistencia } from "./actions";

/** QR personal de la inscripción: el participante lo muestra y el CDE lo escanea al llegar. */
export function QrAsistencia({ idInscripcion, puntos }: { idInscripcion: string; puntos: number }) {
  const [imagen, setImagen] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    import("qrcode").then((qr) =>
      qr.toDataURL(textoQrAsistencia(idInscripcion), { width: 220, margin: 1, color: { dark: "#0b3d2a" } }).then((url) => {
        if (vigente) setImagen(url);
      }),
    );
    return () => {
      vigente = false;
    };
  }, [idInscripcion]);

  return (
    <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed p-3 text-center sm:flex-row sm:text-left">
      {imagen ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagen generada en el navegador (data URL)
        <img src={imagen} alt="Código QR de tu asistencia" width={132} height={132} className="size-33 shrink-0" />
      ) : (
        <div className="bg-muted size-33 shrink-0 animate-pulse rounded-lg" aria-hidden />
      )}
      <p className="text-sm">
        <strong className="block">Tu QR de asistencia</strong>
        <span className="text-muted-foreground">
          Muéstralo al equipo del CDE cuando llegues para registrar tu asistencia
          {puntos > 0 ? ` y ganar ${puntos} puntos` : ""}.
        </span>
      </p>
    </div>
  );
}

/** Casilla «Asistió» para el CDE en la lista de asistentes. */
export function CasillaAsistencia({
  idInscripcion,
  asistio,
  alCambiar,
}: {
  idInscripcion: string;
  asistio: boolean;
  alCambiar: () => void;
}) {
  const [marcada, setMarcada] = useState(asistio);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMarcada(asistio), [asistio]);

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium select-none",
        marcada ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "text-muted-foreground",
      )}
      title={error ?? (marcada ? "Quitar asistencia (resta los puntos)" : "Marcar que asistió (suma los puntos)")}
    >
      {pendiente ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <CheckCircle2 className="size-3.5" aria-hidden />}
      <input
        type="checkbox"
        className="sr-only"
        checked={marcada}
        disabled={pendiente}
        onChange={(e) => {
          const valor = e.target.checked;
          setMarcada(valor);
          setError(null);
          iniciar(async () => {
            const r = await marcarAsistencia({ idInscripcion, asistio: valor });
            if (r.error) {
              setMarcada(!valor);
              setError(r.error);
            } else alCambiar();
          });
        }}
      />
      {error ? <span className="text-destructive">Error</span> : "Asistió"}
    </label>
  );
}
