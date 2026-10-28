-- =====================================================================
-- CDE UNAB · Modelo según el diagrama de roles del equipo
--
--   CDE Admin ──► Miembro CDE ──► Proyectos (programas), Ruta de acompañamiento,
--                                 Asesorías y citas, Emprendimientos
--             ──► Docente ──► Proyectos de aula, sus Estudiantes
--             ──► Estudiantes ──► Asignaturas ──► Proyecto A / Proyecto B
--             ──► Emprendedores ──► Diagnóstico de madurez, Emprendimientos, Ruta de
--                                   acompañamiento, Capacitaciones, Proyecto de aula propio
--   Eventos, conversatorios y networking: todos participan.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CDE Admin por encima del Miembro CDE ('cde' = Miembro CDE)
--    (se compara como texto: un valor nuevo de enum no puede usarse en la misma transacción)
-- ---------------------------------------------------------------------
alter type public.rol_usuario add value if not exists 'admin_cde' before 'cde';

create or replace function public.es_cde()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol::text in ('cde', 'admin_cde'));
$$;

create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol::text = 'admin_cde');
$$;

-- Solo el CDE Admin crea, cambia de rol o elimina perfiles; el Miembro CDE los consulta
drop policy cde_todo on public.perfiles;
create policy cde_lee_perfiles on public.perfiles
  for select to authenticated using (public.es_cde());
create policy admin_gestiona_perfiles on public.perfiles
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- ---------------------------------------------------------------------
-- 2. Asignaturas: el docente las dicta, el estudiante las cursa, los proyectos viven en ellas
-- ---------------------------------------------------------------------
create table public.asignaturas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  creado_en timestamptz not null default now()
);

create table public.asignatura_docentes (
  id_asignatura uuid not null references public.asignaturas (id) on delete cascade,
  id_docente uuid not null references public.perfiles (id) on delete cascade,
  semestre text not null check (semestre ~ '^[0-9]{4}-[12]$'),
  primary key (id_asignatura, id_docente, semestre)
);
create index asignatura_docentes_docente_idx on public.asignatura_docentes (id_docente);

create table public.asignatura_estudiantes (
  id_asignatura uuid not null references public.asignaturas (id) on delete cascade,
  id_estudiante uuid not null references public.perfiles (id) on delete cascade,
  semestre text not null check (semestre ~ '^[0-9]{4}-[12]$'),
  primary key (id_asignatura, id_estudiante, semestre)
);
create index asignatura_estudiantes_estudiante_idx on public.asignatura_estudiantes (id_estudiante);

create trigger asignatura_docentes_validar before insert or update on public.asignatura_docentes
  for each row execute function public.validar_rol_asignado('docente', 'id_docente');
create trigger asignatura_estudiantes_validar before insert or update on public.asignatura_estudiantes
  for each row execute function public.validar_rol_asignado('estudiante', 'id_estudiante');

-- Las 11 asignaturas del consolidado de proyectos de aula
insert into public.asignaturas (nombre)
select distinct asignatura from public.carga_docente
on conflict do nothing;

alter table public.carga_docente add column id_asignatura uuid references public.asignaturas (id);
update public.carga_docente c set id_asignatura = a.id from public.asignaturas a where a.nombre = c.asignatura;

-- Proyecto de aula → asignatura (reemplaza el texto libre)
drop view public.resumen_proyectos;
alter table public.proyectos_aula
  drop column asignatura,
  add column id_asignatura uuid references public.asignaturas (id) on delete set null;
create index proyectos_aula_asignatura_idx on public.proyectos_aula (id_asignatura);

create or replace function public.proteger_campos_proyecto()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- Sin sesión (SQL Editor, scripts del servidor) no se restringe: RLS ya decide quién llega aquí
  if auth.uid() is not null and not public.es_cde() and (
       new.id_empresa is distinct from old.id_empresa
    or new.nombre is distinct from old.nombre
    or new.id_asignatura is distinct from old.id_asignatura
    or new.semestre is distinct from old.semestre) then
    raise exception 'Solo el CDE puede cambiar la empresa, el nombre, la asignatura o el semestre del proyecto';
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

