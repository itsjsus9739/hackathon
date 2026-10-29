import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { cerrarSesion } from "@/app/login/actions";
import { RecorridoBuho } from "@/components/buho/recorrido-buho";
import { BarraMovil } from "@/components/navegacion/barra-movil";
import { EnlacesModulos } from "@/components/navegacion/enlaces-modulos";
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
      <nav
        data-recorrido="menu"
        className="sticky top-0 hidden h-dvh w-52 shrink-0 lg:w-60 flex-col gap-1 overflow-y-auto border-r bg-[var(--panel)] p-4 md:flex"
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-lg font-semibold">CDE Conecta</p>
          <Campana />
        </div>
        <EnlacesModulos />
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
      <div className="flex min-w-0 flex-1 flex-col">
        {/* En celular el menú lateral no se muestra: barra superior con la campana y barra inferior con los módulos */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-[var(--panel)]/95 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
          <Link href="/" className="font-semibold">
            CDE Conecta
          </Link>
          <Campana />
        </header>
        <main className="min-w-0 flex-1 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">{children}</main>
      </div>
      <BarraMovil nombre={sesion.nombre} rol={ETIQUETA_ROL[sesion.rol]} />
      <RecorridoBuho idUsuario={sesion.id} rol={sesion.rol} nombre={sesion.nombre} />
    </div>
  );
}
