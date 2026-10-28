import { Proximamente } from "@/components/buho/pantalla-buho";

export const metadata = { title: "Agenda · CDE Conecta" };

// El calendario es una app Flask aparte (carpeta calendario-cde/ en la raíz del repo),
// servida bajo /calendario por el rewrite de next.config.ts.
export default function Pagina() {
  if (!process.env.CALENDARIO_URL) {
    return <Proximamente modulo="Agenda" descripcion="Falta configurar la variable CALENDARIO_URL con la URL del calendario en Vercel." />;
  }
  return (
    <iframe
      src="/calendario"
      title="Calendario CDE"
      className="block h-[calc(100dvh-2rem)] w-full rounded-lg border md:h-[calc(100dvh-3rem)]"
    />
  );
}