create view public.resumen_proyectos with (security_invoker = true) as
select p.id, p.nombre, a.nombre as asignatura, p.semestre, p.estado, e.nombre as empresa,
       -- estudiantes registrados en el sistema o, si aún no hay, los que reportó el Cuadro de control
       coalesce(nullif((select count(*) from public.proyecto_estudiantes pe where pe.id_proyecto = p.id), 0),
                p.estudiantes_reportados) as estudiantes
from public.proyectos_aula p
join public.empresas e on e.id = p.id_empresa
left join public.asignaturas a on a.id = p.id_asignatura;
grant select on public.resumen_proyectos to authenticated, ia_lectura;

-- El docente ve los proyectos asignados y todos los de las asignaturas que dicta
create or replace function public.proyectos_del_docente()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select id_proyecto from public.proyecto_docentes where id_docente = auth.uid()
  union
  select p.id from public.proyectos_aula p
  join public.asignatura_docentes ad on ad.id_asignatura = p.id_asignatura and ad.semestre = p.semestre
  where ad.id_docente = auth.uid();
$$;

create or replace function public.asignaturas_del_docente()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select id_asignatura from public.asignatura_docentes where id_docente = auth.uid();
$$;

-- Empresas de las que el usuario es representante (un emprendedor puede tener varias)
create or replace function public.mis_empresas()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.empresas where id_representante = auth.uid();
$$;

-- Directorio ampliado: también los estudiantes de las asignaturas del docente
-- y los docentes/estudiantes del proyecto de aula de la empresa del emprendedor
create or replace function public.directorio()
returns table (id uuid, nombre text, rol public.rol_usuario)
language sql stable security definer set search_path = ''
as $$
  with mis_proyectos as (
    select public.proyectos_del_docente()
    union select public.proyectos_del_estudiante()
    union select p.id from public.proyectos_aula p where p.id_empresa in (select public.mis_empresas())
  )
  select p.id, p.nombre, p.rol
  from public.perfiles p
  where public.es_cde()
     or p.id = auth.uid()
     or p.id in (select id_docente from public.proyecto_docentes where id_proyecto in (select * from mis_proyectos))
     or p.id in (select id_estudiante from public.proyecto_estudiantes where id_proyecto in (select * from mis_proyectos))
     or p.id in (select ad.id_docente from public.asignatura_docentes ad
                 join public.proyectos_aula pa on pa.id_asignatura = ad.id_asignatura and pa.semestre = ad.semestre
                 where pa.id in (select * from mis_proyectos))
     or p.id in (select id_estudiante from public.asignatura_estudiantes
                 where id_asignatura in (select public.asignaturas_del_docente()));
$$;

-- ---------------------------------------------------------------------
-- 3. Diagnóstico de madurez empresarial (escala 1–5, áreas del autodiagnóstico del CDE)
-- ---------------------------------------------------------------------
create table public.diagnosticos (
  id uuid primary key default gen_random_uuid(),
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  fecha date not null default current_date,
  tipo_iniciativa text,                         -- Emprendedor (Solopreneur), MiPyME Tradicional, ESAL…
  estrategia numeric(2,1) not null check (estrategia between 1 and 5),        -- Gestión de Estrategia Empresarial
  mercadeo_ventas numeric(2,1) not null check (mercadeo_ventas between 1 and 5),
  financiera numeric(2,1) not null check (financiera between 1 and 5),
  normativa_legal numeric(2,1) not null check (normativa_legal between 1 and 5),
  productividad numeric(2,1) not null check (productividad between 1 and 5),
  transformacion_digital numeric(2,1) not null check (transformacion_digital between 1 and 5),
  promedio numeric(3,2) generated always as (
    round((estrategia + mercadeo_ventas + financiera + normativa_legal + productividad + transformacion_digital) / 6, 2)
  ) stored,
  nivel text check (nivel in ('Bajo', 'Medio', 'Alto')),
  realizado_por uuid references public.perfiles (id) default auth.uid(),
  creado_en timestamptz not null default now()
);
create index diagnosticos_empresa_idx on public.diagnosticos (id_empresa, fecha desc);

