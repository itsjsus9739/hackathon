import Image from "next/image";

import { cn } from "@/lib/utils";

// Logo oficial del CDE UNAB, tal como lo envió el CDE (las líneas de la torre son transparentes).

/** Solo el símbolo (cuadrado verde con la torre): menú y barra del celular. */
export function MarcaCde({ className }: { className?: string }) {
  return <Image src="/logo-cde-simbolo.png" alt="CDE UNAB" width={201} height={201} className={cn("shrink-0", className)} />;
}

/** Logo completo: símbolo con «unab», línea y «Cde · Centro de Desarrollo Empresarial». */
export function LogoCde({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/logo-cde.png"
      alt="Centro de Desarrollo Empresarial · UNAB"
      width={696}
      height={281}
      priority={priority}
      // En oscuro el verde del logo se aclara un poco para que se lea sobre el fondo
      className={cn("h-auto shrink-0 dark:brightness-125", className)}
    />
  );
}
