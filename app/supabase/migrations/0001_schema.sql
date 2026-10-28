-- =====================================================================
-- CDE UNAB · Migración inicial
-- Sistema integrado de gestión de la información del Centro de Desarrollo Empresarial
--
-- Seguridad (ISO/IEC 25010 · Seguridad):
--   * RLS habilitado en TODAS las tablas (sin política = sin acceso).
--   * rol 'cde'         → CRUD total.
--   * rol 'emprendedor' → solo lectura de su perfil, su empresa y sus atenciones.
--   * rol de BD 'ia_lectura' → solo lectura para el asistente con la API de Claude.
--   * Auditoría de toda escritura en la tabla `auditoria`.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos (conjuntos cerrados)
-- ---------------------------------------------------------------------
create type public.rol_usuario as enum ('cde', 'emprendedor', 'docente', 'consultor');
create type public.sexo as enum ('Femenino', 'Masculino');
-- Categorías tal como aparecen en el informe del CDE ("Emprendimiento" es una de ellas)
create type public.tamano_empresa as enum ('Emprendimiento', 'Micro', 'Pequeña', 'Mediana', 'Grande');
create type public.vinculo_unab as enum ('Externo', 'Estudiante', 'Graduado', 'Colaborador', 'Emprendedor');

-- ---------------------------------------------------------------------
-- Catálogos (conjuntos abiertos: el CDE puede agregar valores sin migrar)
-- ---------------------------------------------------------------------
create table public.sectores (
  nombre text primary key
);
insert into public.sectores (nombre) values
  ('Alimentos'), ('Comercio'), ('Servicios'), ('Manufactura / Industrial'), ('Turismo'),
  ('Tecnológico'), ('Audiovisuales, Arte y Cultura'), ('Agropecuario / Minero'), ('ESAL'),
  ('Construcción'), ('Desarrollo WEB'), ('ONG');

create table public.tipos_actividad (
  nombre text primary key
);
insert into public.tipos_actividad (nombre) values
  ('Sesión empresarial'), ('Proyectos de aula'), ('Feria Expounab'), ('Ruta F CDE UNAB'),
  ('Programa: Ruta de Acompañamiento'), ('Business & Bites'), ('Bootcamp'),
  ('Convenio - Aliado CDE'), ('Asesoría empresarial');

-- ---------------------------------------------------------------------
-- 1. Perfiles (extiende auth.users)
-- ---------------------------------------------------------------------
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  rol public.rol_usuario not null default 'emprendedor',
  sexo public.sexo,
  documento_identidad text unique,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Empresas
-- ---------------------------------------------------------------------
create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nit text unique,                                   -- null para negocios informales (UNIQUE admite varios null)
  nombre text not null,
  id_representante uuid references public.perfiles (id) on delete set null,
  sector text references public.sectores (nombre) on update cascade,
  tamano public.tamano_empresa,
  vinculo_unab public.vinculo_unab not null default 'Externo',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint nit_solo_digitos check (nit ~ '^[0-9]{6,15}$')  -- sin puntos, guion ni DV
);
create index empresas_representante_idx on public.empresas (id_representante);
create index empresas_sector_idx on public.empresas (sector);
-- Búsqueda difusa por nombre (detectar duplicados escritos distinto)
create index empresas_nombre_trgm_idx on public.empresas using gin (lower(nombre) extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 3. Atenciones
-- ---------------------------------------------------------------------
create table public.atenciones (
  id uuid primary key default gen_random_uuid(),
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  tipo_actividad text not null references public.tipos_actividad (nombre) on update cascade,
  semestre text not null,
  fecha date not null default current_date,
  notas text,
  creado_en timestamptz not null default now(),
  constraint semestre_formato check (semestre ~ '^[0-9]{4}-[12]$')
);
create index atenciones_empresa_idx on public.atenciones (id_empresa);
create index atenciones_semestre_idx on public.atenciones (semestre);

-- ---------------------------------------------------------------------
-- 4. Eventos
-- ---------------------------------------------------------------------
create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  fecha timestamptz not null,
  puntos_gamificacion integer not null default 0 check (puntos_gamificacion >= 0),
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. Inscripciones a eventos (inscritos vs. asistentes)
-- ---------------------------------------------------------------------
create table public.inscripciones_eventos (
  id uuid primary key default gen_random_uuid(),
  id_evento uuid not null references public.eventos (id) on delete cascade,
  id_usuario uuid not null references public.perfiles (id) on delete cascade,
  asistio boolean not null default false,
  inscrito_en timestamptz not null default now(),
  unique (id_evento, id_usuario)
);
create index inscripciones_usuario_idx on public.inscripciones_eventos (id_usuario);

-- ---------------------------------------------------------------------
-- Auditoría: quién hizo qué y cuándo
-- ---------------------------------------------------------------------
create table public.auditoria (
  id bigint generated always as identity primary key,
  tabla text not null,
  registro_id text,
  accion text not null,
  usuario_id uuid default auth.uid(),
  datos jsonb,
  creado_en timestamptz not null default now()
);

-- =====================================================================
-- Funciones y triggers
-- =====================================================================

-- ¿El usuario autenticado tiene rol 'cde'? SECURITY DEFINER evita recursión con el RLS de perfiles.
create or replace function public.es_cde()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'cde');
$$;

