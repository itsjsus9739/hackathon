-- =====================================================================
-- CDE UNAB · Roles definitivos y proyectos de aula
--
-- Pirámide de acceso (de mayor a menor):
--   cde        → todo el sistema (CRUD)
--   docente    → sus proyectos de aula (puede tener varios): los ve, actualiza estado y
--                resultados, gestiona los estudiantes de cada uno, y ve la empresa intervenida
--   estudiante → solo lectura de los proyectos en los que participa
--   emprendedor → (cliente, fuera de la pirámide) su perfil, su empresa y sus atenciones
-- =====================================================================

-- 'consultor' pasa a llamarse 'estudiante' (los perfiles existentes conservan el valor)
alter type public.rol_usuario rename value 'consultor' to 'estudiante';

create type public.estado_proyecto as enum ('Planeado', 'En curso', 'Finalizado', 'Cancelado');

-- ---------------------------------------------------------------------
-- Proyectos de aula
-- ---------------------------------------------------------------------
create table public.proyectos_aula (
  id uuid primary key default gen_random_uuid(),
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  nombre text not null,
  asignatura text not null,
  area_intervenida text,                 -- mercadeo, finanzas, operaciones, formalización…
  semestre text not null,
  estado public.estado_proyecto not null default 'Planeado',
  descripcion text,
  resultados text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint proyecto_semestre_formato check (semestre ~ '^[0-9]{4}-[12]$')
);
create index proyectos_aula_empresa_idx on public.proyectos_aula (id_empresa);

-- Un docente puede tener varios proyectos (y un proyecto integrador varios docentes)
create table public.proyecto_docentes (
  id_proyecto uuid not null references public.proyectos_aula (id) on delete cascade,
  id_docente uuid not null references public.perfiles (id) on delete cascade,
  asignado_en timestamptz not null default now(),
  primary key (id_proyecto, id_docente)
);
create index proyecto_docentes_docente_idx on public.proyecto_docentes (id_docente);

create table public.proyecto_estudiantes (
  id_proyecto uuid not null references public.proyectos_aula (id) on delete cascade,
  id_estudiante uuid not null references public.perfiles (id) on delete cascade,
  asignado_en timestamptz not null default now(),
  primary key (id_proyecto, id_estudiante)
);
create index proyecto_estudiantes_estudiante_idx on public.proyecto_estudiantes (id_estudiante);

-- ---------------------------------------------------------------------
-- Funciones auxiliares (SECURITY DEFINER: evitan recursión entre políticas)
-- ---------------------------------------------------------------------
create or replace function public.rol_actual()
returns public.rol_usuario
language sql stable security definer set search_path = ''
as $$
  select rol from public.perfiles where id = auth.uid();
$$;

create or replace function public.proyectos_del_docente()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select id_proyecto from public.proyecto_docentes where id_docente = auth.uid();
$$;

create or replace function public.proyectos_del_estudiante()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select id_proyecto from public.proyecto_estudiantes where id_estudiante = auth.uid();
$$;

-- Solo se asignan perfiles con el rol correcto
create or replace function public.validar_rol_asignado()
returns trigger
language plpgsql security definer set search_path = ''  -- lee el rol aunque RLS oculte el perfil
as $$
declare
  esperado public.rol_usuario := tg_argv[0]::public.rol_usuario;
  -- tg_argv[1] = columna con el perfil (cada tabla puente tiene la suya)
  persona uuid := (to_jsonb(new) ->> tg_argv[1])::uuid;
begin
  if not exists (select 1 from public.perfiles where id = persona and rol = esperado) then
    raise exception 'El perfil % no tiene rol %', persona, esperado;
  end if;
  return new;
end;
$$;
create trigger proyecto_docentes_validar before insert or update on public.proyecto_docentes
  for each row execute function public.validar_rol_asignado('docente', 'id_docente');
create trigger proyecto_estudiantes_validar before insert or update on public.proyecto_estudiantes
  for each row execute function public.validar_rol_asignado('estudiante', 'id_estudiante');

-- El docente actualiza estado, descripción y resultados; solo el CDE cambia empresa, nombre,
-- asignatura o semestre (RLS controla filas, este trigger controla columnas)
create or replace function public.proteger_campos_proyecto()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not public.es_cde() and (
       new.id_empresa is distinct from old.id_empresa
    or new.nombre is distinct from old.nombre
    or new.asignatura is distinct from old.asignatura
    or new.semestre is distinct from old.semestre) then
    raise exception 'Solo el CDE puede cambiar la empresa, el nombre, la asignatura o el semestre del proyecto';
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;
create trigger proyectos_aula_proteger before update on public.proyectos_aula
  for each row execute function public.proteger_campos_proyecto();

create trigger proyectos_aula_auditoria after insert or update or delete on public.proyectos_aula
  for each row execute function public.auditar();
-- Las tablas puente no tienen columna id: se audita con la llave compuesta
create or replace function public.auditar_asignacion()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  fila jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.auditoria (tabla, registro_id, accion, datos)
  values (tg_table_name, fila ->> 'id_proyecto', tg_op, fila);
  return coalesce(new, old);
