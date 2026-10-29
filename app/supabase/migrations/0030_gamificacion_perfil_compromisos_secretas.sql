-- =====================================================================
-- CDE UNAB · Gamificación: más momentos de premio
--   1. Puntos por completar el perfil de la empresa (la gamificación arregla la calidad de datos):
--      +10 por cada dato real que el emprendedor llena o confirma (sector, tamaño, municipio,
--      formalización, descripción, NIT) y +50 al tener los seis. Una sola vez por empresa y dato.
--      Confirmar un sector o tamaño ESTIMADO cuenta: deja de ser estimado y pasa a ser real.
--   2. Puntos por cumplir un compromiso del plan de acción: +30 al responsable o, si no tiene,
--      a los estudiantes del plan y al emprendedor de la empresa. Si deja de estar cumplido
--      (o se borra), los puntos se retiran.
--   3. Insignias nuevas, algunas SECRETAS (no se ve qué piden hasta ganarlas).
--
-- Es seguro repetirla.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Nuevos orígenes de puntos y criterios de insignias
-- ---------------------------------------------------------------------
alter table public.puntos_movimientos drop constraint if exists puntos_movimientos_origen_tipo_check;
alter table public.puntos_movimientos add constraint puntos_movimientos_origen_tipo_check
  check (origen_tipo in ('evento', 'aporte', 'onboarding', 'canje', 'ajuste', 'perfil', 'compromiso'));

alter table public.insignias drop constraint if exists insignias_criterio_check;
alter table public.insignias add constraint insignias_criterio_check check (criterio in (
  'aportes_validados', 'puntos', 'eventos_asistidos', 'onboarding', 'manual',
  'compromisos_cumplidos', 'perfil_completo', 'canjes', 'madrugador'));

alter table public.insignias add column if not exists secreta boolean not null default false;
comment on column public.insignias.secreta is 'La interfaz oculta nombre y requisito hasta que la persona la gana';

-- ---------------------------------------------------------------------
-- 1. Perfil de la empresa
-- ---------------------------------------------------------------------
-- Datos del perfil que dan puntos (mismo orden que muestra «Mi empresa»)
create or replace function public.campos_perfil_empresa(e public.empresas)
returns text[]
language sql immutable set search_path = ''
as $$
  select array_remove(array[
    case when e.sector is not null and not ('sector' = any (e.datos_estimados)) then 'sector' end,
    case when e.tamano is not null and not ('tamano' = any (e.datos_estimados)) then 'tamano' end,
    case when e.municipio is not null then 'municipio' end,
    case when e.formalizacion is not null then 'formalizacion' end,
    case when e.descripcion is not null then 'descripcion' end,
    case when e.nit is not null then 'nit' end
  ], null);
$$;

create or replace function public.puntos_por_perfil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  usuario uuid := auth.uid();
  antes text[] := public.campos_perfil_empresa(old);
  ahora text[] := public.campos_perfil_empresa(new);
  campo text;
  nombres constant jsonb := '{"sector": "sector", "tamano": "tamaño", "municipio": "municipio",
    "formalizacion": "formalización", "descripcion": "descripción", "nit": "NIT"}';
begin
  -- Solo premia al emprendedor de la empresa cuando él mismo la actualiza (no al CDE ni a importaciones)
  if usuario is null
     or (select rol from public.perfiles where id = usuario) is distinct from 'emprendedor'
     or new.id not in (select public.mis_empresas()) then
    return null;
  end if;

  foreach campo in array ahora loop
    if not campo = any (antes) then
      insert into public.puntos_movimientos (id_usuario, puntos, motivo, origen_tipo, origen_id)
      values (usuario, 10, 'Perfil de ' || new.nombre || ': ' || (nombres ->> campo),
              'perfil', md5(new.id::text || ':perfil:' || campo)::uuid)
      on conflict do nothing;
    end if;
  end loop;

  if cardinality(ahora) = 6 then
    insert into public.puntos_movimientos (id_usuario, puntos, motivo, origen_tipo, origen_id)
    values (usuario, 50, 'Perfil completo: ' || new.nombre, 'perfil', md5(new.id::text || ':perfil:completo')::uuid)
    on conflict do nothing;
  end if;
  return null;
end;
$$;
drop trigger if exists empresas_puntos_perfil on public.empresas;
create trigger empresas_puntos_perfil after update on public.empresas
  for each row execute function public.puntos_por_perfil();

-- ---------------------------------------------------------------------
-- 2. Compromisos cumplidos
-- ---------------------------------------------------------------------
create or replace function public.puntos_por_compromiso()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  empresa uuid;
  nombre_empresa text;
