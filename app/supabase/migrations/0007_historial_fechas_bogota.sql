-- =====================================================================
-- Las fechas sin hora (atenciones, inicio de proyecto, diagnóstico) se interpretan como
-- medianoche en Bogotá y no en UTC: así el 18/08 no aparece como 17/08 en la Ficha 360°.
-- =====================================================================
create or replace view public.historial_empresa with (security_invoker = true) as
-- Atenciones (sesiones, ferias, ruta…). Las de "Proyectos de aula" se omiten si ya está el proyecto
select a.id_empresa, 'atencion'::text as tipo, (a.fecha::timestamp at time zone 'America/Bogota') as fecha,
       a.tipo_actividad as titulo, a.notas as detalle, null::text as estado, a.id as id_registro
from public.atenciones a
where not (a.tipo_actividad = 'Proyectos de aula'
           and exists (select 1 from public.proyectos_aula p where p.id_empresa = a.id_empresa and p.semestre = a.semestre))
union all
-- Proyectos de aula
select p.id_empresa, 'proyecto_aula', coalesce(p.fecha_inicio::timestamp at time zone 'America/Bogota', p.creado_en),
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
select d.id_empresa, 'diagnostico', d.fecha::timestamp at time zone 'America/Bogota', 'Diagnóstico de madurez',
       'Promedio ' || d.promedio || ' / 5' || coalesce(' · ' || d.tipo_iniciativa, ''), d.nivel, d.id
from public.diagnosticos d
union all
-- Eventos a los que asistió el emprendedor (asistencia confirmada por el CDE)
select e.id, 'evento', ev.fecha, ev.nombre, ev.tipo, 'Asistió', i.id
from public.empresas e
join public.inscripciones_eventos i on i.id_usuario = e.id_representante and i.asistio
join public.eventos ev on ev.id = i.id_evento;

