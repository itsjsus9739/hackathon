"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Verificar otro código escribiéndolo a mano. */
export function FormularioVerificar() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const limpio = codigo.trim().toUpperCase();
        if (limpio) router.push(`/verificar/${encodeURIComponent(limpio)}`);
      }}
    >
      <Input
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        placeholder="CDE-XXXX-XXXX"
        aria-label="Código del certificado"
        className="bg-card font-mono uppercase"
        maxLength={20}
      />
      <Button type="submit" variant="outline">
        <Search aria-hidden /> Verificar
      </Button>
    </form>
  );
}
