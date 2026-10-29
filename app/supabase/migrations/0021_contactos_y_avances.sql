-- =====================================================================
-- CDE UNAB · "Mis contactos" y avances de los planes de acción
--   * El docente crea sus asignaturas (por semestre) e inscribe a sus estudiantes.
--   * mis_contactos(): a quién ve cada rol.
--       CDE: a todos los participantes · docente: sus estudiantes y las empresas de sus proyectos ·
--       emprendedor: el docente a cargo de su proyecto, el equipo y su mentor ·
--       estudiante: sus docentes, su equipo y la empresa con la que trabaja.
--     Solo nombre, rol y relación: nada de documento, correo ni teléfono (Ley 1581).
--   * avances_plan: bitácora de lo que el docente (o el CDE, o el responsable) reporta sobre un plan;
--     la ven todos los que ven el plan y avisa a la empresa y al responsable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Asignaturas del docente y sus estudiantes
-- ---------------------------------------------------------------------
create or replace function public.es_estudiante(persona uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.perfiles where id = persona and rol::text = 'estudiante' and estado_acceso = 'aprobado');
$$;

create or replace function public.dicta_asignatura(asignatura uuid, sem text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.asignatura_docentes
                 where id_asignatura = asignatura and semestre = sem and id_docente = auth.uid());
$$;

