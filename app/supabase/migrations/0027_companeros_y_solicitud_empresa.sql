-- =====================================================================
-- CDE UNAB · Compañeros de asignatura y registro de empresas por el emprendedor
--   * Mis contactos: el estudiante ve, además de su docente, a los compañeros de sus asignaturas.
--   * El emprendedor envía los datos de su empresa; queda como solicitud que el admin del CDE revisa:
--       - si coincide con una empresa de la base (mismo NIT o mismo nombre), el admin confirma si le
--         pertenece: al aprobar queda como representante (o como contacto, si ya tenía uno);
--       - si es nueva, al aprobar se crea con él como representante.
--     El emprendedor recibe un aviso con la decisión.
-- =====================================================================

alter table public.notificaciones drop constraint notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check check (tipo in (
  'general', 'proyecto', 'plan', 'compromiso', 'aporte', 'insignia', 'canje', 'cita', 'mentor', 'registro_docente', 'evento',
  'solicitud_acceso', 'solicitud_empresa'));

-- 1. Mis contactos con compañeros de asignatura
create or replace function public.mis_contactos()
returns table (id uuid, nombre text, rol public.rol_usuario, relacion text)
language sql stable security definer set search_path = ''
as $$
  with yo as (
    select p.id, p.rol::text as rol from public.perfiles p where p.id = auth.uid() and p.estado_acceso = 'aprobado'
  ),
  mis_proyectos as (
    select pa.id, pa.id_empresa, pa.id_asignatura, pa.semestre
    from public.proyectos_aula pa
    where pa.estado <> 'Cancelado'
      and (pa.id in (select public.proyectos_del_docente() union select public.proyectos_del_estudiante())
           or pa.id_empresa in (select public.mis_empresas()))
  ),
  docentes_de_proyectos as (
    select pd.id_docente as id, mp.id_empresa, mp.id_asignatura from mis_proyectos mp
    join public.proyecto_docentes pd on pd.id_proyecto = mp.id
    union
    select ad.id_docente, mp.id_empresa, mp.id_asignatura from mis_proyectos mp
    join public.asignatura_docentes ad on ad.id_asignatura = mp.id_asignatura and ad.semestre = mp.semestre
  ),
  relaciones as (
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
    union all
    select ae.id_estudiante, a.nombre || ' · ' || ae.semestre
    from public.asignatura_docentes ad
    join public.asignatura_estudiantes ae on ae.id_asignatura = ad.id_asignatura and ae.semestre = ad.semestre
    join public.asignaturas a on a.id = ad.id_asignatura
    where ad.id_docente = auth.uid() and (select rol from yo) = 'docente'
    union all
    select pe.id_estudiante, 'Proyecto con ' || coalesce(e.nombre, 'una empresa') || coalesce(' · ' || a.nombre, '')
    from mis_proyectos mp
    join public.proyecto_estudiantes pe on pe.id_proyecto = mp.id
    left join public.empresas e on e.id = mp.id_empresa
    left join public.asignaturas a on a.id = mp.id_asignatura
    where (select rol from yo) in ('docente', 'estudiante', 'emprendedor')
    union all
    select e.id_representante, 'Empresa: ' || e.nombre || coalesce(' · ' || a.nombre, '')
    from mis_proyectos mp join public.empresas e on e.id = mp.id_empresa
    left join public.asignaturas a on a.id = mp.id_asignatura
    where (select rol from yo) in ('docente', 'estudiante') and e.id_representante is not null
    union all
    select d.id, 'Docente de tu proyecto' || coalesce(' · ' || a.nombre, '')
    from docentes_de_proyectos d left join public.asignaturas a on a.id = d.id_asignatura
    where (select rol from yo) in ('emprendedor', 'estudiante')
    union all
    select ad.id_docente, 'Tu docente · ' || a.nombre
    from public.asignatura_estudiantes ae
    join public.asignatura_docentes ad on ad.id_asignatura = ae.id_asignatura and ad.semestre = ae.semestre
    join public.asignaturas a on a.id = ae.id_asignatura
    where ae.id_estudiante = auth.uid() and (select rol from yo) = 'estudiante'
    union all
    -- Estudiante: sus compañeros de asignatura (mismo semestre)
    select otro.id_estudiante, 'Compañero de ' || a.nombre
    from public.asignatura_estudiantes ae
    join public.asignatura_estudiantes otro
      on otro.id_asignatura = ae.id_asignatura and otro.semestre = ae.semestre and otro.id_estudiante <> ae.id_estudiante
    join public.asignaturas a on a.id = ae.id_asignatura
    where ae.id_estudiante = auth.uid() and (select rol from yo) = 'estudiante'
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

-- 2. Solicitudes de empresa
create table public.solicitudes_empresa (
  id uuid primary key default gen_random_uuid(),
  id_solicitante uuid not null references public.perfiles (id) on delete cascade default auth.uid(),
  nombre text not null check (length(trim(nombre)) between 2 and 200),
  nit text check (nit ~ '^[0-9]{6,15}$'),
  sector text,
  tamano public.tamano_empresa,
  municipio text,
  descripcion text check (length(descripcion) <= 2000),
  cargo text check (length(cargo) <= 120),
  id_empresa_existente uuid references public.empresas (id) on delete set null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
  comentario_revision text check (length(comentario_revision) <= 1000),
  id_empresa_resultante uuid references public.empresas (id) on delete set null,
  revisado_por uuid references public.perfiles (id) on delete set null,
  revisado_en timestamptz,
  creado_en timestamptz not null default now()
);
create index solicitudes_empresa_solicitante_idx on public.solicitudes_empresa (id_solicitante);

alter table public.solicitudes_empresa enable row level security;
-- Lectura: quien la envió y el CDE. Escritura: solo por las funciones de abajo.
create policy ven_solicitudes_empresa on public.solicitudes_empresa for select to authenticated
  using (id_solicitante = (select auth.uid()) or public.es_cde());
create policy solo_acceso_aprobado on public.solicitudes_empresa as restrictive for all to authenticated
  using (public.acceso_aprobado()) with check (public.acceso_aprobado());
revoke insert, update, delete on public.solicitudes_empresa from authenticated;
create trigger solicitudes_empresa_auditoria after insert or update or delete on public.solicitudes_empresa
  for each row execute function public.auditar();

create or replace function public.es_admin_cde()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol::text = 'admin_cde' and estado_acceso = 'aprobado');
$$;

