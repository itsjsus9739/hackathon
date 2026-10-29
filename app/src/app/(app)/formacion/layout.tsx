import { esCde } from "@/lib/gamificacion";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { Pestanas } from "./pestanas";

export default async function LayoutFormacion({ children }: { children: React.ReactNode }) {
  const sesion = await obtenerSesion();
  if (!sesion) return null; // el layout de la app ya redirige
  const cde = esCde(sesion.rol);
  const revisa = cde || sesion.rol === "docente";
  const supabase = await crearClienteServidor();

  // Contadores de pendientes: aportes por validar (docente/CDE) y canjes por entregar (CDE). RLS limita lo que se cuenta.
  const [aportes, canjes] = await Promise.all([
    revisa
      ? supabase.from("aportes").select("id", { count: "exact", head: true }).eq("estado", "Pendiente").neq("id_usuario", sesion.id)
      : null,
    cde ? supabase.from("canjes").select("id", { count: "exact", head: true }).eq("estado", "Solicitado") : null,
  ]);

  const pestanas = [
    { href: "/formacion", etiqueta: "Mis logros" },
    ...(revisa || sesion.rol === "estudiante"
      ? [{ href: "/formacion/aportes", etiqueta: revisa ? "Aportes por validar" : "Mis aportes", contador: aportes?.count ?? 0 }]
      : []),
    ...(cde ? [{ href: "/formacion/gestion", etiqueta: "Gestión del CDE", contador: canjes?.count ?? 0 }] : []),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--tinta)]">Formación y recompensas</h1>
        <p className="text-muted-foreground text-sm">Gana puntos participando, sube de nivel, colecciona insignias y canjéalas por recompensas.</p>
      </div>
      {pestanas.length > 1 && <Pestanas pestanas={pestanas} />}
      {children}
    </div>
  );
}
