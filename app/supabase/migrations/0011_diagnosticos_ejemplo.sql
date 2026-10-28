-- =====================================================================
-- CDE UNAB · Diagnósticos de madurez DE EJEMPLO para la demo
--   La tabla estaba vacía: sin esto, el tablero de brechas y la Ficha 360° salen en blanco.
--   Quedan marcados con es_ejemplo = true. Para quitarlos cuando lleguen los reales:
--     delete from public.diagnosticos where es_ejemplo;
-- =====================================================================

alter table public.diagnosticos add column es_ejemplo boolean not null default false;
comment on column public.diagnosticos.es_ejemplo is 'Dato inventado para la demo; borrar al cargar los autodiagnósticos reales';

-- 30 empresas (primero las que tienen proyecto de aula), puntajes deterministas por empresa.
-- Perfil típico de las MiPyMEs del CDE: más débiles en transformación digital, finanzas y mercadeo.
with elegidas as (
  select e.id, e.tamano
  from public.empresas e
  order by exists (select 1 from public.proyectos_aula p where p.id_empresa = e.id) desc, e.nombre
  limit 30
),
ruido as (
  select id, tamano,
         -- seis valores pseudoaleatorios estables entre -1 y 1 (uno por área)
         array(select (abs(hashtext(id::text || k)) % 2001) / 1000.0 - 1 from generate_series(1, 6) k) as r
  from elegidas
)
insert into public.diagnosticos
  (id_empresa, fecha, tipo_iniciativa, estrategia, mercadeo_ventas, financiera, normativa_legal,
   productividad, transformacion_digital, es_ejemplo)
select id,
       date '2026-02-02' + (abs(hashtext(id::text)) % 250),
       case when tamano = 'Emprendimiento' or tamano is null then 'Emprendedor (Solopreneur)' else 'MiPyME Tradicional' end,
       least(5, greatest(1, round(3.3 + 1.2 * r[1], 1))),
       least(5, greatest(1, round(2.7 + 1.2 * r[2], 1))),
       least(5, greatest(1, round(2.5 + 1.2 * r[3], 1))),
       least(5, greatest(1, round(3.0 + 1.2 * r[4], 1))),
       least(5, greatest(1, round(3.2 + 1.2 * r[5], 1))),
       least(5, greatest(1, round(2.2 + 1.2 * r[6], 1))),
       true
from ruido;
