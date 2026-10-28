import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { cerrarSesion } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { ETIQUETA_ROL, obtenerSesion } from "@/lib/sesion";

const MODULOS = [
  { href: "/", etiqueta: "Inicio" },
  { href: "/empresas", etiqueta: "Empresas" },
  { href: "/importar", etiqueta: "Importar y depurar" },
  { href: "/citas", etiqueta: "Citas" },
  { href: "/eventos", etiqueta: "Eventos" },
  { href: "/formacion", etiqueta: "Formación y recompensas" },
  { href: "/conocimiento", etiqueta: "Conocimiento" },
  { href: "/portal", etiqueta: "Portal del emprendedor" },
];

// Puerta de entrada: sin sesión → /login; sin acceso aprobado → /solicitud.
// (RLS ya protege los datos; esto solo lleva a cada quien a la pantalla correcta.)
export default async function LayoutAplicacion({ children }: { children: React.ReactNode }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.estadoAcceso !== "aprobado") redirect("/solicitud");

  return (
    <div className="flex min-h-screen">
      <nav className="hidden w-60 shrink-0 flex-col gap-1 border-r bg-[var(--panel)] p-4 md:flex">
        <p className="mb-4 text-lg font-semibold">CDE Conecta</p>
        {MODULOS.map((m) => (
          <Link key={m.href} href={m.href} className="rounded-md px-3 py-2 text-sm hover:bg-black/5">
            {m.etiqueta}
          </Link>
        ))}
        <div className="mt-auto border-t pt-4">
          <p className="truncate text-sm font-medium">{sesion.nombre}</p>
          <p className="text-muted-foreground text-xs">{ETIQUETA_ROL[sesion.rol]}</p>
          <form action={cerrarSesion} className="mt-2">
            <Button type="submit" variant="ghost" size="sm" className="-ml-2">
              <LogOut aria-hidden /> Cerrar sesión
            </Button>
          </form>
        </div>
      </nav>
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
