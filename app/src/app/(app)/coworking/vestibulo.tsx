"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { DoorOpen, Loader2, Lock, LockOpen, Plus, Trash2, Users } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { borrarSala, crearSala, unirseSala } from "./actions";

export type SalaLista = {
  id: string;
  nombre: string;
  tieneClave: boolean;
  soyMiembro: boolean;
  miembros: number;
  creador: string;
  puedoBorrar: boolean;
};

export function Vestibulo({ salas, error }: { salas: SalaLista[]; error?: string }) {
  const [estadoCrear, accionCrear, creando] = useActionState(crearSala, undefined);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-3">
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Card data-recorrido="coworking-principal">
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">Sala principal</p>
              <p className="text-muted-foreground text-sm">Abierta para toda la comunidad del CDE.</p>
            </div>
            <Link href="/coworking?sala=principal" className={buttonVariants()}>
              <DoorOpen aria-hidden /> Entrar
            </Link>
          </CardContent>
        </Card>
        {salas.length === 0 && (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            Aún no hay salas de equipo. Crea una para trabajar con tu proyecto.
          </p>
        )}
        {salas.map((s) => (
          <TarjetaSala key={s.id} sala={s} />
        ))}
      </div>

      <Card className="h-fit" data-recorrido="coworking-crear">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4" aria-hidden /> Crear sala
          </CardTitle>
          <CardDescription>Con contraseña solo entra quien la conozca. Déjala vacía para una sala abierta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={accionCrear} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="nombre-sala">Nombre</Label>
              <Input id="nombre-sala" name="nombre" required minLength={3} maxLength={60} placeholder="Ej.: Equipo Kinetics" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="clave-sala">Contraseña (opcional)</Label>
              <Input id="clave-sala" name="clave" type="password" autoComplete="new-password" maxLength={72} />
            </div>
            {estadoCrear?.error && <p className="text-destructive text-xs">{estadoCrear.error}</p>}
            <Button type="submit" className="w-full" disabled={creando}>
              {creando && <Loader2 className="animate-spin" aria-hidden />} Crear y entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function TarjetaSala({ sala }: { sala: SalaLista }) {
  const [estado, accion, entrando] = useActionState(unirseSala, undefined);
  const [borrando, iniciarBorrado] = useTransition();
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null);
  const necesitaClave = sala.tieneClave && !sala.soyMiembro;

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-medium">
              {sala.tieneClave ? <Lock className="size-4" aria-label="Con contraseña" /> : <LockOpen className="size-4" aria-label="Abierta" />}
              {sala.nombre}
            </p>
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              <Users className="size-3.5" aria-hidden /> {sala.miembros} {sala.miembros === 1 ? "miembro" : "miembros"} · creada por {sala.creador}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {sala.soyMiembro ? (
              <Link href={`/coworking?sala=${sala.id}`} className={buttonVariants({ size: "sm" })}>
                <DoorOpen aria-hidden /> Entrar
              </Link>
            ) : (
              !necesitaClave && (
                <form action={accion}>
                  <input type="hidden" name="sala" value={sala.id} />
                  <Button size="sm" type="submit" disabled={entrando}>
                    <DoorOpen aria-hidden /> Unirme
                  </Button>
                </form>
              )
            )}
            {sala.puedoBorrar && (
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Borrar la sala ${sala.nombre}`}
                disabled={borrando}
                onClick={() =>
                  confirm(`¿Borrar la sala «${sala.nombre}» y su chat?`) &&
                  iniciarBorrado(async () => {
                    const r = await borrarSala(sala.id);
                    setErrorBorrar(r?.error ?? null);
                  })
                }
              >
                <Trash2 aria-hidden />
              </Button>
            )}
          </div>
        </div>
        {necesitaClave && (
          <form action={accion} className="flex flex-wrap gap-2">
            <input type="hidden" name="sala" value={sala.id} />
            <Input
              name="clave"
              type="password"
              required
              aria-label={`Contraseña de ${sala.nombre}`}
              placeholder="Contraseña"
              autoComplete="off"
              className="max-w-56"
            />
            <Button size="sm" type="submit" disabled={entrando} className="h-9">
              {entrando && <Loader2 className="animate-spin" aria-hidden />} Entrar con contraseña
            </Button>
          </form>
        )}
        {(estado?.error || errorBorrar) && <p className="text-destructive text-xs">{estado?.error ?? errorBorrar}</p>}
      </CardContent>
    </Card>
  );
}
