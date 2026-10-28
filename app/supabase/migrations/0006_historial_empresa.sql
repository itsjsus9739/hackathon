-- =====================================================================
-- CDE UNAB · Ficha 360°: formalización y línea de tiempo de cada empresa
-- (solo agrega: sin sentencias destructivas)
-- =====================================================================

-- Estado de formalización (el reto lo pide; los datos importados no lo traen)
alter table public.empresas
  add column if not exists formalizacion text check (formalizacion in ('Formal', 'En proceso', 'Informal'));

-- Fecha real de inicio del proyecto de aula (creado_en es la fecha de importación)
alter table public.proyectos_aula add column if not exists fecha_inicio date;
-- Los proyectos 2026-2 del Cuadro de control iniciaron el 18/08/2026 (cronograma: "Inicio de los proyectos de aula")
update public.proyectos_aula set fecha_inicio = '2026-08-18' where semestre = '2026-2' and fecha_inicio is null;

-- Línea de tiempo: todo lo que ha pasado con una empresa, en una sola consulta.
-- security_invoker: cada rol ve solo las filas que su RLS le permite.
create or replace view public.historial_empresa with (security_invoker = true) as
-- Atenciones (sesiones, ferias, ruta…). Las de "Proyectos de aula" se omiten si ya está el proyecto
select a.id_empresa, 'atencion'::text as tipo, a.fecha::timestamptz as fecha,
       a.tipo_actividad as titulo, a.notas as detalle, null::text as estado, a.id as id_registro
from public.atenciones a
where not (a.tipo_actividad = 'Proyectos de aula'
           and exists (select 1 from public.proyectos_aula p where p.id_empresa = a.id_empresa and p.semestre = a.semestre))
union all
-- Proyectos de aula
select p.id_empresa, 'proyecto_aula', coalesce(p.fecha_inicio::timestamptz, p.creado_en),
       coalesce(asig.nombre, 'Proyecto de aula') || ' · ' || p.semestre,
       coalesce(p.resultados, p.area_intervenida, p.descripcion), p.estado::text, p.id
from public.proyectos_aula p
left join public.asignaturas asig on asig.id = p.id_asignatura
union all
-- Asesorías y citas
select c.id_empresa, 'cita', coalesce(c.fecha_hora, c.creado_en), c.motivo, c.notas, c.estado, c.id
from public.citas c
union all
-- Diagnósticos de madurez
select d.id_empresa, 'diagnostico', d.fecha::timestamptz, 'Diagnóstico de madurez',
       'Promedio ' || d.promedio || ' / 5' || coalesce(' · ' || d.tipo_iniciativa, ''), d.nivel, d.id
from public.diagnosticos d
union all
-- Eventos a los que asistió el emprendedor (asistencia confirmada por el CDE)
select e.id, 'evento', ev.fecha, ev.nombre, ev.tipo, 'Asistió', i.id
from public.empresas e
join public.inscripciones_eventos i on i.id_usuario = e.id_representante and i.asistio
join public.eventos ev on ev.id = i.id_evento;

grant select on public.historial_empresa to authenticated, ia_lectura;