/** El docente registra una asignatura que dicta (la reutiliza si ya existe con ese nombre). */
create or replace function public.crear_asignatura_docente(nombre text, semestre text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  asignatura uuid;
  limpio text := regexp_replace(trim(nombre), '\s+', ' ', 'g');
begin
  if not exists (select 1 from public.perfiles p
                 where p.id = auth.uid() and p.estado_acceso = 'aprobado' and p.rol::text in ('docente', 'cde', 'admin_cde')) then
    raise exception 'Solo los docentes registran sus asignaturas';
  end if;
  if length(limpio) not between 3 and 120 then
    raise exception 'El nombre de la asignatura debe tener entre 3 y 120 caracteres';
  end if;
  if semestre !~ '^[0-9]{4}-[12]$' then
    raise exception 'Semestre no válido';
  end if;
  select a.id into asignatura from public.asignaturas a where lower(a.nombre) = lower(limpio) limit 1;
  if asignatura is null then
    insert into public.asignaturas (nombre) values (limpio) returning id into asignatura;
  end if;
  insert into public.asignatura_docentes (id_asignatura, id_docente, semestre)
  values (asignatura, auth.uid(), semestre) on conflict do nothing;
  return asignatura;
end;
$$;

create policy docente_deja_asignatura on public.asignatura_docentes
  for delete to authenticated using (id_docente = (select auth.uid()));
create policy docente_inscribe_estudiantes on public.asignatura_estudiantes
  for insert to authenticated
  with check (public.dicta_asignatura(id_asignatura, semestre) and public.es_estudiante(id_estudiante));
create policy docente_retira_de_asignatura on public.asignatura_estudiantes
  for delete to authenticated using (public.dicta_asignatura(id_asignatura, semestre));

-- Aviso al estudiante cuando lo inscriben
create or replace function public.avisar_inscripcion_asignatura()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.notificar(new.id_estudiante, 'general',
    'Te agregaron a ' || (select nombre from public.asignaturas where id = new.id_asignatura),
    'Semestre ' || new.semestre || '. Tu docente ya aparece en Mis contactos.', '/contactos');
  return null;
end;
$$;
create trigger asignatura_estudiantes_aviso after insert on public.asignatura_estudiantes
  for each row execute function public.avisar_inscripcion_asignatura();

-- ---------------------------------------------------------------------
-- 2. Mis contactos
-- ---------------------------------------------------------------------
create or replace function public.mis_contactos()
returns table (id uuid, nombre text, rol public.rol_usuario, relacion text)
language sql stable security definer set search_path = ''
as $$
  with yo as (
    select p.id, p.rol::text as rol from public.perfiles p where p.id = auth.uid() and p.estado_acceso = 'aprobado'
  ),
  -- Proyectos de aula en los que participo (como docente, estudiante o empresa)
  mis_proyectos as (
    select pa.id, pa.id_empresa, pa.id_asignatura, pa.semestre
    from public.proyectos_aula pa
    where pa.id in (select public.proyectos_del_docente() union select public.proyectos_del_estudiante())
       or pa.id_empresa in (select public.mis_empresas())
  ),
  docentes_de_proyectos as (
    select pd.id_docente as id, mp.id_empresa, mp.id_asignatura from mis_proyectos mp
    join public.proyecto_docentes pd on pd.id_proyecto = mp.id
    union
    select ad.id_docente, mp.id_empresa, mp.id_asignatura from mis_proyectos mp
    join public.asignatura_docentes ad on ad.id_asignatura = mp.id_asignatura and ad.semestre = mp.semestre
  ),
  relaciones as (
    -- CDE: todos los participantes
    select p.id,
           case p.rol::text
             when 'docente' then coalesce('Dicta ' || (select string_agg(distinct a.nombre, ', ') from public.asignatura_docentes ad
                                                       join public.asignaturas a on a.id = ad.id_asignatura where ad.id_docente = p.id), 'Docente')
             when 'estudiante' then coalesce('Cursa ' || (select string_agg(distinct a.nombre, ', ') from public.asignatura_estudiantes ae
                                                          join public.asignaturas a on a.id = ae.id_asignatura where ae.id_estudiante = p.id), 'Estudiante')
             when 'emprendedor' then coalesce((select string_agg(distinct e.nombre, ', ') from public.empresas e
                                               where e.id_representante = p.id
                                                  or e.id in (select ce.id_empresa from public.contactos_empresa ce where ce.id_perfil = p.id)), 'Emprendedor')
             else 'Equipo del CDE'
           end as relacion
    from public.perfiles p
    where (select rol from yo) in ('cde', 'admin_cde') and p.estado_acceso = 'aprobado'

    -- Docente: estudiantes de sus asignaturas y de sus proyectos, y las empresas que acompaña
    union all
    select ae.id_estudiante, a.nombre || ' · ' || ae.semestre
    from public.asignatura_docentes ad
    join public.asignatura_estudiantes ae on ae.id_asignatura = ad.id_asignatura and ae.semestre = ad.semestre
    join public.asignaturas a on a.id = ad.id_asignatura
    where ad.id_docente = auth.uid() and (select rol from yo) = 'docente'
    union all
    select pe.id_estudiante, 'Proyecto con ' || coalesce(e.nombre, 'una empresa')
    from mis_proyectos mp
    join public.proyecto_estudiantes pe on pe.id_proyecto = mp.id
    left join public.empresas e on e.id = mp.id_empresa
    where (select rol from yo) in ('docente', 'estudiante', 'emprendedor')
    union all
    select e.id_representante, 'Empresa: ' || e.nombre
    from mis_proyectos mp join public.empresas e on e.id = mp.id_empresa
    where (select rol from yo) in ('docente', 'estudiante') and e.id_representante is not null

    -- Emprendedor y estudiante: el docente a cargo del proyecto
    union all
    select d.id, 'Docente de tu proyecto' || coalesce(' · ' || a.nombre, '')
    from docentes_de_proyectos d left join public.asignaturas a on a.id = d.id_asignatura
    where (select rol from yo) in ('emprendedor', 'estudiante')
    -- Estudiante: los docentes de sus asignaturas
    union all
    select ad.id_docente, 'Tu docente · ' || a.nombre
    from public.asignatura_estudiantes ae
    join public.asignatura_docentes ad on ad.id_asignatura = ae.id_asignatura and ad.semestre = ae.semestre
    join public.asignaturas a on a.id = ae.id_asignatura
    where ae.id_estudiante = auth.uid() and (select rol from yo) = 'estudiante'
    -- Emprendedor: su mentor del CDE
    union all
    select e.id_mentor, 'Mentor del CDE · ' || e.nombre
    from public.empresas e
    where e.id in (select public.mis_empresas()) and e.id_mentor is not null and (select rol from yo) = 'emprendedor'
  )
  select p.id, p.nombre, p.rol, string_agg(distinct r.relacion, ' | ') as relacion
  from relaciones r
  join public.perfiles p on p.id = r.id and p.estado_acceso = 'aprobado'
  where p.id <> auth.uid()
  group by p.id, p.nombre, p.rol
  order by p.nombre;
$$;

-- ---------------------------------------------------------------------
-- 3. Avances de los planes de acción
-- ---------------------------------------------------------------------
create table public.avances_plan (
  id uuid primary key default gen_random_uuid(),
  id_plan uuid not null references public.planes_accion (id) on delete cascade,
  id_compromiso uuid references public.compromisos (id) on delete set null,
  id_autor uuid not null references public.perfiles (id) on delete cascade default auth.uid(),
  texto text not null check (length(trim(texto)) between 5 and 2000),
  creado_en timestamptz not null default now()
);
create index avances_plan_plan_idx on public.avances_plan (id_plan, creado_en desc);

-- Reportan avances: el CDE, el docente/estudiante del proyecto de aula de la empresa y los responsables
create or replace function public.puede_reportar_avance(plan uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_cde() or exists (
    select 1 from public.planes_accion p
    where p.id = plan
      and (p.id_responsable = auth.uid()
           or exists (select 1 from public.compromisos c where c.id_plan = p.id and c.id_responsable = auth.uid())
           or p.id_empresa in (select pa.id_empresa from public.proyectos_aula pa
                               where pa.id in (select public.proyectos_del_docente() union select public.proyectos_del_estudiante()))));
$$;

alter table public.avances_plan enable row level security;
create policy ven_avances on public.avances_plan for select to authenticated
  using (public.es_cde() or id_plan in (select public.planes_visibles()));
create policy reportan_avances on public.avances_plan for insert to authenticated
  with check (id_autor = (select auth.uid()) and public.puede_reportar_avance(id_plan)
              and (id_compromiso is null or exists (select 1 from public.compromisos c where c.id = id_compromiso and c.id_plan = avances_plan.id_plan)));
create policy autor_o_cde_borra_avance on public.avances_plan for delete to authenticated
  using (id_autor = (select auth.uid()) or public.es_cde());
create policy solo_acceso_aprobado on public.avances_plan as restrictive for all to authenticated
  using (public.acceso_aprobado()) with check (public.acceso_aprobado());
create policy ia_lectura on public.avances_plan for select to ia_lectura using (true);
grant select on public.avances_plan to ia_lectura;

-- Aviso a la empresa (representante) y al responsable del plan
create or replace function public.avisar_avance_plan()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  p record;
  autor text := (select nombre from public.perfiles where id = new.id_autor);
begin
  select pl.titulo, pl.id_responsable, pl.id_empresa, e.id_representante into p
  from public.planes_accion pl join public.empresas e on e.id = pl.id_empresa where pl.id = new.id_plan;
  perform public.notificar(destino, 'plan', 'Nuevo avance: ' || p.titulo,
                           autor || ': ' || left(new.texto, 140), '/planes?empresa=' || p.id_empresa || '&vista=todos')
  from (select distinct unnest(array[p.id_responsable, p.id_representante]) as destino) d
  where destino is not null;
  return null;
end;
$$;
create trigger avances_plan_aviso after insert on public.avances_plan
  for each row execute function public.avisar_avance_plan();
create trigger avances_plan_auditoria after insert or update or delete on public.avances_plan
  for each row execute function public.auditar();

revoke execute on function public.es_estudiante(uuid), public.dicta_asignatura(uuid, text), public.crear_asignatura_docente(text, text),
  public.mis_contactos(), public.puede_reportar_avance(uuid) from public, anon;
grant execute on function public.es_estudiante(uuid), public.dicta_asignatura(uuid, text), public.crear_asignatura_docente(text, text),
  public.mis_contactos(), public.puede_reportar_avance(uuid) to authenticated;
revoke execute on function public.avisar_inscripcion_asignatura(), public.avisar_avance_plan() from public, anon, authenticated;
