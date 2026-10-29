-- =====================================================================
-- CDE UNAB · Los docentes crean planes de acción y les asignan estudiantes
--   * Un docente crea planes para las empresas del CDE: queda como creador y responsable, edita su plan
--     y sus compromisos (el CDE sigue pudiendo todo).
--   * plan_estudiantes: el equipo de estudiantes del plan. Ven el plan, reportan avances y reciben
--     compromisos; cada uno recibe un aviso al ser asignado.
--   * El docente ve la ficha de las empresas en las que tiene planes.
-- =====================================================================

create table public.plan_estudiantes (
  id uuid not null unique default gen_random_uuid(),   -- la auditoría identifica cada fila por id
  id_plan uuid not null references public.planes_accion (id) on delete cascade,
  id_estudiante uuid not null references public.perfiles (id) on delete cascade,
  asignado_por uuid references public.perfiles (id) on delete set null default auth.uid(),
  asignado_en timestamptz not null default now(),
  primary key (id_plan, id_estudiante)
);
create index plan_estudiantes_estudiante_idx on public.plan_estudiantes (id_estudiante);

create or replace function public.es_docente()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol::text = 'docente' and estado_acceso = 'aprobado');
$$;

create or replace function public.plan_creado_por_mi(plan uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.planes_accion where id = plan and creado_por = auth.uid());
$$;

