import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CDE Conecta · UNAB",
  description: "Sistema integrado de gestión de la información del Centro de Desarrollo Empresarial UNAB",
};

// viewport-fit=cover: en iPhone las barras fijas respetan la muesca y el indicador de inicio (safe-area)
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
