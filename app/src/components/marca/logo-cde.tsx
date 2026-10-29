import { cn } from "@/lib/utils";

// Logo del CDE UNAB redibujado en SVG: la torre del campus en un cuadrado verde, «unab» debajo
// y, en la versión completa, «Cde · Centro de Desarrollo Empresarial» al lado.
const VERDE = "#00a862";

/** Solo el símbolo (cuadrado con la torre): menú, barra del celular e ícono de la pestaña. */
export function MarcaCde({ className, conUnab = false }: { className?: string; conUnab?: boolean }) {
  return (
    <svg viewBox={conUnab ? "0 0 120 158" : "0 0 120 120"} className={cn("shrink-0", className)} role="img" aria-label="CDE UNAB">
      <rect width="120" height="120" rx="18" fill={VERDE} />
      <g fill="none" stroke="#fff" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round">
        {/* Techo a cuatro aguas */}
        <path d="M60 15 L17 45 H103 Z M60 15 L50 45" />
        {/* Cuerpo de la torre con sus dos ventanas */}
        <path d="M30 45 V76 H90 V45" />
        <rect x="38" y="53" width="12" height="17" rx="5" />
        <rect x="63" y="53" width="18" height="17" rx="3" />
        {/* Base que llega al borde */}
        <path d="M27 76 V117 M93 76 V117 M27 76 H93 M60 76 V117" />
      </g>
      {conUnab && (
        <text x="60" y="154" textAnchor="middle" fill={VERDE} fontSize="44" fontWeight="800" fontFamily="Inter, ui-sans-serif, system-ui, sans-serif" letterSpacing="-1">
          unab
        </text>
      )}
    </svg>
  );
}

/** Logo completo: símbolo con «unab», línea y «Cde · Centro de Desarrollo Empresarial». */
export function LogoCde({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3 text-[var(--primario-texto)]", className)}>
      <MarcaCde conUnab className="h-full w-auto" />
      <span className="h-[85%] w-0.5 self-center rounded-full bg-[var(--primario)]" aria-hidden />
      <span className="flex flex-col justify-center leading-none">
        <span className="text-[2.6em] font-extrabold tracking-tight">Cde</span>
        <span className="mt-1 text-[0.95em] leading-tight font-semibold">
          Centro de Desarrollo
          <br />
          Empresarial
        </span>
      </span>
    </span>
  );
}