create or replace function public.gestiona_plan(plan uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_cde() or public.plan_creado_por_mi(plan);
$$;

/** Empresas entre las que se elige al crear un plan (CDE y docentes): solo id y nombre. */
create or replace function public.empresas_para_planes()
returns table (id uuid, nombre text)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.nombre from public.empresas e
  where public.es_cde() or public.es_docente()
  order by e.nombre;
$$;

-- Planes visibles: además, los que creé y aquellos en los que estoy en el equipo
create or replace function public.planes_visibles()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select p.id from public.planes_accion p
  where p.id_empresa in (select public.mis_empresas())
     or p.id_responsable = auth.uid()
     or p.creado_por = auth.uid()
     or p.id_empresa in (select pa.id_empresa from public.proyectos_aula pa
                         where pa.id in (select public.proyectos_del_docente() union select public.proyectos_del_estudiante()))
  union
  select c.id_plan from public.compromisos c where c.id_responsable = auth.uid()
  union
  select pe.id_plan from public.plan_estudiantes pe where pe.id_estudiante = auth.uid();
$$;

-- Avances: también el creador del plan y su equipo de estudiantes
create or replace function public.puede_reportar_avance(plan uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_cde() or exists (
    select 1 from public.planes_accion p
    where p.id = plan
      and (p.id_responsable = auth.uid()
           or p.creado_por = auth.uid()
           or exists (select 1 from public.plan_estudiantes pe where pe.id_plan = p.id and pe.id_estudiante = auth.uid())
           or exists (select 1 from public.compromisos c where c.id_plan = p.id and c.id_responsable = auth.uid())
           or p.id_empresa in (select pa.id_empresa from public.proyectos_aula pa
                               where pa.id in (select public.proyectos_del_docente() union select public.proyectos_del_estudiante()))));
$$;

-- El creador (docente) edita su plan y sus compromisos como el CDE
create or replace function public.proteger_plan()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- El responsable (que no es CDE ni creó el plan) solo mueve el estado
  if auth.uid() is not null and not public.es_cde() and old.creado_por is distinct from auth.uid() and (
       new.id_empresa is distinct from old.id_empresa
    or new.id_diagnostico is distinct from old.id_diagnostico
    or new.titulo is distinct from old.titulo
    or new.objetivo is distinct from old.objetivo
    or new.area is distinct from old.area
    or new.id_responsable is distinct from old.id_responsable
    or new.fecha_inicio is distinct from old.fecha_inicio
    or new.fecha_limite is distinct from old.fecha_limite) then
    raise exception 'El responsable solo puede cambiar el estado del plan';
  end if;
  if auth.uid() is not null and not public.es_cde() then
    new.creado_por := old.creado_por;
    new.es_ejemplo := old.es_ejemplo;
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

create or replace function public.proteger_compromiso()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.es_cde() and not public.plan_creado_por_mi(old.id_plan) and (
       new.id_plan is distinct from old.id_plan
    or new.descripcion is distinct from old.descripcion
    or new.id_responsable is distinct from old.id_responsable
    or new.fecha_limite is distinct from old.fecha_limite) then
    raise exception 'Solo el CDE cambia la descripción, el responsable o la fecha del compromiso';
  end if;
  -- Estado y avance coherentes
  if new.estado = 'Cumplido' then
    new.avance := 100;
  elsif new.avance = 100 and new.estado <> 'Cancelado' then
    new.estado := 'Cumplido';
  elsif new.avance > 0 and new.estado = 'Pendiente' then
    new.estado := 'En curso';
  end if;
  new.completado_en := case when new.estado = 'Cumplido' then coalesce(new.completado_en, now()) end;
  new.actualizado_en := now();
  return new;
end;
$$;

-- Los compromisos editables incluyen los de los planes que creé
create or replace function public.compromisos_editables()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select c.id from public.compromisos c
  join public.planes_accion p on p.id = c.id_plan
  where coalesce(c.id_responsable, p.id_responsable) = auth.uid()
     or p.id_responsable = auth.uid()
     or p.creado_por = auth.uid()
     or p.id_empresa in (select public.mis_empresas());
$$;

create or replace function public.empresas_de_mis_planes()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select id_empresa from public.planes_accion where creado_por = auth.uid() or id_responsable = auth.uid()
  union
  select p.id_empresa from public.planes_accion p join public.plan_estudiantes pe on pe.id_plan = p.id
  where pe.id_estudiante = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
create policy docente_crea_plan on public.planes_accion for insert to authenticated
  with check (public.es_docente() and creado_por = (select auth.uid()) and id_responsable = (select auth.uid()));
-- Con columnas de la fila (no con planes_visibles): así insert ... returning ve el plan recién creado
create policy creador_ve_plan on public.planes_accion for select to authenticated
  using (creado_por = (select auth.uid()) or id_responsable = (select auth.uid()));
create policy creador_edita_plan on public.planes_accion for update to authenticated
  using (creado_por = (select auth.uid())) with check (creado_por = (select auth.uid()));
create policy creador_borra_plan on public.planes_accion for delete to authenticated
  using (creado_por = (select auth.uid()));

create policy creador_gestiona_compromisos on public.compromisos for all to authenticated
  using (public.plan_creado_por_mi(id_plan)) with check (public.plan_creado_por_mi(id_plan));

-- El docente y el equipo del plan ven la ficha de esa empresa
create policy equipo_del_plan_lee_empresa on public.empresas for select to authenticated
  using (id in (select public.empresas_de_mis_planes()));

alter table public.plan_estudiantes enable row level security;
create policy ven_equipo_del_plan on public.plan_estudiantes for select to authenticated
  using (public.es_cde() or id_plan in (select public.planes_visibles()));
create policy gestor_asigna_estudiantes on public.plan_estudiantes for insert to authenticated
  with check (public.gestiona_plan(id_plan) and public.es_estudiante(id_estudiante));
create policy gestor_retira_estudiantes on public.plan_estudiantes for delete to authenticated
  using (public.gestiona_plan(id_plan));
create policy solo_acceso_aprobado on public.plan_estudiantes as restrictive for all to authenticated
  using (public.acceso_aprobado()) with check (public.acceso_aprobado());
create policy ia_lectura on public.plan_estudiantes for select to ia_lectura using (true);
grant select on public.plan_estudiantes to ia_lectura;

create or replace function public.avisar_estudiante_plan()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  p record;
begin
  select pl.titulo, pl.id_empresa, e.nombre as empresa into p
  from public.planes_accion pl join public.empresas e on e.id = pl.id_empresa where pl.id = new.id_plan;
  perform public.notificar(new.id_estudiante, 'plan', 'Te asignaron a un plan de acción',
                           p.titulo || ' · ' || p.empresa, '/planes?empresa=' || p.id_empresa || '&vista=todos');
  return null;
end;
$$;
create trigger plan_estudiantes_aviso after insert on public.plan_estudiantes
  for each row execute function public.avisar_estudiante_plan();
create trigger plan_estudiantes_auditoria after insert or update or delete on public.plan_estudiantes
  for each row execute function public.auditar();

revoke execute on function public.es_docente(), public.plan_creado_por_mi(uuid), public.gestiona_plan(uuid),
  public.empresas_para_planes(), public.empresas_de_mis_planes() from public, anon;
grant execute on function public.es_docente(), public.plan_creado_por_mi(uuid), public.gestiona_plan(uuid),
  public.empresas_para_planes(), public.empresas_de_mis_planes() to authenticated;
revoke execute on function public.avisar_estudiante_plan() from public, anon, authenticated;
