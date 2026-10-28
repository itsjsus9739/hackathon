-- =====================================================================
-- CDE UNAB · Ajustes de la segunda revisión
--   1. Nadie valida su propio aporte (también como restricción, no solo en el trigger)
--   2. diagnosticos.nivel se calcula solo a partir de las 6 áreas
--   3. perfiles.avatar (personaje del coworking) y cómo verlo/guardarlo
--   4. Alias linea_tiempo_empresa → historial_empresa
-- =====================================================================

-- 1. Validador distinto del autor
alter table public.aportes
  add constraint aportes_no_autovalidado check (validado_por is null or validado_por <> id_usuario);

-- 2. Nivel de madurez: Bajo < 2,5 ≤ Medio < 4,0 ≤ Alto (promedio de las 6 áreas, escala 1–5)
create or replace function public.calcular_nivel_diagnostico()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  prom numeric := (new.estrategia + new.mercadeo_ventas + new.financiera + new.normativa_legal
                   + new.productividad + new.transformacion_digital) / 6;
begin
  -- promedio es columna generada y aún no existe en un BEFORE: se recalcula aquí con la misma fórmula
  new.nivel := case when prom < 2.5 then 'Bajo' when prom < 4 then 'Medio' else 'Alto' end;
  return new;
end;
$$;
create trigger diagnosticos_nivel before insert or update on public.diagnosticos
  for each row execute function public.calcular_nivel_diagnostico();
comment on column public.diagnosticos.nivel is 'Calculado por trigger: Bajo < 2,5 ≤ Medio < 4,0 ≤ Alto';
update public.diagnosticos set nivel = nivel;   -- recalcula los existentes

-- 3. Avatar: objeto JSON pequeño (color, accesorio, personaje…)
alter table public.perfiles
  add column avatar jsonb not null default '{}'::jsonb
    check (jsonb_typeof(avatar) = 'object' and pg_column_size(avatar) <= 4096);

-- Los perfiles solo los edita el CDE (RLS); el usuario cambia su avatar con esta función, y nada más
create or replace function public.guardar_avatar(avatar jsonb)
returns jsonb
language sql security definer set search_path = ''
as $$
  update public.perfiles set avatar = guardar_avatar.avatar, actualizado_en = now()
  where id = auth.uid()
  returning avatar;
$$;

-- Avatares de las personas que el usuario ya puede ver en el directorio (coworking visual)
create or replace function public.avatares()
returns table (id uuid, nombre text, rol public.rol_usuario, avatar jsonb)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.nombre, p.rol, p.avatar
  from public.perfiles p
  where p.id in (select d.id from public.directorio() d);
$$;

revoke execute on function public.calcular_nivel_diagnostico() from public, anon, authenticated;
revoke execute on function public.guardar_avatar(jsonb), public.avatares() from public, anon;
grant execute on function public.guardar_avatar(jsonb), public.avatares() to authenticated;

-- 4. Nombre alterno de la línea de tiempo de la Ficha 360°
create view public.linea_tiempo_empresa with (security_invoker = true) as
select * from public.historial_empresa;
grant select on public.linea_tiempo_empresa to authenticated;