/** El emprendedor envía los datos de su empresa. Devuelve el id de la solicitud. */
create or replace function public.solicitar_empresa(
  nombre text, nit text default null, sector text default null, tamano text default null,
  municipio text default null, descripcion text default null, cargo text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  limpio text := regexp_replace(trim(nombre), '\s+', ' ', 'g');
  nit_limpio text := nullif(regexp_replace(split_part(coalesce(nit, ''), '-', 1), '[^0-9]', '', 'g'), '');
  existente record;
  nueva uuid;
  solicitante text := (select p.nombre from public.perfiles p where p.id = auth.uid());
begin
  if not exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text = 'emprendedor' and p.estado_acceso = 'aprobado') then
    raise exception 'Solo los emprendedores registran su empresa';
  end if;
  if sector is not null and not exists (select 1 from public.sectores s where s.nombre = sector) then
    raise exception 'Sector no válido';
  end if;
  if exists (select 1 from public.solicitudes_empresa s
             where s.id_solicitante = auth.uid() and s.estado = 'pendiente'
               and (lower(s.nombre) = lower(limpio) or (nit_limpio is not null and s.nit = nit_limpio))) then
    raise exception 'Ya enviaste una solicitud para esta empresa';
  end if;

  -- ¿Ya está en la base? (mismo NIT o mismo nombre, sin distinguir mayúsculas)
  select e.id, e.nombre into existente from public.empresas e
  where (nit_limpio is not null and e.nit = nit_limpio) or lower(e.nombre) = lower(limpio)
  order by (nit_limpio is not null and e.nit = nit_limpio) desc
  limit 1;
  if existente.id is not null and existente.id in (select public.mis_empresas()) then
    raise exception 'Esa empresa ya está vinculada a tu cuenta';
  end if;

  insert into public.solicitudes_empresa (id_solicitante, nombre, nit, sector, tamano, municipio, descripcion, cargo, id_empresa_existente)
  values (auth.uid(), limpio, nit_limpio, sector, tamano::public.tamano_empresa, nullif(trim(municipio), ''),
          nullif(left(trim(descripcion), 2000), ''), nullif(left(trim(cargo), 120), ''), existente.id)
  returning id into nueva;

  insert into public.notificaciones (id_usuario, tipo, titulo, cuerpo, id_referencia)
  select p.id, 'solicitud_empresa', 'Confirma una empresa',
         coalesce(solicitante, 'Un emprendedor') || ' registró la empresa «' || limpio || '»'
         || coalesce(' (NIT ' || nit_limpio || ')', '')
         || case when existente.id is not null
                 then '. Ya existe en la base como «' || existente.nombre || '»: confirma si le pertenece.'
                 else '. Es nueva: al aprobarla se crea en la base.' end,
         nueva
  from public.perfiles p where p.rol::text = 'admin_cde' and p.estado_acceso = 'aprobado';
  return nueva;
