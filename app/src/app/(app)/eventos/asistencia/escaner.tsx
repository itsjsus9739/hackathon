"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { registrarAsistenciaQr, type ResultadoAsistencia } from "../actions";

type Lectura = ResultadoAsistencia & { clave: number };

/** Cámara que lee el QR de asistencia de cada participante y la registra al instante. */
export function EscanerAsistencia() {
  const router = useRouter();
  const [activo, setActivo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lecturas, setLecturas] = useState<Lectura[]>([]);
  const ultimo = useRef<{ texto: string; hora: number } | null>(null);
  const procesando = useRef(false);

  useEffect(() => {
    if (!activo) return;
    let escaner: import("html5-qrcode").Html5Qrcode | null = null;
    let cancelado = false;

    import("html5-qrcode").then(async ({ Html5Qrcode }) => {
      if (cancelado) return;
      escaner = new Html5Qrcode("lector-qr", { verbose: false });
      try {
        await escaner.start(
          { facingMode: "environment" },
          // El recuadro de lectura se ajusta a la cámara: así se lee el QR aunque lo acerquen mucho
          { fps: 10, qrbox: (ancho, alto) => ({ width: Math.floor(Math.min(ancho, alto) * 0.85), height: Math.floor(Math.min(ancho, alto) * 0.85) }) },
          async (texto) => {
            // El mismo código se lee varias veces por segundo: se ignora durante 4 s
            const ahora = Date.now();
            if (procesando.current || (ultimo.current?.texto === texto && ahora - ultimo.current.hora < 4000)) return;
            ultimo.current = { texto, hora: ahora };
            procesando.current = true;
            const r = await registrarAsistenciaQr(texto);
            procesando.current = false;
            setLecturas((l) => [{ ...r, clave: ahora }, ...l].slice(0, 8));
            if (!r.error) router.refresh();
          },
          () => {},
        );
      } catch {
        setError("No pudimos abrir la cámara. Revisa el permiso del navegador o usa la lista para marcar a mano.");
        setActivo(false);
      }
    });

    return () => {
      cancelado = true;
      if (escaner?.isScanning) escaner.stop().catch(() => {});
    };
  }, [activo, router]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => (setError(null), setActivo((v) => !v))} variant={activo ? "outline" : "default"}>
          {activo ? <CameraOff aria-hidden /> : <Camera aria-hidden />} {activo ? "Detener cámara" : "Escanear QR"}
        </Button>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
      <div id="lector-qr" className={cn("max-w-sm overflow-hidden rounded-xl", !activo && "hidden")} />
      {lecturas.length > 0 && (
        <ul className="space-y-1.5" aria-live="polite">
          {lecturas.map((l) => (
            <li
              key={l.clave}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                l.error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800",
              )}
            >
              {l.error ? <XCircle className="size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="size-4 shrink-0" aria-hidden />}
              {l.error ?? (
                <span>
                  <b>{l.nombre}</b> · {l.evento}
                  {l.yaEstaba ? " (ya estaba registrada)" : l.puntos ? ` · +${l.puntos} puntos` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
