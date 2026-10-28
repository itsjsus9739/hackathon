import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CDE Conecta · UNAB",
  description: "Sistema integrado de gestión de la información del Centro de Desarrollo Empresarial UNAB",
};

const MODULOS = [
  { href: "/", etiqueta: "Inicio" },
  { href: "/empresas", etiqueta: "Empresas" },
  { href: "/importar", etiqueta: "Importar y depurar" },
  { href: "/planes", etiqueta: "Planes de acción" },
  { href: "/citas", etiqueta: "Citas" },
  { href: "/eventos", etiqueta: "Eventos" },
  { href: "/formacion", etiqueta: "Formación y recompensas" },
  { href: "/conocimiento", etiqueta: "Conocimiento" },
  { href: "/portal", etiqueta: "Portal del emprendedor" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased">
        <div className="flex min-h-screen">
          <nav className="hidden w-60 shrink-0 flex-col gap-1 border-r border-black/10 bg-[var(--panel)] p-4 md:flex">
            <p className="mb-4 text-lg font-semibold">CDE Conecta</p>
            {MODULOS.map((m) => (
              <Link key={m.href} href={m.href} className="rounded-md px-3 py-2 text-sm hover:bg-black/5">
                {m.etiqueta}
              </Link>
            ))}
          </nav>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