begin
  if tg_op = 'DELETE' or (old.estado = 'Cumplido' and new.estado <> 'Cumplido') then
    delete from public.puntos_movimientos where origen_tipo = 'compromiso' and origen_id = old.id;
    return null;
  end if;
  if new.estado <> 'Cumplido' or (tg_op = 'UPDATE' and old.estado = 'Cumplido') then
    return null;
  end if;

  select p.id_empresa, e.nombre into empresa, nombre_empresa
  from public.planes_accion p join public.empresas e on e.id = p.id_empresa where p.id = new.id_plan;

  with ganadores as (
    select new.id_responsable as id where new.id_responsable is not null
    union
    select pe.id_estudiante from public.plan_estudiantes pe where new.id_responsable is null and pe.id_plan = new.id_plan
    union
    select e.id_representante from public.empresas e where new.id_responsable is null and e.id = empresa and e.id_representante is not null
    union
    select c.id_perfil from public.contactos_empresa c where new.id_responsable is null and c.id_empresa = empresa and c.id_perfil is not null
  ), nuevos as (
    insert into public.puntos_movimientos (id_usuario, puntos, motivo, origen_tipo, origen_id)
    select g.id, 30, 'Compromiso cumplido: ' || left(new.descripcion, 80), 'compromiso', new.id
    from ganadores g join public.perfiles pf on pf.id = g.id
    on conflict do nothing
    returning id_usuario
  )
  insert into public.notificaciones (id_usuario, tipo, titulo, cuerpo, enlace)
  select n.id_usuario, 'compromiso', '¡Compromiso cumplido! +30 puntos',
         left(new.descripcion, 120) || coalesce(' · ' || nombre_empresa, ''), '/formacion'
  from nuevos n
  where n.id_usuario is distinct from auth.uid();   -- quien lo marca ya lo ve en pantalla
  return null;
end;
$$;
drop trigger if exists compromisos_puntos on public.compromisos;
-- Sin lista de columnas: el estado también cambia por el avance (lo ajusta proteger_compromiso antes de guardar)
create trigger compromisos_puntos after insert or update or delete on public.compromisos
  for each row execute function public.puntos_por_compromiso();

-- ---------------------------------------------------------------------
-- 3. Motor de insignias con los criterios nuevos
-- ---------------------------------------------------------------------
create or replace function public.otorgar_insignias(usuario uuid)
returns void
language sql security definer set search_path = ''
as $$
  with candidata as (
    select i.id, i.nombre from public.insignias i
    where i.activa and i.criterio <> 'manual'
      and (i.roles is null or (select rol from public.perfiles where id = usuario) = any (i.roles))
      and case i.criterio
            when 'aportes_validados' then
              (select count(*) from public.aportes a
               where a.id_usuario = usuario and a.estado = 'Validado' and (i.id_area is null or a.id_area = i.id_area)) >= i.meta
            when 'puntos' then
              (select coalesce(sum(m.puntos), 0) from public.puntos_movimientos m
               where m.id_usuario = usuario and m.origen_tipo <> 'canje') >= i.meta
            when 'eventos_asistidos' then
              (select count(*) from public.inscripciones_eventos e where e.id_usuario = usuario and e.asistio) >= i.meta
            when 'onboarding' then
              exists (select 1 from public.progreso_onboarding o where o.id_usuario = usuario and o.completado_en is not null)
            when 'compromisos_cumplidos' then
              (select count(*) from public.puntos_movimientos m where m.id_usuario = usuario and m.origen_tipo = 'compromiso') >= i.meta
            when 'perfil_completo' then
              exists (select 1 from public.puntos_movimientos m where m.id_usuario = usuario and m.origen_tipo = 'perfil'
                      and m.motivo like 'Perfil completo:%')
            when 'canjes' then
              (select count(*) from public.canjes c where c.id_usuario = usuario and c.estado <> 'Rechazado') >= i.meta
            when 'madrugador' then
              exists (select 1 from public.inscripciones_eventos ie join public.eventos ev on ev.id = ie.id_evento
                      where ie.id_usuario = usuario and ie.asistio
                        and extract(hour from ev.fecha at time zone 'America/Bogota') between 4 and 7)  -- 0 h = «todo el día»
          end
  ), nuevas as (
    insert into public.insignias_usuario (id_usuario, id_insignia, otorgada_por)
    select usuario, id, null from candidata
    on conflict do nothing
    returning id_insignia
  )
  insert into public.notificaciones (id_usuario, tipo, titulo, cuerpo, enlace)
  select usuario, 'insignia', '¡Ganaste una insignia!', c.nombre, '/logros'
  from nuevas n join candidata c on c.id = n.id_insignia;
$$;

insert into public.insignias (nombre, descripcion, nivel, criterio, meta, roles, secreta) values
  ('Primer compromiso', 'Cumpliste tu primer compromiso de un plan de acción', 1, 'compromisos_cumplidos', 1, null, false),
  ('Cumplidor', 'Cumpliste 5 compromisos de planes de acción', 2, 'compromisos_cumplidos', 5, null, false),
  ('Perfil impecable', 'Completaste todos los datos de tu empresa', 2, 'perfil_completo', 1,
     array['emprendedor']::public.rol_usuario[], true),
  ('Madrugador', 'Asististe a un evento del CDE que empezaba antes de las 8:00 a. m.', 1, 'madrugador', 1, null, true),
  ('Buen gusto', 'Canjeaste tu primera recompensa', 1, 'canjes', 1, null, true)
on conflict (nombre) do update set descripcion = excluded.descripcion, nivel = excluded.nivel, criterio = excluded.criterio,
  meta = excluded.meta, roles = excluded.roles, secreta = excluded.secreta;

-- Quien ya cumple los requisitos (p. ej. ya canjeó) recibe sus insignias nuevas
select public.otorgar_insignias(p.id) from public.perfiles p where p.estado_acceso = 'aprobado';

revoke execute on function public.puntos_por_perfil() from public, anon, authenticated;
revoke execute on function public.puntos_por_compromiso() from public, anon, authenticated;
revoke execute on function public.otorgar_insignias(uuid) from public, anon, authenticated;
revoke execute on function public.campos_perfil_empresa(public.empresas) from public, anon;
grant execute on function public.campos_perfil_empresa(public.empresas) to authenticated;
