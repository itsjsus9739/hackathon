-- =====================================================================
-- CDE UNAB · Sistema integrado de gestión de la información
-- Esquema base. Regla de oro del reto: TODO cuelga de una empresa
-- (citas, proyectos, planes, eventos, diagnósticos) y no hay duplicados.
-- =====================================================================

create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- ---------- Catálogos ----------
create type rol_usuario as enum ('admin_cde', 'asesor_cde', 'docente', 'consultor', 'emprendedor');
create type tamano_empresa as enum ('micro', 'pequena', 'mediana', 'grande');
create type vinculo_unab as enum ('estudiante', 'graduado', 'colaborador', 'docente', 'externo');
create type estado_formalizacion as enum ('informal', 'en_proceso', 'formal');
create type estado_tarea as enum ('pendiente', 'en_progreso', 'completado', 'vencido', 'cancelado');
create type estado_cita as enum ('solicitada', 'agendada', 'atendida', 'cancelada', 'no_asistio');

create table sectores (
  id serial primary key,
  nombre text unique not null
);

create table municipios (
  id serial primary key,
  nombre text unique not null,
  lat double precision,
  lng double precision
);

-- ---------- Personas y usuarios ----------
-- perfiles = usuarios que inician sesión (enlazado a auth.users de Supabase)
create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  correo text unique not null,
  rol rol_usuario not null default 'emprendedor',
  creado_en timestamptz not null default now()
);

-- Emprendedores / contactos (pueden existir sin cuenta de usuario)
create table personas (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid unique references perfiles(id) on delete set null,
  nombre text not null,
  documento text,                   -- cédula
  correo text,
  correo_norm text generated always as (lower(trim(correo))) stored,
  telefono text,
  vinculo vinculo_unab not null default 'externo',
  programa_academico text,
  acepta_tratamiento_datos boolean not null default false, -- Ley 1581 de 2012
  acepta_tratamiento_en timestamptz,
  creado_en timestamptz not null default now()
);
create unique index personas_documento_uq on personas(documento) where documento is not null;
create unique index personas_correo_uq on personas(correo_norm) where correo_norm is not null;

-- ---------- Empresas (la entidad central) ----------
create table empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nombre_norm text not null default '',            -- lo llena el trigger (sin tildes, minúsculas, sin "SAS")
  nit text,                                         -- solo dígitos, sin DV
  nit_dv smallint,
  tipo_negocio text,
  sector_id int references sectores(id),
  tamano tamano_empresa,
  ingresos_anuales numeric(16,2),
  formalizacion estado_formalizacion,
  municipio_id int references municipios(id),
  direccion text,
  sitio_web text,
  redes text,
  fecha_constitucion date,
  fusionada_en uuid references empresas(id),       -- si se marcó como duplicado
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index empresas_nit_uq on empresas(nit) where nit is not null and fusionada_en is null;
create index empresas_nombre_trgm on empresas using gin (nombre_norm gin_trgm_ops);

create table empresa_personas (
  empresa_id uuid references empresas(id) on delete cascade,
  persona_id uuid references personas(id) on delete cascade,
  rol text not null default 'propietario',          -- propietario, socio, contacto
  primary key (empresa_id, persona_id)
);

-- Normalización para detectar duplicados aunque estén escritos distinto
create or replace function normalizar_nombre(t text) returns text
language sql immutable as $$
  select trim(regexp_replace(
    regexp_replace(lower(unaccent(coalesce(t, ''))),
      '\m(s\.?a\.?s\.?|s\.?a\.?|ltda\.?|e\.?u\.?|s\.?en\.?c\.?|y cia\.?)\M', '', 'g'),
    '[^a-z0-9 ]+|\s+', ' ', 'g'))
$$;

create or replace function empresas_before_write() returns trigger
language plpgsql as $$
begin
  new.nombre_norm := normalizar_nombre(new.nombre);
  new.nit := nullif(regexp_replace(coalesce(new.nit, ''), '[^0-9]', '', 'g'), '');
  new.actualizado_en := now();
  return new;
end $$;
create trigger empresas_bw before insert or update on empresas
  for each row execute function empresas_before_write();

-- Posibles duplicados: mismo NIT o nombre muy parecido (pg_trgm)
create or replace view posibles_duplicados as
select a.id as empresa_a, b.id as empresa_b, a.nombre as nombre_a, b.nombre as nombre_b,
       similarity(a.nombre_norm, b.nombre_norm) as similitud,
       (a.nit is not null and a.nit = b.nit) as mismo_nit
from empresas a
join empresas b on a.id < b.id
where a.fusionada_en is null and b.fusionada_en is null
  and ((a.nit is not null and a.nit = b.nit)
       or (a.nombre_norm % b.nombre_norm and similarity(a.nombre_norm, b.nombre_norm) >= 0.75));

-- ---------- Diagnóstico de madurez ----------
create table dimensiones_madurez (
  id serial primary key,
  nombre text unique not null          -- estrategia, mercadeo, finanzas, operaciones, talento, digital, formalización…
);