-- ---------------------------------------------------------------------
-- 4. Asesorías y citas con emprendedores
-- ---------------------------------------------------------------------
create table public.citas (
  id uuid primary key default gen_random_uuid(),
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  solicitada_por uuid references public.perfiles (id) default auth.uid(),
  id_miembro_cde uuid references public.perfiles (id),
  motivo text not null,
  estado text not null default 'Solicitada'
    check (estado in ('Solicitada', 'Agendada', 'Atendida', 'Cancelada', 'No asistió')),
  fecha_hora timestamptz,
  notas text,
  recordatorio_enviado_en timestamptz,
  creado_en timestamptz not null default now()
);
create index citas_empresa_idx on public.citas (id_empresa);
create index citas_fecha_idx on public.citas (fecha_hora) where estado = 'Agendada';

-- ---------------------------------------------------------------------
-- 5. Eventos: tipo (capacitaciones, ruta, sesiones…) y vínculo con el cronograma
-- ---------------------------------------------------------------------
alter table public.eventos
  add column tipo text not null default 'Evento'
    check (tipo in ('Evento', 'Capacitación', 'Ruta de acompañamiento', 'Sesión empresarial', 'Conversatorio', 'Networking', 'Feria')),
  add column descripcion text,
  add column lugar text,
  add column cupo integer check (cupo > 0),
  add column id_actividad_cronograma uuid references public.actividades_cronograma (id) on delete set null;

-- Puntos de gamificación: solo cuentan las asistencias confirmadas por el CDE
create view public.puntos_usuario with (security_invoker = true) as
select i.id_usuario, sum(e.puntos_gamificacion)::int as puntos, count(*) as eventos_asistidos
from public.inscripciones_eventos i
join public.eventos e on e.id = i.id_evento
where i.asistio
group by i.id_usuario;
grant select on public.puntos_usuario to authenticated, ia_lectura;

-- ---------------------------------------------------------------------
-- 6. Auditoría
-- ---------------------------------------------------------------------
create trigger asignaturas_auditoria after insert or update or delete on public.asignaturas
  for each row execute function public.auditar();
create trigger diagnosticos_auditoria after insert or update or delete on public.diagnosticos
  for each row execute function public.auditar();
create trigger citas_auditoria after insert or update or delete on public.citas
  for each row execute function public.auditar();

-- ---------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------
alter table public.asignaturas            enable row level security;
alter table public.asignatura_docentes    enable row level security;
alter table public.asignatura_estudiantes enable row level security;
alter table public.diagnosticos           enable row level security;
alter table public.citas                  enable row level security;

create policy cde_todo on public.asignaturas
  for all to authenticated using (public.es_cde()) with check (public.es_cde());
create policy cde_todo on public.asignatura_docentes
  for all to authenticated using (public.es_cde()) with check (public.es_cde());
create policy cde_todo on public.asignatura_estudiantes
  for all to authenticated using (public.es_cde()) with check (public.es_cde());
create policy cde_todo on public.diagnosticos
  for all to authenticated using (public.es_cde()) with check (public.es_cde());
create policy cde_todo on public.citas
  for all to authenticated using (public.es_cde()) with check (public.es_cde());

-- Catálogo de asignaturas: lo consulta cualquier usuario con sesión
create policy autenticados_leen_asignaturas on public.asignaturas
  for select to authenticated using (true);

-- Docente: sus asignaturas y los estudiantes inscritos en ellas
create policy docente_lee_sus_asignaturas on public.asignatura_docentes
  for select to authenticated using (id_docente = (select auth.uid()));
