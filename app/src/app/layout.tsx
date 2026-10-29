import type { Metadata, Viewport } from "next";
import { SCRIPT_TEMA } from "@/lib/tema";
import "./globals.css";

export const metadata: Metadata = {
  title: "CDE Conecta · UNAB",
  description: "Sistema integrado de gestión de la información del Centro de Desarrollo Empresarial UNAB",
};

// viewport-fit=cover: en iPhone las barras fijas respetan la muesca y el indicador de inicio (safe-area)
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#101b17" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // La clase .dark la pone el script antes de hidratar: React no debe quejarse de la diferencia
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