create table diagnosticos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  fecha date not null default current_date,
  semestre text not null,              -- '2026-1'
  realizado_por uuid references perfiles(id),
  puntaje_total numeric(5,2),          -- 0–100
  nivel text,                          -- naciente / en desarrollo / consolidado / escalable
  observaciones text
);
create table diagnostico_puntajes (
  diagnostico_id uuid references diagnosticos(id) on delete cascade,
  dimension_id int references dimensiones_madurez(id),
  puntaje numeric(5,2) not null check (puntaje between 0 and 100),
  primary key (diagnostico_id, dimension_id)
);

-- ---------- Proyectos de aula y planes de acción ----------
create table proyectos_aula (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  asignatura text not null,
  docente_id uuid references perfiles(id),
  docente_nombre text,
  area_intervenida text not null,      -- mercadeo, finanzas, operaciones, formalización…
  semestre text not null,
  estado estado_tarea not null default 'en_progreso',
  resultados text,
  es_integrador boolean not null default false,
  creado_en timestamptz not null default now()
);
create table proyecto_consultores (
  proyecto_id uuid references proyectos_aula(id) on delete cascade,
  persona_id uuid references personas(id) on delete cascade,
  primary key (proyecto_id, persona_id)
);

create table planes_accion (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  origen_diagnostico_id uuid references diagnosticos(id),
  origen_proyecto_id uuid references proyectos_aula(id),
  titulo text not null,
  creado_en timestamptz not null default now()
);
create table compromisos (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes_accion(id) on delete cascade,
  descripcion text not null,
  responsable text not null,
  fecha_limite date,
  avance smallint not null default 0 check (avance between 0 and 100),
  estado estado_tarea not null default 'pendiente',
  resultado text,
  actualizado_en timestamptz not null default now()
);

-- ---------- Citas / asesorías ----------
create table citas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  persona_id uuid references personas(id),
  asesor_id uuid references perfiles(id),
  motivo text not null,
  estado estado_cita not null default 'solicitada',
  inicio timestamptz,
  fin timestamptz,
  notas_atencion text,
  recordatorio_enviado_en timestamptz,
  creado_en timestamptz not null default now()
);

-- ---------- Eventos, capacitaciones, inscripciones y asistencia ----------
create table eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text not null default 'capacitacion',   -- capacitacion, evento, conversatorio, networking, ruta
  descripcion text,
  sector_objetivo_id int references sectores(id),
  tema text,                                     -- para segmentar según brechas (p. ej. 'mercadeo digital')
  inicio timestamptz not null,
  lugar text,
  cupo int,
  puntos_asistencia int not null default 50,
  publicado boolean not null default true
);
create table inscripciones (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  codigo_qr text unique not null default encode(gen_random_bytes(12), 'hex'),
  inscrito_en timestamptz not null default now(),
  asistio_en timestamptz,                        -- se llena al escanear el QR
  unique (evento_id, persona_id)
);

-- ---------- Gamificación: formación por recompensas ----------
create table microcursos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tema text not null,
  video_url text,
  puntos int not null default 100,
  orden int not null default 0
);
create table preguntas_quiz (
  id uuid primary key default gen_random_uuid(),
  microcurso_id uuid not null references microcursos(id) on delete cascade,
  enunciado text not null,
  opciones jsonb not null,             -- ["a","b","c"]
  correcta smallint not null
);
create table insignias (
  id serial primary key,
  codigo text unique not null,
  nombre text not null,
  descripcion text,
  icono text
);
-- Libro de puntos: cada acción suma (curso, asistencia, compromiso cumplido, perfil completo)
create table puntos_movimientos (
  id bigserial primary key,
  persona_id uuid not null references personas(id) on delete cascade,
  puntos int not null,
  motivo text not null,                -- 'curso', 'asistencia', 'compromiso', 'perfil', 'reto'
  referencia_id uuid,
  creado_en timestamptz not null default now()
);
create table persona_insignias (
  persona_id uuid references personas(id) on delete cascade,
  insignia_id int references insignias(id),
  obtenida_en timestamptz not null default now(),
  primary key (persona_id, insignia_id)
);
create table recompensas (
  id serial primary key,
  nombre text not null,                -- certificado, prioridad en asesoría, stand en feria…
  costo_puntos int not null,
  disponible boolean not null default true
);

create or replace view ranking as
select p.id as persona_id, p.nombre, coalesce(sum(m.puntos), 0)::int as puntos,
       case when coalesce(sum(m.puntos), 0) >= 1500 then 'Escalador'
            when coalesce(sum(m.puntos), 0) >= 700  then 'Constructor'
            when coalesce(sum(m.puntos), 0) >= 200  then 'Explorador'
            else 'Semilla' end as nivel
from personas p left join puntos_movimientos m on m.persona_id = p.id
group by p.id, p.nombre;

