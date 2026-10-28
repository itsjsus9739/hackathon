import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CDE Conecta · UNAB",
  description: "Sistema integrado de gestión de la información del Centro de Desarrollo Empresarial UNAB",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
