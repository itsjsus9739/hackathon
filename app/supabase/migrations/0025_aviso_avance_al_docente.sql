-- =====================================================================
-- CDE UNAB · Avances de los planes: también avisan a quien creó el plan (el docente)
--   Así, cuando un estudiante del equipo reporta un avance, su docente se entera.
-- =====================================================================

create or replace function public.avisar_avance_plan()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  p record;
  autor text := (select nombre from public.perfiles where id = new.id_autor);
begin
  select pl.titulo, pl.id_responsable, pl.creado_por, pl.id_empresa, e.id_representante into p
  from public.planes_accion pl join public.empresas e on e.id = pl.id_empresa where pl.id = new.id_plan;
  -- notificar() no avisa a quien escribió el avance
  perform public.notificar(destino, 'plan', 'Nuevo avance: ' || p.titulo,
                           autor || ': ' || left(new.texto, 140), '/planes?empresa=' || p.id_empresa || '&vista=todos')
  from (select distinct unnest(array[p.id_responsable, p.creado_por, p.id_representante]) as destino) d
  where destino is not null;
  return null;
end;
$$;
revoke execute on function public.avisar_avance_plan() from public, anon, authenticated;
