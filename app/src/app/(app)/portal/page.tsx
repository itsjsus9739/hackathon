import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Eye, KeyRound, Search } from "lucide-react";

import { PantallaBuho } from "@/components/buho/pantalla-buho";
import { VistaPortal } from "@/components/portal/vista-portal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { esUuid } from "@/lib/empresas";
import { esRolCde } from "@/lib/navegacion";
import type { PortalDatos } from "@/lib/portal";
import { ETIQUETA_ROL } from "@/lib/roles";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { AccesosEstudiantes, SolicitarAcceso } from "./accesos";

export const metadata: Metadata = { title: "Portal del emprendedor · CDE Conecta" };

type Filtros = { empresa?: string; q?: string };

// Portal del emprendedor: capa de solo lectura sobre los módulos existentes.
// Quién ve qué lo decide la base (puede_ver_portal / portal_datos, 0029_portal_emprendedor.sql):
// el emprendedor su empresa, el CDE todas, el docente las de sus proyectos y el estudiante solo con acceso del CDE.
export default async function PaginaPortal({ searchParams }: { searchParams: Promise<Filtros> }) {
  const sesion = await obtenerSesion();
  if (!sesion) return null; // el layout ya redirige a /login
  const { empresa: pedida, q } = await searchParams;
  const supabase = await crearClienteServidor();
  const cde = esRolCde(sesion.rol);

  const { data: permitidas, error } = await supabase.rpc("portal_empresas", { texto: cde ? (q ?? null) : null });
  if (error) throw new Error(`No se pudo consultar el portal: ${error.message}`);
  const lista = permitidas ?? [];

  // El emprendedor entra directo a su empresa; los demás eligen (o llegan con ?empresa=)
  const empresa = pedida && esUuid(pedida) ? pedida : sesion.rol === "emprendedor" && lista.length ? lista[0].id : null;

  if (!empresa) {
    if (sesion.rol === "emprendedor") {
      return (
        <PantallaBuho
          sprite="mantenimiento"
          etiqueta="Portal del emprendedor"
          titulo="Tu cuenta aún no está vinculada a una empresa"
          descripcion={<p>Registra tu emprendimiento: cuando un administrador del CDE lo confirme, verás aquí tu ruta, tus compromisos y tus oportunidades.</p>}
          acciones={[{ href: "/mi-empresa", etiqueta: "Registrar mi empresa" }]}
        />
      );
    }
    if (sesion.rol === "estudiante") return <PortalEstudiante sinAcceso={!lista.length} lista={lista} />;
    return <Selector cde={cde} lista={lista} q={q ?? ""} rol={ETIQUETA_ROL[sesion.rol]} />;
  }

  const { data, error: errorDatos } = await supabase.rpc("portal_datos", { empresa });
  if (errorDatos || !data) {
    const sinPermiso = errorDatos?.message.includes("No tienes acceso");
    if (!sinPermiso && errorDatos) throw new Error(`No se pudo cargar el portal: ${errorDatos.message}`);
    if (sesion.rol === "estudiante") return <PortalEstudiante sinAcceso lista={lista} />;
    return (
      <PantallaBuho
        sprite="acceso-denegado"
        titulo="No tienes acceso a este portal"
        descripcion={<p>Solo lo ven el emprendedor, el equipo del CDE y el docente de un proyecto de aula de esa empresa.</p>}
        acciones={[{ href: "/portal", etiqueta: "Volver" }]}
      />
    );
  }
  const datos = data as unknown as PortalDatos;
  const propio = sesion.rol === "emprendedor" && lista.some((e) => e.id === empresa);
  const primerNombre = sesion.nombre.includes("@") ? "" : sesion.nombre.trim().split(/\s+/)[0];

  // CDE: accesos de estudiantes a este portal
  let panelAccesos: React.ReactNode = null;
  if (cde) {
    const [accesos, directorio] = await Promise.all([
      supabase.from("accesos_portal").select("id, id_estudiante, estado, motivo").eq("id_empresa", empresa).order("creado_en", { ascending: false }),
      supabase.rpc("directorio"),
    ]);
    const nombres = new Map((directorio.data ?? []).map((p) => [p.id, p.nombre]));
    panelAccesos = (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-5 text-[var(--primario-texto)]" aria-hidden /> Acceso de estudiantes a este portal
          </CardTitle>
          <CardDescription>Los estudiantes solo ven el portal de una empresa si el CDE se lo permite. Puedes revocarlo cuando quieras.</CardDescription>
        </CardHeader>
        <CardContent>
          <AccesosEstudiantes
            empresa={empresa}
            accesos={(accesos.data ?? []).map((a) => ({ id: a.id, estudiante: nombres.get(a.id_estudiante) ?? "Estudiante", estado: a.estado, motivo: a.motivo }))}
            estudiantes={(directorio.data ?? []).filter((p) => p.rol === "estudiante").map((p) => ({ id: p.id, nombre: p.nombre }))}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {!propio && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900 dark:bg-sky-500/10 dark:text-sky-100">
          <span className="flex items-center gap-2">
            <Eye className="size-4" aria-hidden /> Estás viendo el portal de <b>{datos.empresa.nombre}</b> como {ETIQUETA_ROL[sesion.rol]} · solo lectura
          </span>
          {(cde || lista.length > 1 || sesion.rol !== "emprendedor") && (
            <Link href="/portal" className="inline-flex items-center gap-1 font-semibold underline underline-offset-4">
              <ArrowLeft className="size-3.5" aria-hidden /> Elegir otra empresa
            </Link>
          )}
        </div>
      )}
      {propio && lista.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label="Mis empresas">
          {lista.map((e) => (
            <Link
              key={e.id}
              href={`/portal?empresa=${e.id}`}
              aria-current={e.id === empresa ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${e.id === empresa ? "border-[var(--primario)] bg-[var(--verde-suave)] font-semibold" : "bg-card"}`}
            >
              {e.nombre}
            </Link>
          ))}
        </nav>
      )}
      <VistaPortal
        datos={datos}
        modo={propio ? "propio" : "lectura"}
        verFicha={cde || sesion.rol === "docente"}
        saludo={propio ? `¡Hola${primerNombre ? `, ${primerNombre}` : ""}! Este es tu portal` : "Portal del emprendedor"}
      />
      {panelAccesos}
    </div>
  );
}

type EmpresaPermitida = { id: string; nombre: string; municipio: string | null; representante: string | null; motivo: string };

/** CDE y docente: elegir de qué empresa ver el portal. */
function Selector({ cde, lista, q, rol }: { cde: boolean; lista: EmpresaPermitida[]; q: string; rol: string }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Image src="/buho/buho-buscando-datos.png" alt="" width={397} height={382} className="hidden h-auto w-20 sm:block" />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--tinta)]">Portal del emprendedor</h1>
          <p className="text-muted-foreground text-sm">
            {cde
              ? "Como equipo del CDE puedes ver el portal de cualquier emprendimiento, tal como lo ve su emprendedor (solo lectura)."
              : `Como ${rol} ves el portal de las empresas de tus proyectos de aula (solo lectura).`}
          </p>
        </div>
      </div>
      {cde && (
        <form className="flex gap-2" role="search">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" aria-hidden />
            <Input name="q" defaultValue={q} placeholder="Buscar empresa por nombre o NIT" className="pl-9" aria-label="Buscar empresa" />
          </div>
          <Button type="submit">Buscar</Button>
        </form>
      )}
      {lista.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {lista.map((e) => (
            <li key={e.id}>
              <Link href={`/portal?empresa=${e.id}`} className="flex flex-col rounded-xl border bg-card p-3 transition hover:border-[var(--primario)]">
                <span className="font-semibold">{e.nombre}</span>
                <span className="text-muted-foreground text-xs">
                  {[e.municipio, e.representante ? `Emprendedor: ${e.representante}` : "Sin emprendedor con cuenta"].filter(Boolean).join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          {cde ? "No hay empresas con ese nombre." : "Aún no tienes empresas en tus proyectos de aula."}
        </p>
      )}
    </div>
  );
}

/** Estudiante: sin acceso pide permiso al CDE; con acceso elige la empresa. */
async function PortalEstudiante({ sinAcceso, lista }: { sinAcceso: boolean; lista: EmpresaPermitida[] }) {
  const supabase = await crearClienteServidor();
  // Empresas de sus proyectos (RLS) y sus solicitudes
  const [proyectos, solicitudes] = await Promise.all([
    supabase.from("proyectos_aula").select("id_empresa, empresas (id, nombre)"),
    supabase.from("accesos_portal").select("id, estado, empresas (nombre)").order("creado_en", { ascending: false }),
  ]);
  const empresas = [
    ...new Map((proyectos.data ?? []).filter((p) => p.empresas).map((p) => [p.empresas!.id, { id: p.empresas!.id, nombre: p.empresas!.nombre }])).values(),
  ];
  const ESTADO: Record<string, string> = { pendiente: "Pendiente de revisión", aprobado: "Con acceso", rechazado: "No aprobado", revocado: "Acceso revocado" };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex flex-col items-center text-center">
        <Image src="/buho/buho-acceso-denegado.png" alt="" width={397} height={382} className="h-auto w-40" />
        <h1 className="mt-2 text-2xl font-semibold text-[var(--tinta)]">Portal del emprendedor</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {sinAcceso
            ? "El portal muestra datos privados de cada emprendimiento. Para verlo necesitas que un miembro del CDE te dé acceso."
            : "Tienes acceso al portal de estas empresas:"}
        </p>
      </div>
      {!sinAcceso && (
        <ul className="grid gap-2">
          {lista.map((e) => (
            <li key={e.id}>
              <Link href={`/portal?empresa=${e.id}`} className="block rounded-xl border bg-card p-3 font-semibold hover:border-[var(--primario)]">
                {e.nombre}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedir acceso</CardTitle>
          <CardDescription>El CDE recibe tu solicitud en la campana y te avisa cuando la revise.</CardDescription>
        </CardHeader>
        <CardContent>
          <SolicitarAcceso empresas={empresas} />
        </CardContent>
      </Card>
      {!!solicitudes.data?.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mis solicitudes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {solicitudes.data.map((s) => (
                <li key={s.id} className="flex justify-between gap-2 py-2">
                  <span>{s.empresas?.nombre ?? "Empresa"}</span>
                  <span className="text-muted-foreground">{ESTADO[s.estado] ?? s.estado}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
