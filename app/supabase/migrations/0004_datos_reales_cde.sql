-- =====================================================================
-- CDE UNAB · Estructura para los datos reales del Cuadro de control
-- Fuentes: empresas_postuladas.csv, empresas_proyectos_de_aula, proyectos_de_aula_resumen,
--          cronograma_cde (exportados del Cuadro de control en Apps Script, 28/10/2026)
-- =====================================================================

create extension if not exists unaccent with schema extensions;

-- ---------- Empresas: campos que trae la fuente ----------
alter table public.empresas
  add column nit_dv smallint check (nit_dv between 0 and 9),
  add column descripcion text,                 -- "Qué ofrece"
  add column municipio text,
  add column departamento text;
-- Sin dato ≠ Externo: el vínculo queda vacío hasta que se registre
alter table public.empresas alter column vinculo_unab drop not null, alter column vinculo_unab drop default;

-- Sectores que aparecen en los datos reales y no estaban en el catálogo
insert into public.sectores (nombre) values
  ('Actividades Veterinarias'), ('Publicidad'), ('Recreación y Deportes'), ('Sector Inmobiliario'),
  ('Sector Transporte y Logística')
on conflict do nothing;

-- ---------- Postulaciones (una empresa puede postularse varias veces) ----------
create table public.postulaciones (
  id uuid primary key,                           -- "ID postulación" del CRM
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  origen text not null check (origen in ('Postuladas por formulario', 'Creadas por estudiantes')),
  origen_registro text not null,                 -- Formulario de postulación, Estudiante, Evento, Autodiagnóstico, Agendamiento de cita
  estado text not null check (estado in ('Por aprobar', 'Seleccionadas', 'En proceso', 'Finalizado', 'Saldo disponible')),
  nit_reportado text,                            -- el NIT tal como se escribió (trazabilidad de la limpieza)
  creado_en timestamptz not null default now()
);
create index postulaciones_empresa_idx on public.postulaciones (id_empresa);

-- ---------- Proyectos de aula: datos que trae el consolidado ----------
alter table public.proyectos_aula
  alter column asignatura drop not null,         -- el consolidado por empresa no dice la asignatura
  add column estudiantes_reportados smallint;    -- nº de estudiantes según el Cuadro de control

-- Carga docente: docente × asignatura (los docentes aún no tienen cuenta en el sistema;
-- al registrarse se enlazan con id_perfil y sus proyectos pasan a proyecto_docentes)
create table public.carga_docente (
  id uuid primary key default gen_random_uuid(),
  docente text not null,
  id_perfil uuid references public.perfiles (id) on delete set null,
  asignatura text not null,
  semestre text not null check (semestre ~ '^[0-9]{4}-[12]$'),
  proyectos smallint not null,
  estudiantes smallint not null,
  unique (docente, asignatura, semestre)
);

-- ---------- Cronograma del CDE ----------
create table public.actividades_cronograma (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  actividad text not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  hora_inicio time,                              -- null = todo el día
  hora_fin time,
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'En curso', 'Completada', 'Cancelada')),
  responsable text,
  detalle text,
  creado_en timestamptz not null default now(),
  constraint fechas_ordenadas check (fecha_fin >= fecha_inicio)
);
create index actividades_cronograma_fin_idx on public.actividades_cronograma (fecha_fin);

-- La situación se calcula, no se guarda: "Vencida" cambia sola con el paso de los días
create view public.cronograma with (security_invoker = true) as
select a.*,
       (a.fecha_fin - a.fecha_inicio + 1) as duracion_dias,
       case when a.estado in ('Completada', 'Cancelada') then a.estado
            when a.fecha_fin < (now() at time zone 'America/Bogota')::date then 'Vencida'
            else 'Pendiente' end as situacion
from public.actividades_cronograma a;

-- ---------- Posibles duplicados para revisión humana ----------
create view public.posibles_duplicados with (security_invoker = true) as
select a.id as id_empresa_a, a.nombre as nombre_a, a.nit as nit_a,
       b.id as id_empresa_b, b.nombre as nombre_b, b.nit as nit_b,
       round(extensions.similarity(lower(extensions.unaccent(a.nombre)), lower(extensions.unaccent(b.nombre)))::numeric, 2) as similitud
from public.empresas a
join public.empresas b on a.id < b.id
where extensions.similarity(lower(extensions.unaccent(a.nombre)), lower(extensions.unaccent(b.nombre))) >= 0.7;

-- ---------- Auditoría ----------
create trigger postulaciones_auditoria after insert or update or delete on public.postulaciones
  for each row execute function public.auditar();
create trigger carga_docente_auditoria after insert or update or delete on public.carga_docente
  for each row execute function public.auditar();
create trigger actividades_cronograma_auditoria after insert or update or delete on public.actividades_cronograma
  for each row execute function public.auditar();

-- ---------- RLS ----------
alter table public.postulaciones          enable row level security;
alter table public.carga_docente          enable row level security;
alter table public.actividades_cronograma enable row level security;

create policy cde_todo on public.postulaciones
  for all to authenticated using (public.es_cde()) with check (public.es_cde());
create policy cde_todo on public.carga_docente
  for all to authenticated using (public.es_cde()) with check (public.es_cde());
create policy cde_todo on public.actividades_cronograma
  for all to authenticated using (public.es_cde()) with check (public.es_cde());

-- El docente ve su propia carga una vez enlazado a su perfil
create policy docente_lee_su_carga on public.carga_docente
  for select to authenticated using (id_perfil = (select auth.uid()));

grant select on public.postulaciones, public.carga_docente, public.actividades_cronograma to ia_lectura;
create policy ia_lectura on public.postulaciones          for select to ia_lectura using (true);
create policy ia_lectura on public.carga_docente          for select to ia_lectura using (true);
create policy ia_lectura on public.actividades_cronograma for select to ia_lectura using (true);
grant select on public.cronograma, public.posibles_duplicados to authenticated, ia_lectura;
