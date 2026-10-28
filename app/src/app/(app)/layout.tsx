import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { cerrarSesion } from "@/app/login/actions";
import { RecorridoBuho } from "@/components/buho/recorrido-buho";
import { MenuLateral } from "@/components/navegacion/menu-lateral";
import { Campana } from "@/components/notificaciones/campana";
import { Button } from "@/components/ui/button";
import { ETIQUETA_ROL, obtenerSesion } from "@/lib/sesion";


// Puerta de entrada: sin sesión → /login; sin acceso aprobado → /solicitud.
// (RLS ya protege los datos; esto solo lleva a cada quien a la pantalla correcta.)
export default async function LayoutAplicacion({ children }: { children: React.ReactNode }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.estadoAcceso !== "aprobado") redirect("/solicitud");

  return (
    <div className="flex min-h-screen">
      <nav data-recorrido="menu" className="hidden w-[17rem] shrink-0 flex-col gap-0.5 border-r bg-[var(--panel)] p-4 md:flex">
        <div className="mb-5 flex items-center justify-between pl-1">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-[var(--primario)] text-sm font-extrabold tracking-tight text-white">
              Cde
            </span>
            <span className="text-[var(--tinta)]">
              <span className="block leading-tight font-semibold">CDE Conecta</span>
              <span className="text-muted-foreground block text-[11px] leading-tight">UNAB</span>
            </span>
          </Link>
          <Campana />
        </div>
        <MenuLateral />
        <div className="mt-auto rounded-2xl border p-3">
          <p className="truncate text-sm font-semibold text-[var(--tinta)]">{sesion.nombre}</p>
          <p className="text-muted-foreground text-xs">{ETIQUETA_ROL[sesion.rol]}</p>
          <form action={cerrarSesion} className="mt-1">
            <Button type="submit" variant="ghost" size="sm" className="-ml-2">
              <LogOut aria-hidden /> Cerrar sesión
            </Button>
          </form>
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* En celular el menú lateral no se muestra: barra superior con la campana */}
        <header className="flex items-center justify-between border-b bg-[var(--panel)] px-4 py-2 md:hidden">
          <Link href="/" className="font-semibold">
            CDE Conecta
          </Link>
          <Campana />
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
      <RecorridoBuho idUsuario={sesion.id} rol={sesion.rol} nombre={sesion.nombre} />
    </div>
  );
}
