import { PantallaBuho } from "@/components/buho/pantalla-buho";

export const metadata = { title: "Página no encontrada · CDE Conecta" };

// 404 global: cualquier ruta que no exista.
export default function NoEncontrada() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--panel)]">
      <PantallaBuho
        sprite="error-404"
        etiqueta="Error 404"
        titulo="¡Uy! Esta página se nos voló"
        descripcion={
          <p>
            Nuestro búho buscó por todas partes y no encontró lo que pediste. Puede que el enlace esté mal escrito o
            que esta sección todavía no exista.
          </p>
        }
        acciones={[
          { href: "/", etiqueta: "Volver al inicio" },
          { href: "/empresas", etiqueta: "Ver empresas" },
        ]}
      />
    </main>
  );
}