-- ---------- Auditoría (ISO 25010 · Seguridad: las acciones quedan registradas) ----------
create table auditoria (
  id bigserial primary key,
  tabla text not null,
  registro_id text,
  accion text not null,
  usuario_id uuid default auth.uid(),
  datos jsonb,
  creado_en timestamptz not null default now()
);
create or replace function auditar() returns trigger
language plpgsql security definer as $$
begin
  insert into auditoria (tabla, registro_id, accion, datos)
  values (tg_table_name, coalesce(new.id, old.id)::text, tg_op,
          case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;
do $$ declare t text; begin
  foreach t in array array['empresas','personas','diagnosticos','proyectos_aula','planes_accion',
                           'compromisos','citas','eventos','inscripciones'] loop
    execute format('create trigger %I_audit after insert or update or delete on %I
                    for each row execute function auditar()', t, t);
  end loop;
end $$;

-- ---------- Vistas de conocimiento ----------
-- Historial completo de una empresa en una sola consulta (meta: < 1 minuto)
create or replace view historial_empresa as
select empresa_id, 'diagnostico' as tipo, fecha::timestamptz as fecha, 'Diagnóstico ' || coalesce(nivel, '') as titulo, id from diagnosticos
union all select empresa_id, 'proyecto', creado_en, asignatura || ' · ' || area_intervenida, id from proyectos_aula
union all select empresa_id, 'plan', creado_en, titulo, id from planes_accion
union all select empresa_id, 'cita', coalesce(inicio, creado_en), motivo, id from citas
union all select i.empresa_id, case when i.asistio_en is null then 'inscripcion' else 'asistencia' end,
                 coalesce(i.asistio_en, i.inscrito_en), e.titulo, i.id
          from inscripciones i join eventos e on e.id = i.evento_id;

create or replace view asistencia_eventos as
select e.id, e.titulo, e.inicio, count(i.id) as inscritos, count(i.asistio_en) as asistentes,
       round(100.0 * count(i.asistio_en) / nullif(count(i.id), 0), 1) as tasa_asistencia
from eventos e left join inscripciones i on i.evento_id = e.id
group by e.id;

create or replace view brechas_sector as
select s.nombre as sector, e.tamano, d2.nombre as dimension,
       round(avg(dp.puntaje), 1) as puntaje_promedio, count(distinct e.id) as empresas
from diagnostico_puntajes dp
join diagnosticos d on d.id = dp.diagnostico_id
join empresas e on e.id = d.empresa_id
join dimensiones_madurez d2 on d2.id = dp.dimension_id
left join sectores s on s.id = e.sector_id
group by s.nombre, e.tamano, d2.nombre;

create or replace view calidad_datos as
select count(*) as total,
       count(sector_id) as con_sector,
       count(tamano) as con_tamano,
       count(nit) as con_nit,
       count(ingresos_anuales) as con_ingresos,
       count(formalizacion) as con_formalizacion
from empresas where fusionada_en is null;

-- ---------- Seguridad: Row Level Security por rol ----------
create or replace function rol_actual() returns rol_usuario
language sql stable security definer as $$ select rol from perfiles where id = auth.uid() $$;

create or replace function es_equipo_cde() returns boolean
language sql stable as $$ select coalesce(rol_actual() in ('admin_cde','asesor_cde'), false) $$;

-- Empresas a las que la persona logueada (emprendedor) pertenece
create or replace function mis_empresas() returns setof uuid
language sql stable security definer as $$
  select ep.empresa_id from empresa_personas ep
  join personas p on p.id = ep.persona_id where p.perfil_id = auth.uid()
$$;

do $$ declare t text; begin
  foreach t in array array['empresas','personas','empresa_personas','diagnosticos','diagnostico_puntajes',
                           'proyectos_aula','proyecto_consultores','planes_accion','compromisos','citas',
                           'eventos','inscripciones','puntos_movimientos','persona_insignias','auditoria',
                           'perfiles'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy equipo_cde_todo on %I for all using (es_equipo_cde()) with check (es_equipo_cde())', t);
  end loop;
end $$;

-- Emprendedor: solo ve lo suyo
create policy emprendedor_empresas on empresas for select using (id in (select mis_empresas()));
create policy emprendedor_citas on citas for select using (empresa_id in (select mis_empresas()));
create policy emprendedor_citas_crear on citas for insert with check (empresa_id in (select mis_empresas()));
create policy emprendedor_planes on planes_accion for select using (empresa_id in (select mis_empresas()));
create policy emprendedor_compromisos on compromisos for select
  using (plan_id in (select id from planes_accion where empresa_id in (select mis_empresas())));
create policy emprendedor_diagnosticos on diagnosticos for select using (empresa_id in (select mis_empresas()));
create policy eventos_publicos on eventos for select using (publicado);
create policy emprendedor_inscripciones on inscripciones for all
  using (persona_id in (select id from personas where perfil_id = auth.uid()))
  with check (persona_id in (select id from personas where perfil_id = auth.uid()));
create policy emprendedor_persona on personas for select using (perfil_id = auth.uid());
create policy emprendedor_puntos on puntos_movimientos for select
  using (persona_id in (select id from personas where perfil_id = auth.uid()));
create policy perfil_propio on perfiles for select using (id = auth.uid());
-- Docentes: ven sus proyectos de aula
create policy docente_proyectos on proyectos_aula for select using (docente_id = auth.uid());