end;
$$;
create trigger proyecto_docentes_auditoria after insert or update or delete on public.proyecto_docentes
  for each row execute function public.auditar_asignacion();
create trigger proyecto_estudiantes_auditoria after insert or update or delete on public.proyecto_estudiantes
  for each row execute function public.auditar_asignacion();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.proyectos_aula       enable row level security;
alter table public.proyecto_docentes    enable row level security;
alter table public.proyecto_estudiantes enable row level security;

-- ---------- CDE: todo ----------
create policy cde_todo on public.proyectos_aula
  for all to authenticated using (public.es_cde()) with check (public.es_cde());
create policy cde_todo on public.proyecto_docentes
  for all to authenticated using (public.es_cde()) with check (public.es_cde());
create policy cde_todo on public.proyecto_estudiantes
  for all to authenticated using (public.es_cde()) with check (public.es_cde());

-- ---------- Docente ----------
create policy docente_lee_sus_proyectos on public.proyectos_aula
  for select to authenticated using (id in (select public.proyectos_del_docente()));
create policy docente_actualiza_sus_proyectos on public.proyectos_aula
  for update to authenticated
  using (id in (select public.proyectos_del_docente()))
  with check (id in (select public.proyectos_del_docente()));

create policy docente_lee_docentes_de_sus_proyectos on public.proyecto_docentes
  for select to authenticated using (id_proyecto in (select public.proyectos_del_docente()));

-- Ve y gestiona a los estudiantes de sus proyectos
create policy docente_lee_estudiantes on public.proyecto_estudiantes
  for select to authenticated using (id_proyecto in (select public.proyectos_del_docente()));
create policy docente_asigna_estudiantes on public.proyecto_estudiantes
  for insert to authenticated with check (id_proyecto in (select public.proyectos_del_docente()));
create policy docente_retira_estudiantes on public.proyecto_estudiantes
  for delete to authenticated using (id_proyecto in (select public.proyectos_del_docente()));

-- Ve la empresa intervenida y sus atenciones (contexto para guiar el proyecto)
create policy docente_lee_empresas_de_sus_proyectos on public.empresas
  for select to authenticated
  using (id in (select id_empresa from public.proyectos_aula where id in (select public.proyectos_del_docente())));
create policy docente_lee_atenciones_de_sus_empresas on public.atenciones
  for select to authenticated
  using (id_empresa in (select id_empresa from public.proyectos_aula where id in (select public.proyectos_del_docente())));

-- ---------- Estudiante (solo lectura) ----------
create policy estudiante_lee_sus_proyectos on public.proyectos_aula
  for select to authenticated using (id in (select public.proyectos_del_estudiante()));
create policy estudiante_lee_su_equipo on public.proyecto_estudiantes
  for select to authenticated using (id_proyecto in (select public.proyectos_del_estudiante()));
create policy estudiante_lee_sus_docentes on public.proyecto_docentes
  for select to authenticated using (id_proyecto in (select public.proyectos_del_estudiante()));
create policy estudiante_lee_empresas_de_sus_proyectos on public.empresas
  for select to authenticated
  using (id in (select id_empresa from public.proyectos_aula where id in (select public.proyectos_del_estudiante())));

-- ---------------------------------------------------------------------
-- Directorio: nombres de las personas con las que cada quien trabaja,
-- SIN documento de identidad (perfiles completos siguen protegidos por RLS)
-- ---------------------------------------------------------------------
create or replace function public.directorio()
returns table (id uuid, nombre text, rol public.rol_usuario)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.nombre, p.rol
  from public.perfiles p
  where public.es_cde()
     or p.id = auth.uid()
     or p.id in (
       select id_docente from public.proyecto_docentes
       where id_proyecto in (select public.proyectos_del_docente() union select public.proyectos_del_estudiante())
       union
       select id_estudiante from public.proyecto_estudiantes
       where id_proyecto in (select public.proyectos_del_docente() union select public.proyectos_del_estudiante())
     );
$$;
revoke execute on function public.directorio() from public, anon;
grant execute on function public.directorio() to authenticated;

-- Vista para el docente: avance de cada uno de sus proyectos con su equipo
create view public.resumen_proyectos with (security_invoker = true) as
select p.id, p.nombre, p.asignatura, p.semestre, p.estado, e.nombre as empresa,
       (select count(*) from public.proyecto_estudiantes pe where pe.id_proyecto = p.id) as estudiantes
from public.proyectos_aula p
join public.empresas e on e.id = p.id_empresa;
grant select on public.resumen_proyectos to authenticated, ia_lectura;

-- ---------------------------------------------------------------------
-- ia_lectura: solo lectura también de los proyectos
-- ---------------------------------------------------------------------
grant select on public.proyectos_aula, public.proyecto_docentes, public.proyecto_estudiantes to ia_lectura;
create policy ia_lectura on public.proyectos_aula       for select to ia_lectura using (true);
create policy ia_lectura on public.proyecto_docentes    for select to ia_lectura using (true);
create policy ia_lectura on public.proyecto_estudiantes for select to ia_lectura using (true);
