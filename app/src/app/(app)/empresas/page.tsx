import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Constants } from "@/lib/supabase/database.types";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Empresas · CDE Conecta" };

const POR_PAGINA = 25;
type Filtros = { q?: string; sector?: string; tamano?: string; pagina?: string };

// Quita los caracteres con significado en los filtros de PostgREST (coma, paréntesis, comodines)
const limpiarBusqueda = (q: string) => q.replace(/[,()%*\\]/g, " ").trim().slice(0, 80);

export default async function PaginaEmpresas({ searchParams }: { searchParams: Promise<Filtros> }) {
  const filtros = await searchParams;
  const q = limpiarBusqueda(filtros.q ?? "");
  const pagina = Math.max(1, Number.parseInt(filtros.pagina ?? "1", 10) || 1);
  const tamano = Constants.public.Enums.tamano_empresa.find((t) => t === filtros.tamano);
  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("empresas")
    .select("id, nombre, nit, sector, tamano, municipio", { count: "exact" })
    .order("nombre")
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (q) {
    const soloDigitos = q.replace(/\D/g, "");
    consulta = soloDigitos.length >= 5 ? consulta.like("nit", `%${soloDigitos}%`) : consulta.ilike("nombre", `%${q}%`);
  }
  if (filtros.sector) consulta = consulta.eq("sector", filtros.sector);
  if (tamano) consulta = consulta.eq("tamano", tamano);

  const [{ data: empresas, count, error }, { data: sectores }] = await Promise.all([
    consulta,
    supabase.from("sectores").select("nombre").order("nombre"),
  ]);
  if (error) throw new Error(`No se pudo consultar las empresas: ${error.message}`);

  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const enlacePagina = (n: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (filtros.sector) p.set("sector", filtros.sector);
    if (tamano) p.set("tamano", tamano);
    p.set("pagina", String(n));
    return `/empresas?${p}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Empresas</h1>
        <p className="text-muted-foreground text-sm">Busca una empresa para abrir su Ficha 360°.</p>
      </div>

      <form data-recorrido="empresas-buscador" className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_12rem_10rem_auto]" role="search">
        <div className="relative col-span-2 sm:col-span-1">
          <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Nombre o NIT" className="pl-9" aria-label="Buscar por nombre o NIT" />
        </div>
        <NativeSelect name="sector" defaultValue={filtros.sector ?? ""} aria-label="Sector">
          <option value="">Todos los sectores</option>
          {sectores?.map((s) => (
            <option key={s.nombre} value={s.nombre}>
              {s.nombre}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="tamano" defaultValue={tamano ?? ""} aria-label="Tamaño">
          <option value="">Todos los tamaños</option>
          {Constants.public.Enums.tamano_empresa.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" className="col-span-2 sm:col-span-1">
          Buscar
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {total} {total === 1 ? "empresa" : "empresas"}
          </CardTitle>
          {(q || filtros.sector || tamano) && (
            <CardDescription>
              <Link href="/empresas" className="underline underline-offset-4">
                Quitar filtros
              </Link>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="px-0">
          {!empresas?.length ? (
            <p className="text-muted-foreground px-6 py-8 text-center text-sm">No hay empresas con esos criterios.</p>
          ) : (
            <ul className="divide-y">
              {empresas.map((e) => (
                <li key={e.id}>
                  <Link href={`/empresas/${e.id}`} className="hover:bg-muted flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-6">
                    <Building2 className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium">{e.nombre}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {e.sector && <Badge variant="secondary">{e.sector}</Badge>}
                      {e.tamano && <Badge variant="outline">{e.tamano}</Badge>}
                    </span>
                    <span className="text-muted-foreground w-full text-xs sm:w-40 sm:text-right">
                      {[e.municipio, e.nit && `NIT ${e.nit}`].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {paginas > 1 && (
        <nav className="flex items-center justify-between" aria-label="Paginación">
          <Link
            href={enlacePagina(pagina - 1)}
            aria-disabled={pagina <= 1}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), pagina <= 1 && "pointer-events-none opacity-50")}
          >
            <ChevronLeft aria-hidden /> Anterior
          </Link>
          <span className="text-muted-foreground text-sm">
            Página {pagina} de {paginas}
          </span>
          <Link
            href={enlacePagina(pagina + 1)}
            aria-disabled={pagina >= paginas}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), pagina >= paginas && "pointer-events-none opacity-50")}
          >
            Siguiente <ChevronRight aria-hidden />
          </Link>
        </nav>
      )}
    </div>
  );
}
