"use client";

import { useActionState, useState, useTransition } from "react";
import { Building2, CircleCheck, Loader2, MapPin, Search, TriangleAlert, UserPlus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buscarEmpresaRegistro, unirseAEmpresa, type EmpresaEncontrada } from "./actions";
import { RegistrarEmpresa } from "./registrar";

const CARGOS = ["Fundador(a)", "Gerente", "Socio(a)", "Representante legal", "Empleado(a)", "Administrador(a)"];

/**
 * Paso 1: buscar la empresa por NIT o nombre. Si ya está en la base, el emprendedor pide unirse
 * (solo dice su cargo); si no, la registra como nueva con lo que ya escribió.
 */
export function VincularEmpresa({ sectores, tamanos, tieneEmpresas }: { sectores: string[]; tamanos: readonly string[]; tieneEmpresas: boolean }) {
  const [texto, setTexto] = useState("");
  const [buscado, setBuscado] = useState<string | null>(null);
  const [resultados, setResultados] = useState<EmpresaEncontrada[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nueva, setNueva] = useState(false);
  const [buscando, iniciar] = useTransition();

  const buscar = () =>
    iniciar(async () => {
      setError(null);
      setNueva(false);
      const r = await buscarEmpresaRegistro(texto);
      if (r.error) return setError(r.error);
      setResultados(r.resultados ?? []);
      setBuscado(texto.trim());
    });

  const pareceNit = (t: string) => /^[\d.\s-]+$/.test(t);

  return (
    <div className="space-y-4">
      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          buscar();
        }}
      >
        <Label htmlFor="buscar-empresa">Busca tu empresa por NIT o nombre</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" aria-hidden />
            <Input
              id="buscar-empresa"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={120}
              placeholder="Ej. 900.123.456-7 o Panadería La Espiga"
              className="pl-9"
            />
          </div>
          <Button type="submit" disabled={buscando || texto.trim().length < 3}>
            {buscando ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />} Buscar
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">Si ya está en la base del CDE no tendrás que escribir sus datos: solo pides unirte.</p>
      </form>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {buscado !== null && (
        <div className="space-y-3" aria-live="polite">
          {resultados.length ? (
            <>
              <p className="text-sm font-medium">{resultados.length === 1 ? "Encontramos esta empresa en la base del CDE:" : "Encontramos estas empresas en la base del CDE:"}</p>
              <ul className="space-y-2">
                {resultados.map((r) => (
                  <ResultadoEmpresa key={r.id} empresa={r} />
                ))}
              </ul>
            </>
          ) : (
            <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-center text-sm">
              No encontramos «{buscado}» en la base del CDE. Puedes registrarla como nueva.
            </p>
          )}

          {!nueva ? (
            <Button variant="outline" onClick={() => setNueva(true)}>
              <Building2 aria-hidden /> {resultados.length ? "No es ninguna de estas: registrar una empresa nueva" : "Registrar empresa nueva"}
            </Button>
          ) : (
            <div className="rounded-2xl border p-4">
              <p className="mb-3 text-sm font-semibold">Empresa nueva</p>
              <RegistrarEmpresa
                sectores={sectores}
                tamanos={tamanos}
                abierto
                inicial={pareceNit(buscado) ? { nit: buscado } : { nombre: buscado }}
              />
            </div>
          )}
        </div>
      )}

      {buscado === null && !tieneEmpresas && (
        <p className="text-muted-foreground text-xs">¿Tu emprendimiento aún no tiene NIT? Búscalo por su nombre; si no aparece, podrás registrarlo como nuevo.</p>
      )}
    </div>
  );
}

function ResultadoEmpresa({ empresa: e }: { empresa: EmpresaEncontrada }) {
  const [estado, accion, enviando] = useActionState(unirseAEmpresa, undefined);
  const yaPedida = e.solicitud_pendiente || Boolean(estado?.ok);

  return (
    <li className="bg-card rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{e.nombre}</p>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-xs">
            {e.nit && <span>NIT {e.nit}</span>}
            {e.municipio && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" aria-hidden /> {e.municipio}
              </span>
            )}
            {e.sector && <span>{e.sector}</span>}
          </p>
        </div>
        {e.vinculada ? (
          <Badge className="bg-emerald-100 text-emerald-800">Ya es tuya</Badge>
        ) : yaPedida ? (
          <Badge className="bg-amber-100 text-amber-900">Solicitud en revisión</Badge>
        ) : null}
      </div>

      {!e.vinculada && !yaPedida && (
        <form action={accion} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="empresa" value={e.id} />
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor={`cargo-${e.id}`}>¿Cuál es tu cargo?</Label>
            <Input id={`cargo-${e.id}`} name="cargo" list="cargos-empresa" maxLength={120} placeholder="Ej. Gerente, socia, fundador" />
          </div>
          <Button type="submit" disabled={enviando}>
            {enviando ? <Loader2 className="animate-spin" aria-hidden /> : <UserPlus aria-hidden />} Soy parte de esta empresa
          </Button>
          <datalist id="cargos-empresa">
            {CARGOS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="text-muted-foreground w-full text-xs">
            {e.tiene_representante
              ? "Ya tiene un representante: al confirmarlo el CDE, quedarás como miembro y también podrás actualizar sus datos."
              : "Aún no tiene representante: al confirmarlo el CDE, quedarás como su representante."}
          </p>
        </form>
      )}

      {estado?.error && (
        <p className="text-destructive mt-2 text-sm" role="alert">
          {estado.error}
        </p>
      )}
      {estado?.ok && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[var(--primario-texto)]" role="status">
          <CircleCheck className="size-4" aria-hidden /> {estado.ok}
        </p>
      )}
    </li>
  );
}