-- Al registrarse un usuario se crea su perfil. El rol SIEMPRE es 'emprendedor':
-- nunca se toma de raw_user_meta_data porque el propio usuario controla ese campo.
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

create or replace function public.marcar_actualizado()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;
create trigger perfiles_actualizado before update on public.perfiles
  for each row execute function public.marcar_actualizado();
create trigger empresas_actualizado before update on public.empresas
  for each row execute function public.marcar_actualizado();

-- Normaliza el NIT antes de validar ("900.123.456-7" → "900123456")
create or replace function public.normalizar_nit()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.nit is not null then
    new.nit := nullif(regexp_replace(split_part(new.nit, '-', 1), '[^0-9]', '', 'g'), '');
  end if;
  return new;
end;
$$;
create trigger empresas_normalizar_nit before insert or update of nit on public.empresas
  for each row execute function public.normalizar_nit();

create or replace function public.auditar()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.auditoria (tabla, registro_id, accion, datos)
  values (tg_table_name, coalesce(new.id, old.id)::text, tg_op,
          case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end;
$$;
create trigger perfiles_auditoria after insert or update or delete on public.perfiles
  for each row execute function public.auditar();
create trigger empresas_auditoria after insert or update or delete on public.empresas
  for each row execute function public.auditar();
create trigger atenciones_auditoria after insert or update or delete on public.atenciones
  for each row execute function public.auditar();
create trigger eventos_auditoria after insert or update or delete on public.eventos
  for each row execute function public.auditar();
create trigger inscripciones_auditoria after insert or update or delete on public.inscripciones_eventos
  for each row execute function public.auditar();

-- =====================================================================
-- Row Level Security: habilitado en absolutamente todas las tablas
-- =====================================================================
alter table public.sectores              enable row level security;
alter table public.tipos_actividad       enable row level security;
alter table public.perfiles              enable row level security;
alter table public.empresas              enable row level security;
alter table public.atenciones            enable row level security;
alter table public.eventos               enable row level security;
alter table public.inscripciones_eventos enable row level security;
alter table public.auditoria             enable row level security;

-- ---------- Rol 'cde': acceso total (CRUD) ----------
create policy cde_todo on public.sectores
  for all to authenticated using (public.es_cde()) with check (public.es_cde());
create policy cde_todo on public.tipos_actividad
  for all to authenticated using (public.es_cde()) with check (public.es_cde());
create policy cde_todo on public.perfiles
  for all to authenticated using (public.es_cde()) with check (public.es_cde());
create policy cde_todo on public.empresas
  for all to authenticated using (public.es_cde()) with check (public.es_cde());
create policy cde_todo on public.atenciones
  for all to authenticated using (public.es_cde()) with check (public.es_cde());
create policy cde_todo on public.eventos
  for all to authenticated using (public.es_cde()) with check (public.es_cde());
create policy cde_todo on public.inscripciones_eventos
  for all to authenticated using (public.es_cde()) with check (public.es_cde());
-- La auditoría solo se consulta: nadie la edita ni la borra (la escribe el trigger)
create policy cde_lectura on public.auditoria
  for select to authenticated using (public.es_cde());

-- ---------- Rol 'emprendedor': solo lectura de lo propio ----------
create policy emprendedor_lee_su_perfil on public.perfiles
  for select to authenticated using (id = (select auth.uid()));

create policy emprendedor_lee_su_empresa on public.empresas
  for select to authenticated using (id_representante = (select auth.uid()));

create policy emprendedor_lee_sus_atenciones on public.atenciones
  for select to authenticated
  using (id_empresa in (select id from public.empresas where id_representante = (select auth.uid())));

-- Sin políticas de INSERT/UPDATE/DELETE para el emprendedor: no puede escribir
-- (en particular, no puede cambiarse el rol a 'cde').

-- =====================================================================
-- Rol de base de datos 'ia_lectura' (asistente con la API de Claude)
-- =====================================================================
-- Se crea sin LOGIN y sin contraseña en el repositorio. Para habilitarlo, en el SQL Editor:
--   alter role ia_lectura with login password '<contraseña-larga-aleatoria>';
-- y usar esa cadena de conexión SOLO en el servidor (variable de entorno).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ia_lectura') then
    create role ia_lectura nologin noinherit;
  end if;
end
$$;

-- Ninguna sesión de este rol puede escribir, y las consultas pesadas se cortan
alter role ia_lectura set default_transaction_read_only = on;
alter role ia_lectura set statement_timeout = '10s';

grant usage on schema public to ia_lectura;
grant usage on schema extensions to ia_lectura;
grant select on public.sectores, public.tipos_actividad, public.empresas, public.atenciones,
                public.eventos, public.inscripciones_eventos to ia_lectura;
-- Datos personales (Ley 1581): la IA ve el perfil pero NO el documento de identidad
grant select (id, nombre, rol, sexo, creado_en) on public.perfiles to ia_lectura;
-- Sin acceso a auditoria ni a auth.*; tampoco a tablas futuras (hay que concederlas explícitamente)
revoke all on public.auditoria from ia_lectura;

-- Con RLS activo, el rol necesita políticas propias de lectura
create policy ia_lectura on public.sectores              for select to ia_lectura using (true);
create policy ia_lectura on public.tipos_actividad       for select to ia_lectura using (true);
create policy ia_lectura on public.perfiles              for select to ia_lectura using (true);
create policy ia_lectura on public.empresas              for select to ia_lectura using (true);
create policy ia_lectura on public.atenciones            for select to ia_lectura using (true);
create policy ia_lectura on public.eventos               for select to ia_lectura using (true);
create policy ia_lectura on public.inscripciones_eventos for select to ia_lectura using (true);

-- =====================================================================
-- Vistas de conocimiento (respetan el RLS de quien consulta)
-- =====================================================================
create view public.asistencia_eventos with (security_invoker = true) as
select e.id, e.nombre, e.fecha,
       count(i.id) as inscritos,
       count(i.id) filter (where i.asistio) as asistentes,
       round(100.0 * count(i.id) filter (where i.asistio) / nullif(count(i.id), 0), 1) as tasa_asistencia
from public.eventos e
left join public.inscripciones_eventos i on i.id_evento = e.id
group by e.id;

create view public.atenciones_por_semestre with (security_invoker = true) as
select semestre, count(*) as atenciones, count(distinct id_empresa) as empresas_unicas
from public.atenciones
group by semestre;

grant select on public.asistencia_eventos, public.atenciones_por_semestre to authenticated, ia_lectura;