create policy docente_lee_estudiantes_de_sus_asignaturas on public.asignatura_estudiantes
  for select to authenticated using (id_asignatura in (select public.asignaturas_del_docente()));

-- Estudiante: sus asignaturas
create policy estudiante_lee_sus_asignaturas on public.asignatura_estudiantes
  for select to authenticated using (id_estudiante = (select auth.uid()));

-- Emprendedor: proyecto de aula propio (y quién lo trabaja), postulaciones, diagnósticos y citas
create policy emprendedor_lee_su_proyecto_aula on public.proyectos_aula
  for select to authenticated using (id_empresa in (select public.mis_empresas()));
create policy emprendedor_lee_equipo_de_su_proyecto on public.proyecto_estudiantes
  for select to authenticated
  using (id_proyecto in (select id from public.proyectos_aula where id_empresa in (select public.mis_empresas())));
create policy emprendedor_lee_docentes_de_su_proyecto on public.proyecto_docentes
  for select to authenticated
  using (id_proyecto in (select id from public.proyectos_aula where id_empresa in (select public.mis_empresas())));
create policy emprendedor_lee_sus_postulaciones on public.postulaciones
  for select to authenticated using (id_empresa in (select public.mis_empresas()));

create policy emprendedor_lee_sus_diagnosticos on public.diagnosticos
  for select to authenticated using (id_empresa in (select public.mis_empresas()));
create policy emprendedor_hace_autodiagnostico on public.diagnosticos
  for insert to authenticated with check (id_empresa in (select public.mis_empresas()));

create policy emprendedor_lee_sus_citas on public.citas
  for select to authenticated using (id_empresa in (select public.mis_empresas()));
create policy emprendedor_solicita_cita on public.citas
  for insert to authenticated
  with check (id_empresa in (select public.mis_empresas()) and estado = 'Solicitada'
              and id_miembro_cde is null and solicitada_por = (select auth.uid()));

-- Docente y estudiante: el diagnóstico de las empresas de sus proyectos (guía la intervención)
create policy academia_lee_diagnosticos on public.diagnosticos
  for select to authenticated
  using (id_empresa in (select id_empresa from public.proyectos_aula
                        where id in (select public.proyectos_del_docente() union select public.proyectos_del_estudiante())));

-- Eventos: todos los ven y se inscriben; la asistencia (y sus puntos) la confirma solo el CDE
create policy autenticados_leen_eventos on public.eventos
  for select to authenticated using (true);
create policy usuario_lee_sus_inscripciones on public.inscripciones_eventos
  for select to authenticated using (id_usuario = (select auth.uid()));
create policy usuario_se_inscribe on public.inscripciones_eventos
  for insert to authenticated with check (id_usuario = (select auth.uid()) and asistio = false);
create policy usuario_cancela_inscripcion on public.inscripciones_eventos
  for delete to authenticated using (id_usuario = (select auth.uid()) and asistio = false);

-- ia_lectura
grant select on public.asignaturas, public.asignatura_docentes, public.asignatura_estudiantes,
                public.diagnosticos, public.citas to ia_lectura;
create policy ia_lectura on public.asignaturas            for select to ia_lectura using (true);
create policy ia_lectura on public.asignatura_docentes    for select to ia_lectura using (true);
create policy ia_lectura on public.asignatura_estudiantes for select to ia_lectura using (true);
create policy ia_lectura on public.diagnosticos           for select to ia_lectura using (true);
create policy ia_lectura on public.citas                  for select to ia_lectura using (true);

-- Funciones nuevas: anon no las ejecuta (asesor de seguridad de Supabase)
revoke execute on function public.es_admin()                 from public, anon;
revoke execute on function public.asignaturas_del_docente()  from public, anon;
revoke execute on function public.mis_empresas()             from public, anon;
grant execute on function public.es_admin(), public.asignaturas_del_docente(), public.mis_empresas() to authenticated;
