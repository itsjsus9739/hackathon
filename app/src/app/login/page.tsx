import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { University } from "lucide-react";

import { BotonTema } from "@/components/tema/boton-tema";
import { obtenerSesion } from "@/lib/sesion";
import { FormularioIngreso, FormularioRegistro } from "./formulario-acceso";

export const metadata: Metadata = { title: "Ingresar · CDE Conecta" };

const ERRORES_ENLACE: Record<string, string> = {
  enlace: "El enlace no es válido o ya venció. Pide uno nuevo y ábrelo en el mismo navegador donde lo solicitaste.",
};

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ modo?: string; error?: string }> }) {
  const { modo, error } = await searchParams;
  if (await obtenerSesion()) redirect("/");
  const registro = modo === "registro";

  return (
    <main className="relative flex min-h-screen items-start justify-center overflow-hidden bg-[#1d2a24] px-4 py-8 sm:items-center sm:py-12">
      {/* Fondo: campus de la UNAB oscurecido, como el portal académico */}
      <Image src="/campus-unab.webp" alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-slate-950/65" aria-hidden />
      <BotonTema className="absolute top-3 right-3 z-10 bg-card/90 shadow" />

      <div className="relative w-full max-w-5xl rounded-md bg-card px-5 py-6 shadow-2xl sm:px-10 sm:py-9">
        <header className="flex items-start justify-between gap-4 border-b-2 border-[var(--primario)] pb-5 sm:items-center sm:pb-7">
          <h1 className="text-2xl leading-tight font-light text-[var(--primario-texto)] sm:text-3xl">
            CDE Conecta
            <span className="block">Centro de Desarrollo Empresarial</span>
          </h1>
          <div className="flex shrink-0 items-center gap-2 text-[var(--primario-texto)]" aria-label="Universidad Autónoma de Bucaramanga">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--primario)] text-white sm:size-12">
              <University className="size-6 sm:size-7" aria-hidden />
            </span>
            <span className="leading-none">
              <span className="block text-xs sm:text-sm">Universidad</span>
              <span className="block text-2xl font-extrabold tracking-tight sm:text-3xl">unab</span>
            </span>
          </div>
        </header>

        <p className="mt-6 text-center text-sm text-foreground sm:text-base">
          {registro
            ? "Crea tu cuenta: con correo @unab.edu.co entras al confirmar tu correo; con otro correo, el CDE aprueba tu acceso."
            : "Bienvenido(a) al portal del Centro de Desarrollo Empresarial, ingresa con tu correo para continuar:"}
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2 md:items-stretch">
          {/* Mosaico con foto, como las tarjetas de perfil del portal académico */}
          <div className="relative hidden min-h-56 overflow-hidden rounded border border-foreground/10 shadow-md md:block">
            <Image src="/campus-unab.webp" alt="" fill sizes="(min-width: 768px) 30rem, 0px" className="object-cover" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-950/55 p-6 text-center text-white">
              <p className="text-2xl font-bold">{registro ? "Crea tu cuenta" : "Ingresa"}</p>
              <p className="text-sm text-white/85">Estudiantes, docentes, emprendedores y equipo del CDE</p>
            </div>
          </div>

          <div className="space-y-4 rounded border border-foreground/10 p-5 shadow-md sm:p-6">
            <h2 className="text-lg font-semibold text-foreground md:sr-only">{registro ? "Crea tu cuenta" : "Ingresa"}</h2>
            {error && ERRORES_ENLACE[error] && (
              <p className="text-destructive text-sm" role="alert">
                {ERRORES_ENLACE[error]}
              </p>
            )}
            {registro ? <FormularioRegistro /> : <FormularioIngreso />}
          </div>
        </div>
      </div>
    </main>
  );
}
