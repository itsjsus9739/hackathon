import type { NextConfig } from "next";

// URL del proyecto del calendario (Flask) en Vercel, p. ej. https://cde-calendario.vercel.app.
// Se sirve bajo /calendario en el mismo dominio para que la cookie de sesión funcione dentro del iframe.
const calendarioUrl = process.env.CALENDARIO_URL?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!calendarioUrl) return [];
    return [
      { source: "/calendario", destination: `${calendarioUrl}/` },
      { source: "/calendario/api/:path*", destination: `${calendarioUrl}/api/:path*` },
    ];
  },
};

export default nextConfig;
