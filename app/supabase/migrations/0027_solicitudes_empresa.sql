-- =====================================================================
-- CDE UNAB · Registro de empresas por el emprendedor
--   El emprendedor registra su empresa (nueva o ya existente en la base) y un
--   administrador del CDE la confirma. Al aprobarla, la empresa se crea o se
--   vincula a su cuenta (representante o contacto).
--
-- Se aplicó primero directamente en Supabase (sin archivo de migración); este
-- archivo la reproduce tal cual está en la base del proyecto para que el
-- repositorio y Supabase coincidan. Es seguro ejecutarlo de nuevo: no cambia nada
-- donde ya existe.
-- =====================================================================

create table if not exists public.solicitudes_empresa (
  id uuid primary key default gen_random_uuid(),
  id_solicitante uuid not null default auth.uid()
    constraint solicitudes_empresa_id_solicitante_fkey references public.perfiles (id) on delete cascade,
  nombre text not null constraint solicitudes_empresa_nombre_check check (length(trim(nombre)) between 2 and 200),
  nit text constraint solicitudes_empresa_nit_check check (nit ~ '^[0-9]{6,15}$'),
  sector text,
  tamano public.tamano_empresa,
  municipio text,
  descripcion text constraint solicitudes_empresa_descripcion_check check (length(descripcion) <= 2000),
  cargo text constraint solicitudes_empresa_cargo_check check (length(cargo) <= 120),
  id_empresa_existente uuid
    constraint solicitudes_empresa_id_empresa_existente_fkey references public.empresas (id) on delete set null,
  estado text not null default 'pendiente'
    constraint solicitudes_empresa_estado_check check (estado in ('pendiente', 'aprobada', 'rechazada')),
  comentario_revision text constraint solicitudes_empresa_comentario_revision_check check (length(comentario_revision) <= 1000),
  id_empresa_resultante uuid
    constraint solicitudes_empresa_id_empresa_resultante_fkey references public.empresas (id) on delete set null,
  revisado_por uuid constraint solicitudes_empresa_revisado_por_fkey references public.perfiles (id) on delete set null,
  revisado_en timestamptz,
  creado_en timestamptz not null default now()
);
create index if not exists solicitudes_empresa_solicitante_idx on public.solicitudes_empresa (id_solicitante);

-- Se escribe solo con las funciones de abajo; la tabla se lee con RLS
alter table public.solicitudes_empresa enable row level security;
revoke insert, update, delete on public.solicitudes_empresa from authenticated;

drop policy if exists ven_solicitudes_empresa on public.solicitudes_empresa;
create policy ven_solicitudes_empresa on public.solicitudes_empresa for select to authenticated
  using (id_solicitante = (select auth.uid()) or public.es_cde());
drop policy if exists solo_acceso_aprobado on public.solicitudes_empresa;
create policy solo_acceso_aprobado on public.solicitudes_empresa as restrictive for all to authenticated
  using (public.acceso_aprobado()) with check (public.acceso_aprobado());

drop trigger if exists solicitudes_empresa_auditoria on public.solicitudes_empresa;
create trigger solicitudes_empresa_auditoria after insert or update or delete on public.solicitudes_empresa
  for each row execute function public.auditar();

-- Aviso nuevo en la campana del administrador
alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check check (tipo in (
  'general', 'proyecto', 'plan', 'compromiso', 'aporte', 'insignia', 'canje', 'cita', 'mentor', 'registro_docente', 'evento',
  'solicitud_acceso', 'solicitud_empresa'));

create or replace function public.es_admin_cde()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol::text = 'admin_cde' and estado_acceso = 'aprobado');
$$;

-- El emprendedor registra su empresa: se busca por NIT o nombre y se avisa a los administradores
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

-- El administrador aprueba (crea o vincula la empresa) o rechaza, y se avisa al emprendedor
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
  update public.notificaciones set leida_en = now() where id_referencia = solicitud and leida_en is null;
  return empresa;
end;
$$;

revoke execute on function public.es_admin_cde(), public.solicitar_empresa(text, text, text, text, text, text, text),
  public.resolver_solicitud_empresa(uuid, boolean, text) from public, anon;
grant execute on function public.es_admin_cde(), public.solicitar_empresa(text, text, text, text, text, text, text),
  public.resolver_solicitud_empresa(uuid, boolean, text) to authenticated;
