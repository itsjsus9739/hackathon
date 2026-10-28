-- =====================================================================
-- CDE UNAB · Control de acceso por correo
--
--   * Correo @unab.edu.co CONFIRMADO → acceso aprobado automáticamente.
--     (Sin confirmar no basta: cualquiera puede registrarse con un correo ajeno.)
--   * Cualquier otro correo → queda 'pendiente' y se crea una solicitud de acceso que
--     revisa el CDE (y, más adelante, una IA que solo recomienda o decide vía servidor).
--   * Mientras no esté aprobado, el usuario solo ve su perfil y su solicitud: una política
--     RESTRICTIVE en cada tabla se suma (AND) a todas las políticas existentes.
-- =====================================================================

create type public.estado_acceso as enum ('pendiente', 'aprobado', 'rechazado');

alter table public.perfiles
  add column estado_acceso public.estado_acceso not null default 'pendiente';

-- ---------------------------------------------------------------------
-- Reglas
-- ---------------------------------------------------------------------
create or replace function public.es_correo_institucional(correo text)
returns boolean
language sql immutable set search_path = ''
as $$
  -- Solo el dominio exacto: "x@unab.edu.co.otro.com" o "x@otraunab.edu.co" no cuentan
  select coalesce(lower(trim(correo)) ~ '^[^@\s]+@unab\.edu\.co$', false);
$$;

create or replace function public.acceso_aprobado()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and estado_acceso = 'aprobado');
$$;

-- El rol CDE solo cuenta si además el acceso está aprobado
create or replace function public.es_cde()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.perfiles
                 where id = auth.uid() and rol::text in ('cde', 'admin_cde') and estado_acceso = 'aprobado');
$$;

create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.perfiles
                 where id = auth.uid() and rol::text = 'admin_cde' and estado_acceso = 'aprobado');
$$;

-- ---------------------------------------------------------------------
-- Solicitudes de acceso (correos no institucionales)
-- ---------------------------------------------------------------------
create table public.solicitudes_acceso (
  id uuid primary key default gen_random_uuid(),
  id_perfil uuid not null unique references public.perfiles (id) on delete cascade,
  correo text not null,
  rol_solicitado public.rol_usuario not null default 'emprendedor'
    check (rol_solicitado::text in ('emprendedor', 'docente', 'estudiante')),   -- nunca roles del CDE
  motivo text,                                   -- quién es y para qué necesita acceso (lo escribe el usuario)
  estado public.estado_acceso not null default 'pendiente',
  revisado_por uuid references public.perfiles (id),
  revisor_tipo text check (revisor_tipo in ('cde', 'ia')),
  comentario_revision text,                      -- motivo de la aprobación o del rechazo
  -- Preparado para la IA revisora (aún no existe): deja su recomendación, el CDE decide
  recomendacion_ia public.estado_acceso check (recomendacion_ia <> 'pendiente'),
  confianza_ia numeric(3,2) check (confianza_ia between 0 and 1),
  justificacion_ia text,
  creado_en timestamptz not null default now(),
  revisado_en timestamptz
);
create index solicitudes_acceso_pendientes_idx on public.solicitudes_acceso (creado_en) where estado = 'pendiente';

-- ---------------------------------------------------------------------
-- Registro de usuarios: perfil + estado de acceso + solicitud si aplica
-- ---------------------------------------------------------------------
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  institucional boolean := public.es_correo_institucional(new.email);
  rol_pedido text := new.raw_user_meta_data ->> 'rol_solicitado';
begin
  -- El rol SIEMPRE arranca en 'emprendedor': raw_user_meta_data lo controla el usuario
  insert into public.perfiles (id, nombre, estado_acceso)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
          (case when institucional and new.email_confirmed_at is not null then 'aprobado' else 'pendiente' end)::public.estado_acceso);

  -- Correo externo → solicitud para revisión. (El institucional sin confirmar solo espera la confirmación.)
  if not institucional then
    insert into public.solicitudes_acceso (id_perfil, correo, rol_solicitado, motivo)
    values (new.id, lower(new.email),
            (case when rol_pedido in ('emprendedor', 'docente', 'estudiante') then rol_pedido else 'emprendedor' end)::public.rol_usuario,
            left(new.raw_user_meta_data ->> 'motivo', 2000));
  end if;
  return new;
end;
$$;

