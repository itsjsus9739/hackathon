import type { Metadata } from "next";
import { Building2, Check, ShieldAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BONO_PERFIL_COMPLETO, perfilEmpresa, PUNTOS_POR_DATO } from "@/lib/gamificacion";
import { obtenerSesion } from "@/lib/sesion";
import { Constants } from "@/lib/supabase/database.types";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioMiEmpresa } from "./formulario";
import { RegistrarEmpresa } from "./registrar";

export const metadata: Metadata = { title: "Actualizar datos empresariales · CDE Conecta" };

// El emprendedor revisa y actualiza los datos de su empresa (en vez de importar bases, que es del CDE)
export default async function PaginaMiEmpresa() {
  const sesion = await obtenerSesion();
  if (sesion?.rol !== "emprendedor") {
    return (
      <Alert className="mx-auto max-w-xl">
        <ShieldAlert aria-hidden />
        <AlertTitle>Solo para emprendedores</AlertTitle>
        <AlertDescription>Aquí cada emprendedor actualiza los datos de su propia empresa.</AlertDescription>
      </Alert>
    );
  }

  const supabase = await crearClienteServidor();
  // RLS: el emprendedor solo recibe las empresas que representa o en las que es contacto
  const [empresas, sectores, solicitudes] = await Promise.all([
    supabase.from("empresas").select("id, nombre, nit, sector, tamano, municipio, formalizacion, descripcion, datos_estimados").order("nombre"),
    supabase.from("sectores").select("nombre").order("nombre"),
    supabase.from("solicitudes_empresa").select("id, nombre, estado, comentario_revision, creado_en").order("creado_en", { ascending: false }),
  ]);
  for (const r of [empresas, sectores, solicitudes]) {
    if (r.error) throw new Error(`No se pudieron consultar tus datos: ${r.error.message}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Actualizar datos empresariales</h1>
        <p className="text-muted-foreground text-sm">
          Mantén al día los datos de tu empresa: así el CDE te ofrece el acompañamiento, las capacitaciones y los eventos que
          te sirven.
        </p>
      </div>
      {(solicitudes.data ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mis solicitudes</CardTitle>
            <CardDescription>Empresas que enviaste al CDE para confirmar.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {(solicitudes.data ?? []).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-medium">{s.nombre}</span>
                  <span
                    className={
                      s.estado === "aprobada"
                        ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
                        : s.estado === "rechazada"
                          ? "rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800"
                          : "rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900"
                    }
                  >
                    {s.estado === "aprobada" ? "Confirmada" : s.estado === "rechazada" ? "No aprobada" : "En revisión"}
                  </span>
                  {s.estado === "rechazada" && s.comentario_revision && (
                    <p className="text-muted-foreground w-full text-xs">Motivo: {s.comentario_revision}</p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {empresas.data?.map((e) => (
        <Card key={e.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-5" aria-hidden /> {e.nombre}
            </CardTitle>
            <CardDescription>El CDE recibe un aviso cuando guardas cambios.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ProgresoPerfil empresa={e} />
            <FormularioMiEmpresa
              empresa={{ ...e, estimados: e.datos_estimados }}
              sectores={(sectores.data ?? []).map((s) => s.nombre)}
              tamanos={Constants.public.Enums.tamano_empresa}
            />
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-5" aria-hidden /> {empresas.data?.length ? "Agregar otra empresa" : "Registra tu empresa"}
          </CardTitle>
          <CardDescription>
            {empresas.data?.length
              ? "Si eres parte de otra empresa, envíala al CDE para vincularla a tu cuenta."
              : "Tu cuenta aún no tiene una empresa vinculada. Envía sus datos: un administrador del CDE confirmará que te pertenece."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegistrarEmpresa
            sectores={(sectores.data ?? []).map((s) => s.nombre)}
            tamanos={Constants.public.Enums.tamano_empresa}
            abierto={!empresas.data?.length}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/** Anillo «Tu empresa está al X %»: cada dato real suma puntos (la base los otorga al guardar, 0030). */
function ProgresoPerfil({ empresa }: { empresa: Parameters<typeof perfilEmpresa>[0] }) {
  const { campos, completos, porcentaje } = perfilEmpresa(empresa);
  const completo = completos === campos.length;
  const radio = 26;
  const circunferencia = 2 * Math.PI * radio;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-[var(--verde-suave)]/50 p-4 sm:flex-row sm:items-center">
      <div className="relative size-20 shrink-0 self-center" role="img" aria-label={`Perfil de la empresa al ${porcentaje} %`}>
        <svg viewBox="0 0 64 64" className="size-20 -rotate-90">
          <circle cx="32" cy="32" r={radio} fill="none" strokeWidth="7" className="stroke-foreground/10" />
          <circle
            cx="32"
            cy="32"
            r={radio}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            className="stroke-[var(--primario)] transition-[stroke-dashoffset] duration-1000"
            strokeDasharray={circunferencia}
            strokeDashoffset={circunferencia * (1 - porcentaje / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[var(--tinta)] tabular-nums">
          {porcentaje}%
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[var(--tinta)]">
          {completo ? "¡Perfil completo! Ganaste el bono" : `Tu empresa está al ${porcentaje} %`}
        </p>
        <p className="text-muted-foreground text-sm">
          {completo
            ? "Gracias: con tus datos el CDE te recomienda mejor."
            : `Gana +${PUNTOS_POR_DATO} pts por cada dato que completes o confirmes, y +${BONO_PERFIL_COMPLETO} al tenerlos todos.`}
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {campos.map((c) => (
            <li
              key={c.campo}
              className={
                c.completo
                  ? "flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
                  : "rounded-full border border-dashed px-2 py-0.5 text-xs text-[var(--primario-texto)]"
              }
            >
              {c.completo ? <Check className="size-3" aria-hidden /> : null}
              {c.etiqueta}
              {!c.completo && <b>+{PUNTOS_POR_DATO}</b>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
