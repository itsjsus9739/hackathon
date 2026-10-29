import { CONTACTO_CDE as C } from "@/lib/contacto-cde";
import { cn } from "@/lib/utils";

/** Pie de página en letra pequeña con el contacto del CDE. */
export function PieCde({ className }: { className?: string }) {
  const enlace = "underline-offset-2 hover:underline";
  return (
    <footer className={cn("text-muted-foreground text-[11px] leading-relaxed", className)}>
      <p className="font-semibold">{C.nombre}</p>
      <p>
        {C.dependencia} · {C.direccion}
      </p>
      <p>
        Tel. <a href={`tel:${C.telefonoEnlace}`} className={enlace}>{C.telefono}</a> ·{" "}
        <a href={`mailto:${C.correo}`} className={enlace}>{C.correo}</a> ·{" "}
        <a href={C.web} target="_blank" rel="noreferrer" className={enlace}>unab.edu.co/centro-desarrollo-empresarial</a>
      </p>
    </footer>
  );
}