end;
$$;

/** El admin del CDE aprueba (vincula o crea la empresa) o rechaza la solicitud. */
create or replace function public.resolver_solicitud_empresa(solicitud uuid, aprobar boolean, comentario text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  s record;
  empresa uuid;
begin
  if not public.es_admin_cde() then
    raise exception 'Solo un administrador del CDE confirma empresas';
  end if;
  select * into s from public.solicitudes_empresa where id = solicitud for update;
  if s.id is null then
    raise exception 'La solicitud no existe';
  end if;
  if s.estado <> 'pendiente' then
    raise exception 'La solicitud ya fue revisada';
  end if;

  if aprobar then
    if s.id_empresa_existente is not null then
      empresa := s.id_empresa_existente;
      -- Sin representante: queda como representante; si ya hay uno, como contacto de la empresa
      update public.empresas set id_representante = s.id_solicitante where id = empresa and id_representante is null;
      if not found then
        insert into public.contactos_empresa (id_empresa, id_perfil, nombre, cargo)
        select empresa, s.id_solicitante, p.nombre, s.cargo from public.perfiles p where p.id = s.id_solicitante
        on conflict (id_empresa, id_perfil) do nothing;
      end if;
    else
      insert into public.empresas (nombre, nit, sector, tamano, municipio, descripcion, id_representante)
      values (s.nombre, s.nit, s.sector, s.tamano, s.municipio, s.descripcion, s.id_solicitante)
      returning id into empresa;
    end if;
  end if;

  update public.solicitudes_empresa
  set estado = case when aprobar then 'aprobada' else 'rechazada' end,
      comentario_revision = nullif(left(trim(comentario), 1000), ''),
      id_empresa_resultante = empresa,
      revisado_por = auth.uid(),
      revisado_en = now()
  where id = solicitud;

  perform public.notificar(s.id_solicitante, 'general',
    case when aprobar then 'Tu empresa fue confirmada' else 'Tu solicitud de empresa no fue aprobada' end,
    case when aprobar
         then '«' || s.nombre || '» ya está vinculada a tu cuenta. Revisa y completa sus datos.'
         else 'El CDE no pudo confirmar «' || s.nombre || '»' || coalesce(': ' || nullif(trim(comentario), ''), '.') end,
    '/mi-empresa');
  -- Las notificaciones de esta solicitud quedan leídas para todos los admins
  update public.notificaciones set leida_en = now() where id_referencia = solicitud and leida_en is null;
  return empresa;
end;
$$;

revoke execute on function public.es_admin_cde(), public.solicitar_empresa(text, text, text, text, text, text, text),
  public.resolver_solicitud_empresa(uuid, boolean, text) from public, anon;
grant execute on function public.es_admin_cde(), public.solicitar_empresa(text, text, text, text, text, text, text),
  public.resolver_solicitud_empresa(uuid, boolean, text) to authenticated;
