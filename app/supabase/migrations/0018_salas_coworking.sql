-- =====================================================================
-- CDE UNAB · Salas de coworking con nombre y contraseña
--   * Cualquier usuario aprobado crea salas; con contraseña (guardada como hash bcrypt) o abiertas.
--   * Para entrar a una sala hay que ser miembro: quien la crea lo es; los demás se unen con la
--     contraseña (unirse_sala). La "Sala principal" sigue abierta para todos.
--   * Cada sala tiene su chat (canales tipo 'sala') y su canal de Realtime "coworking:<id>":
--     RLS deja escuchar y hablar solo a los miembros.
-- =====================================================================

create table public.salas_coworking (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 3 and 60),
  clave_hash text,                                   -- null = sala abierta
  creada_por uuid not null references public.perfiles (id) on delete cascade default auth.uid(),
  creado_en timestamptz not null default now()
);
create index salas_coworking_creada_por_idx on public.salas_coworking (creada_por);

create table public.sala_miembros (
  id_sala uuid not null references public.salas_coworking (id) on delete cascade,
  id_usuario uuid not null references public.perfiles (id) on delete cascade,
  unido_en timestamptz not null default now(),
  primary key (id_sala, id_usuario)
);
create index sala_miembros_usuario_idx on public.sala_miembros (id_usuario);

-- Chat por sala: canales de tipo 'sala'
alter table public.canales drop constraint canales_tipo_check;
alter table public.canales drop constraint canales_check;
alter table public.canales add column id_sala uuid unique references public.salas_coworking (id) on delete cascade;
alter table public.canales add constraint canales_tipo_check check (tipo in ('foro', 'proyecto', 'sala'));
alter table public.canales add constraint canales_check check (
  (tipo = 'proyecto') = (id_proyecto is not null) and (tipo = 'sala') = (id_sala is not null));

-- ---------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------
create or replace function public.es_miembro_sala(sala uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.sala_miembros where id_sala = sala and id_usuario = auth.uid());
$$;

/** Crea la sala (con contraseña opcional), su chat y deja a quien la crea como miembro. */
create or replace function public.crear_sala(nombre text, clave text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  nueva uuid;
begin
  if not public.acceso_aprobado() then
    raise exception 'Necesitas acceso aprobado para crear salas';
  end if;
  if clave is not null and length(clave) between 1 and 3 then
    raise exception 'La contraseña debe tener al menos 4 caracteres';
  end if;
  insert into public.salas_coworking (nombre, clave_hash, creada_por)
  values (trim(nombre),
          case when coalesce(clave, '') = '' then null else extensions.crypt(clave, extensions.gen_salt('bf', 8)) end,
          auth.uid())
  returning id into nueva;
  insert into public.sala_miembros (id_sala, id_usuario) values (nueva, auth.uid());
  insert into public.canales (nombre, descripcion, tipo, id_sala) values (trim(nombre), 'Chat de la sala', 'sala', nueva);
  return nueva;
end;
$$;

/** Unirse con la contraseña. Devuelve false si no coincide (sin decir si la sala existe o no). */
create or replace function public.unirse_sala(sala uuid, clave text default null)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  hash text;
  existe boolean;
begin
  if not public.acceso_aprobado() then
    return false;
  end if;
  select true, s.clave_hash into existe, hash from public.salas_coworking s where s.id = sala;
  if not coalesce(existe, false) then
    return false;
  end if;
  if hash is not null and (clave is null or extensions.crypt(clave, hash) <> hash) then
    return false;
  end if;
  insert into public.sala_miembros (id_sala, id_usuario) values (sala, auth.uid()) on conflict do nothing;
  return true;
end;
$$;

-- El chat de una sala solo lo ven sus miembros
create or replace function public.puede_ver_canal(canal uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_cde() or exists (
    select 1 from public.canales k
    where k.id = canal
      and (k.tipo = 'foro'
           or (k.tipo = 'sala' and public.es_miembro_sala(k.id_sala))
           or k.id_proyecto in (select public.proyectos_del_docente()
                                union select public.proyectos_del_estudiante()
                                union select p.id from public.proyectos_aula p
                                      where p.id_empresa in (select public.mis_empresas()))));
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.salas_coworking enable row level security;
alter table public.sala_miembros enable row level security;

-- Todos los aprobados ven la lista de salas; el hash de la contraseña nunca sale de la base
create policy aprobados_ven_salas on public.salas_coworking for select to authenticated using (true);
create policy creador_o_cde_borra_sala on public.salas_coworking
  for delete to authenticated using (creada_por = (select auth.uid()) or public.es_cde());
create policy solo_acceso_aprobado on public.salas_coworking as restrictive for all to authenticated
  using (public.acceso_aprobado()) with check (public.acceso_aprobado());
revoke select on public.salas_coworking from anon, authenticated;
grant select (id, nombre, creada_por, creado_en) on public.salas_coworking to authenticated;

create policy miembros_ven_miembros on public.sala_miembros
  for select to authenticated using (public.es_miembro_sala(id_sala) or public.es_cde());
create policy usuario_sale_de_sala on public.sala_miembros
  for delete to authenticated using (id_usuario = (select auth.uid()));
create policy solo_acceso_aprobado on public.sala_miembros as restrictive for all to authenticated
  using (public.acceso_aprobado()) with check (public.acceso_aprobado());

-- Si la sala tiene contraseña (sin exponer el hash)
create or replace function public.sala_tiene_clave(sala uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select clave_hash is not null from public.salas_coworking where id = sala;
$$;

create or replace view public.salas_coworking_lista with (security_invoker = true) as
select s.id, s.nombre, s.creada_por, s.creado_en,
       public.sala_tiene_clave(s.id) as tiene_clave,
       public.es_miembro_sala(s.id) as soy_miembro,
       (select count(*) from public.sala_miembros m where m.id_sala = s.id) as miembros
from public.salas_coworking s;
grant select on public.salas_coworking_lista to authenticated;

-- Realtime: la sala principal para todos los aprobados; las demás solo para sus miembros
drop policy coworking_escuchar on realtime.messages;
drop policy coworking_enviar on realtime.messages;
create or replace function public.puede_entrar_sala_realtime(tema text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.acceso_aprobado() and (
    tema = 'coworking:principal'
    or exists (select 1 from public.sala_miembros m
               where 'coworking:' || m.id_sala::text = tema and m.id_usuario = auth.uid()));
$$;
create policy coworking_escuchar on realtime.messages
  for select to authenticated using (public.puede_entrar_sala_realtime(realtime.topic()));
create policy coworking_enviar on realtime.messages
  for insert to authenticated with check (public.puede_entrar_sala_realtime(realtime.topic()));

revoke execute on function public.crear_sala(text, text), public.unirse_sala(uuid, text), public.es_miembro_sala(uuid),
  public.sala_tiene_clave(uuid), public.puede_entrar_sala_realtime(text) from public, anon;
grant execute on function public.crear_sala(text, text), public.unirse_sala(uuid, text), public.es_miembro_sala(uuid),
  public.sala_tiene_clave(uuid), public.puede_entrar_sala_realtime(text) to authenticated;