-- Al confirmar el correo (o cambiarlo) se reevalúa: un institucional confirmado se aprueba;
-- quien deja de tener correo institucional y no fue aprobado por el CDE vuelve a revisión.
create or replace function public.reevaluar_acceso_usuario()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if public.es_correo_institucional(new.email) and new.email_confirmed_at is not null then
    update public.perfiles set estado_acceso = 'aprobado'
    where id = new.id and estado_acceso = 'pendiente';
  elsif not public.es_correo_institucional(new.email) then
    insert into public.solicitudes_acceso (id_perfil, correo)
    values (new.id, lower(new.email))
    on conflict (id_perfil) do update set correo = excluded.correo;
    update public.perfiles p set estado_acceso = 'pendiente'
    where p.id = new.id and p.estado_acceso = 'aprobado'
      and not exists (select 1 from public.solicitudes_acceso s where s.id_perfil = p.id and s.estado = 'aprobado');
  end if;
  return new;
end;
$$;
create trigger al_confirmar_o_cambiar_correo
  after update of email, email_confirmed_at on auth.users
  for each row execute function public.reevaluar_acceso_usuario();

-- Decidir una solicitud actualiza el perfil (estado y rol aprobado) y deja rastro de quién decidió
create or replace function public.aplicar_decision_solicitud()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.estado is distinct from old.estado then
    new.revisado_en := now();
    if auth.uid() is not null then
      new.revisado_por := auth.uid();
      new.revisor_tipo := 'cde';
    else
      new.revisor_tipo := coalesce(new.revisor_tipo, 'ia');   -- proceso de servidor (futura IA)
    end if;
    update public.perfiles
    set estado_acceso = new.estado,
        rol = case when new.estado = 'aprobado' then new.rol_solicitado else rol end
    where id = new.id_perfil;
  end if;
  return new;
end;
$$;
create trigger solicitudes_acceso_decision before update on public.solicitudes_acceso
  for each row execute function public.aplicar_decision_solicitud();
create trigger solicitudes_acceso_auditoria after insert or update or delete on public.solicitudes_acceso
  for each row execute function public.auditar();

-- ---------------------------------------------------------------------
-- RLS de solicitudes
-- ---------------------------------------------------------------------
alter table public.solicitudes_acceso enable row level security;

create policy cde_todo on public.solicitudes_acceso
  for all to authenticated using (public.es_cde()) with check (public.es_cde());
create policy usuario_lee_su_solicitud on public.solicitudes_acceso
  for select to authenticated using (id_perfil = (select auth.uid()));
-- Mientras esté pendiente, el usuario puede completar su motivo y el rol que pide (no decidir)
create policy usuario_completa_su_solicitud on public.solicitudes_acceso
  for update to authenticated
  using (id_perfil = (select auth.uid()) and estado = 'pendiente')
  with check (id_perfil = (select auth.uid()) and estado = 'pendiente' and revisado_por is null
              and revisor_tipo is null and comentario_revision is null
              and recomendacion_ia is null and confianza_ia is null and justificacion_ia is null);
grant select on public.solicitudes_acceso to ia_lectura;
create policy ia_lectura on public.solicitudes_acceso for select to ia_lectura using (true);

-- ---------------------------------------------------------------------
-- Candado: sin acceso aprobado no se ve nada más (RESTRICTIVE = se exige además de las demás)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and rowsecurity and tablename not in ('perfiles', 'solicitudes_acceso')
  loop
    execute format(
      'create policy solo_acceso_aprobado on public.%I as restrictive for all to authenticated
         using (public.acceso_aprobado()) with check (public.acceso_aprobado())', t);
  end loop;
end
$$;
-- En perfiles, el usuario pendiente o rechazado sí ve el suyo (para saber en qué va su solicitud)
create policy solo_acceso_aprobado on public.perfiles as restrictive for all to authenticated
  using (public.acceso_aprobado() or id = (select auth.uid()))
  with check (public.acceso_aprobado());

-- ---------------------------------------------------------------------
-- Permisos de las funciones
-- ---------------------------------------------------------------------
revoke execute on function public.reevaluar_acceso_usuario()  from public, anon, authenticated;
revoke execute on function public.aplicar_decision_solicitud() from public, anon, authenticated;
revoke execute on function public.acceso_aprobado()           from public, anon;
grant execute on function public.acceso_aprobado() to authenticated;
