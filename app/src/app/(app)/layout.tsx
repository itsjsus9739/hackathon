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
/** "María Clemencia Custodio" → "MC" (o la primera letra del correo si no hay nombre). */
function iniciales(nombre: string) {
  const partes = nombre.includes("@") ? [nombre] : nombre.trim().split(/\s+/);
  return partes
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function LayoutAplicacion({ children }: { children: React.ReactNode }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.estadoAcceso !== "aprobado") redirect("/solicitud");

  return (
    <div className="flex min-h-screen">
      <nav
        data-recorrido="menu"
        className="sticky top-0 hidden h-screen w-[17rem] shrink-0 flex-col overflow-y-auto border-r bg-[var(--panel)] p-4 md:flex"
      >
        <Link href="/" className="mb-3 flex items-center gap-3 pl-1">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primario)] text-[15px] font-extrabold tracking-tight text-white">
            Cde
          </span>
          <span className="text-[var(--tinta)]">
            <span className="block text-lg leading-tight font-bold tracking-tight">CDE Conecta</span>
            <span className="text-muted-foreground block text-xs leading-snug">Centro de Desarrollo Empresarial</span>
          </span>
        </Link>
        <MenuLateral />
        <div className="mt-auto flex items-center gap-2.5 rounded-2xl border p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7ed8a9] to-[var(--primario)] text-sm font-bold text-white">
            {iniciales(sesion.nombre)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[13px] leading-tight font-semibold text-[var(--tinta)]">{sesion.nombre}</p>
            <p className="text-muted-foreground text-xs">{ETIQUETA_ROL[sesion.rol]}</p>
          </div>
          <form action={cerrarSesion}>
            <Button type="submit" variant="ghost" size="icon" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut className="text-[#8ba597]" aria-hidden />
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
        <div className="hidden justify-end px-6 pt-4 md:flex">
          <Campana className="rounded-full border bg-white" />
        </div>
        <main className="min-w-0 flex-1 p-4 md:px-6 md:pt-0 md:pb-6">{children}</main>
      </div>
      <RecorridoBuho idUsuario={sesion.id} rol={sesion.rol} nombre={sesion.nombre} />
    </div>
  );
}
