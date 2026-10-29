-- =====================================================================
-- CDE UNAB · Medición de cambio (documento "Los datos del CDE y la caracterización del emprendedor")
--   * Brechas al inicio e impactos al cierre sobre la MISMA lista (sección 5.2): catálogo de brechas
--     por área de intervención y, por empresa, cuándo se detectó cada una y cuándo se cerró, con evidencia.
--   * Repetición del autodiagnóstico (sección 8): vista con el primer y el último diagnóstico por
--     empresa y el cambio en cada eje.
--   * El catálogo trae 4 brechas por área como punto de partida; el CDE lo reemplaza por sus 12 listas
--     de chequeo oficiales (177 brechas). Los datos de ejemplo quedan con es_ejemplo = true.
-- =====================================================================

create table public.catalogo_brechas (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in (
    'Productividad', 'Seguridad y salud en el trabajo', 'Transformación digital', 'Sostenibilidad',
    'Comercio exterior e internacionalización', 'Organización de estructura', 'Gestión de mercadeo y ventas',
    'Gestión financiera', 'Legal - Normativo', 'Gestión estratégica', 'Comunicación y clima organizacional', 'Otro')),
  -- Eje del autodiagnóstico relacionado (si lo hay): une la brecha con la medición de madurez
  eje_diagnostico text check (eje_diagnostico in (
    'estrategia', 'mercadeo_ventas', 'financiera', 'normativa_legal', 'productividad', 'transformacion_digital')),
  descripcion text not null check (length(trim(descripcion)) between 5 and 300),
  orden smallint not null default 0,
  activa boolean not null default true,
  unique (area, descripcion)
);

create table public.brechas_empresa (
  id uuid primary key default gen_random_uuid(),
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  id_brecha uuid not null references public.catalogo_brechas (id) on delete restrict,
  id_proyecto uuid references public.proyectos_aula (id) on delete set null,
  semestre text not null check (semestre ~ '^\d{4}-[12]$'),
  detectada_en date not null default (now() at time zone 'America/Bogota')::date,
  cerrada_en date,
  evidencia text check (length(evidencia) <= 2000),
  registrada_por uuid references public.perfiles (id) on delete set null default auth.uid(),
  cerrada_por uuid references public.perfiles (id) on delete set null,
  es_ejemplo boolean not null default false,
  creado_en timestamptz not null default now(),
  unique (id_empresa, id_brecha, semestre),
  check (cerrada_en is null or cerrada_en >= detectada_en),
  check (cerrada_en is null or length(trim(coalesce(evidencia, ''))) >= 5)
);
create index brechas_empresa_empresa_idx on public.brechas_empresa (id_empresa);
create index brechas_empresa_proyecto_idx on public.brechas_empresa (id_proyecto);

/** Semestre académico de una fecha: enero-junio = 1, julio-diciembre = 2. */
create or replace function public.semestre_de(fecha date)
returns text
language sql immutable set search_path = ''
as $$
  select extract(year from fecha)::int || '-' || case when extract(month from fecha) <= 6 then '1' else '2' end;
$$;

-- Quién registra y cierra brechas: el CDE, o el docente/estudiante del proyecto de aula de esa empresa
create or replace function public.puede_registrar_brechas(empresa uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_cde() or exists (
    select 1 from public.proyectos_aula p
    where p.id_empresa = empresa
      and p.id in (select public.proyectos_del_docente() union select public.proyectos_del_estudiante()));
$$;

-- Al cerrar se registra quién y cuándo; al reabrir se limpia
create or replace function public.preparar_brecha()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.id_empresa := old.id_empresa;
    new.id_brecha := old.id_brecha;
    new.registrada_por := old.registrada_por;
    if not public.es_cde() then new.es_ejemplo := old.es_ejemplo; end if;
  elsif not public.es_cde() and auth.uid() is not null then
    new.registrada_por := auth.uid();
    new.es_ejemplo := false;
  end if;
  if new.cerrada_en is not null and (tg_op = 'INSERT' or old.cerrada_en is null) then
    new.cerrada_por := coalesce(auth.uid(), new.cerrada_por);
  elsif new.cerrada_en is null then
    new.cerrada_por := null;
  end if;
  return new;
end;
$$;
create trigger brechas_empresa_preparar before insert or update on public.brechas_empresa
  for each row execute function public.preparar_brecha();
create trigger brechas_empresa_auditoria after insert or update or delete on public.brechas_empresa
  for each row execute function public.auditar();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.catalogo_brechas enable row level security;
alter table public.brechas_empresa enable row level security;

create policy aprobados_leen_catalogo on public.catalogo_brechas for select to authenticated using (true);
create policy cde_gestiona_catalogo on public.catalogo_brechas for all to authenticated
  using (public.es_cde()) with check (public.es_cde());
create policy solo_acceso_aprobado on public.catalogo_brechas as restrictive for all to authenticated
  using (public.acceso_aprobado()) with check (public.acceso_aprobado());

-- La empresa ve las suyas; docentes y estudiantes las de sus proyectos; el CDE todas
create policy ven_brechas on public.brechas_empresa for select to authenticated
  using (public.puede_registrar_brechas(id_empresa) or id_empresa in (select public.mis_empresas()));
create policy registran_brechas on public.brechas_empresa for insert to authenticated
  with check (public.puede_registrar_brechas(id_empresa));
create policy actualizan_brechas on public.brechas_empresa for update to authenticated
  using (public.puede_registrar_brechas(id_empresa)) with check (public.puede_registrar_brechas(id_empresa));
create policy cde_borra_brechas on public.brechas_empresa for delete to authenticated using (public.es_cde());
create policy solo_acceso_aprobado on public.brechas_empresa as restrictive for all to authenticated
  using (public.acceso_aprobado()) with check (public.acceso_aprobado());

-- ---------------------------------------------------------------------
-- Vistas para el tablero y el asistente IA
-- ---------------------------------------------------------------------
-- Brechas detectadas y cerradas por área y semestre ("¿qué brechas se cerraron, dónde y cuándo?")
create or replace view public.cierre_brechas with (security_invoker = true) as
select c.area, b.semestre,
       count(*) as detectadas,
       count(*) filter (where b.cerrada_en is not null) as cerradas,
       round(100.0 * count(*) filter (where b.cerrada_en is not null) / count(*), 1) as porcentaje_cerradas,
       count(distinct b.id_empresa) as empresas
from public.brechas_empresa b
join public.catalogo_brechas c on c.id = b.id_brecha
group by c.area, b.semestre;

-- Primer y último autodiagnóstico de cada empresa con dos o más: el cambio por eje
create or replace view public.evolucion_diagnosticos with (security_invoker = true) as
with ordenados as (
  select d.*,
         row_number() over (partition by d.id_empresa order by d.fecha, d.creado_en) as primero,
         row_number() over (partition by d.id_empresa order by d.fecha desc, d.creado_en desc) as ultimo,
         count(*) over (partition by d.id_empresa) as total
  from public.diagnosticos d
)
select a.id_empresa, a.total as diagnosticos,
       a.fecha as fecha_inicial, z.fecha as fecha_final,
       a.promedio as promedio_inicial, z.promedio as promedio_final, z.promedio - a.promedio as cambio_promedio,
       z.estrategia - a.estrategia as cambio_estrategia,
       z.mercadeo_ventas - a.mercadeo_ventas as cambio_mercadeo_ventas,
       z.financiera - a.financiera as cambio_financiera,
       z.normativa_legal - a.normativa_legal as cambio_normativa_legal,
       z.productividad - a.productividad as cambio_productividad,
       z.transformacion_digital - a.transformacion_digital as cambio_transformacion_digital,
       a.nivel as nivel_inicial, z.nivel as nivel_final,
       a.es_ejemplo or z.es_ejemplo as es_ejemplo
from ordenados a
join ordenados z on z.id_empresa = a.id_empresa and z.ultimo = 1
where a.primero = 1 and a.total >= 2;

grant select on public.cierre_brechas, public.evolucion_diagnosticos to authenticated;

-- Asistente IA (rol de solo lectura): datos de negocio, sin datos personales
grant select on public.catalogo_brechas, public.brechas_empresa, public.cierre_brechas, public.evolucion_diagnosticos to ia_lectura;
create policy ia_lectura on public.catalogo_brechas for select to ia_lectura using (true);
create policy ia_lectura on public.brechas_empresa for select to ia_lectura using (true);

revoke execute on function public.puede_registrar_brechas(uuid) from public, anon;
grant execute on function public.puede_registrar_brechas(uuid) to authenticated;
revoke execute on function public.preparar_brecha() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Catálogo inicial: 4 brechas por área (el CDE lo completa con sus listas de chequeo)
-- ---------------------------------------------------------------------
insert into public.catalogo_brechas (area, eje_diagnostico, orden, descripcion) values
  ('Productividad', 'productividad', 1, 'Los procesos principales no están documentados'),
  ('Productividad', 'productividad', 2, 'No se miden indicadores de la operación (tiempos, costos, calidad)'),
  ('Productividad', 'productividad', 3, 'No hay planeación de compras ni control de inventario'),
  ('Productividad', 'productividad', 4, 'Los tiempos de entrega no se controlan'),
  ('Transformación digital', 'transformacion_digital', 1, 'No tiene presencia en internet (web, redes o Google Business)'),
  ('Transformación digital', 'transformacion_digital', 2, 'Ventas e inventario se llevan en papel o de memoria'),
  ('Transformación digital', 'transformacion_digital', 3, 'No usa medios de pago digitales'),
  ('Transformación digital', 'transformacion_digital', 4, 'No aprovecha sus datos para decidir'),
  ('Gestión de mercadeo y ventas', 'mercadeo_ventas', 1, 'No tiene definido su cliente objetivo'),
  ('Gestión de mercadeo y ventas', 'mercadeo_ventas', 2, 'No cuenta con un plan comercial'),
  ('Gestión de mercadeo y ventas', 'mercadeo_ventas', 3, 'No mide las ventas por canal ni por producto'),
  ('Gestión de mercadeo y ventas', 'mercadeo_ventas', 4, 'La propuesta de valor no se diferencia de la competencia'),
  ('Gestión financiera', 'financiera', 1, 'Mezcla las finanzas personales con las del negocio'),
  ('Gestión financiera', 'financiera', 2, 'No conoce sus costos ni su punto de equilibrio'),
  ('Gestión financiera', 'financiera', 3, 'No lleva registro de ingresos y gastos'),
  ('Gestión financiera', 'financiera', 4, 'No tiene flujo de caja ni plan financiero'),
  ('Legal - Normativo', 'normativa_legal', 1, 'No tiene registro mercantil'),
  ('Legal - Normativo', 'normativa_legal', 2, 'No factura electrónicamente'),
  ('Legal - Normativo', 'normativa_legal', 3, 'No formaliza contratos con clientes y proveedores'),
  ('Legal - Normativo', 'normativa_legal', 4, 'No ha protegido su marca ni su propiedad intelectual'),
  ('Gestión estratégica', 'estrategia', 1, 'No tiene misión, visión ni metas definidas'),
  ('Gestión estratégica', 'estrategia', 2, 'No hay planeación a mediano plazo'),
  ('Gestión estratégica', 'estrategia', 3, 'Desconoce su mercado y su competencia'),
  ('Gestión estratégica', 'estrategia', 4, 'No usa información para tomar decisiones'),
  ('Seguridad y salud en el trabajo', null, 1, 'No tiene implementado el SG-SST'),
  ('Seguridad y salud en el trabajo', null, 2, 'No ha identificado los riesgos laborales'),
  ('Seguridad y salud en el trabajo', null, 3, 'No hay plan de emergencias'),
  ('Seguridad y salud en el trabajo', null, 4, 'No capacita al personal en seguridad'),
  ('Sostenibilidad', null, 1, 'No mide su consumo de agua y energía'),
  ('Sostenibilidad', null, 2, 'No separa ni aprovecha los residuos'),
  ('Sostenibilidad', null, 3, 'No conoce el impacto ambiental de su operación'),
  ('Sostenibilidad', null, 4, 'No tiene una estrategia de sostenibilidad'),
  ('Comercio exterior e internacionalización', null, 1, 'No conoce los mercados internacionales para su producto'),
  ('Comercio exterior e internacionalización', null, 2, 'Desconoce los requisitos para exportar'),
  ('Comercio exterior e internacionalización', null, 3, 'No tiene capacidad productiva para exportar'),
  ('Comercio exterior e internacionalización', null, 4, 'No tiene material comercial en otro idioma'),
  ('Organización de estructura', null, 1, 'No tiene organigrama'),
  ('Organización de estructura', null, 2, 'Las funciones de cada cargo no están definidas'),
  ('Organización de estructura', null, 3, 'Las decisiones se concentran en una sola persona'),
  ('Organización de estructura', null, 4, 'No hay procesos de selección ni de inducción'),
  ('Comunicación y clima organizacional', null, 1, 'No hay canales de comunicación interna'),
  ('Comunicación y clima organizacional', null, 2, 'No se mide el clima laboral'),
  ('Comunicación y clima organizacional', null, 3, 'El liderazgo no está definido'),
  ('Comunicación y clima organizacional', null, 4, 'Bajo compromiso del equipo'),
  ('Otro', null, 1, 'No hay innovación en procesos'),
  ('Otro', null, 2, 'No hay innovación en productos o servicios'),
  ('Otro', null, 3, 'No escucha la retroalimentación de sus clientes'),
  ('Otro', null, 4, 'No mejora de forma continua');

-- ---------------------------------------------------------------------
-- Datos de ejemplo (es_ejemplo = true): diagnóstico de línea base y brechas para 20 empresas
--   Para quitarlos: delete from public.brechas_empresa where es_ejemplo;
--                   delete from public.diagnosticos where es_ejemplo;
-- ---------------------------------------------------------------------
-- Para cada empresa con diagnóstico de ejemplo: su eje más débil hoy y el segundo
create temporary table ejemplo_brechas as
with ultimos as (
  select distinct on (d.id_empresa) d.*
  from public.diagnosticos d
  where d.es_ejemplo
  order by d.id_empresa, d.fecha desc, d.creado_en desc
),
ejes as (
  select u.id_empresa, u.fecha, x.eje, x.valor,
         row_number() over (partition by u.id_empresa order by x.valor, x.eje) as rango
  from ultimos u
  cross join lateral (values
    ('estrategia', u.estrategia), ('mercadeo_ventas', u.mercadeo_ventas), ('financiera', u.financiera),
    ('normativa_legal', u.normativa_legal), ('productividad', u.productividad),
    ('transformacion_digital', u.transformacion_digital)) as x(eje, valor)
)
select e1.id_empresa, e1.fecha as fecha_final, e1.eje as eje_principal, e2.eje as eje_secundario,
       (e1.fecha - 180) as fecha_inicial,
       (select p.id from public.proyectos_aula p where p.id_empresa = e1.id_empresa order by p.creado_en limit 1) as id_proyecto
from ejes e1
join ejes e2 on e2.id_empresa = e1.id_empresa and e2.rango = 2
where e1.rango = 1
order by abs(hashtext(e1.id_empresa::text))
limit 20;

-- Línea base seis meses antes: el eje trabajado estaba ~1 punto más abajo y los demás un poco
insert into public.diagnosticos
  (id_empresa, fecha, tipo_iniciativa, estrategia, mercadeo_ventas, financiera, normativa_legal,
   productividad, transformacion_digital, realizado_por, es_ejemplo)
select d.id_empresa, t.fecha_inicial, d.tipo_iniciativa,
       greatest(1, round(d.estrategia - case when t.eje_principal = 'estrategia' then 1.1 else 0.1 + (abs(hashtext(d.id_empresa::text || 'e')) % 4) / 10.0 end, 1)),
       greatest(1, round(d.mercadeo_ventas - case when t.eje_principal = 'mercadeo_ventas' then 1.1 else 0.1 + (abs(hashtext(d.id_empresa::text || 'm')) % 4) / 10.0 end, 1)),
       greatest(1, round(d.financiera - case when t.eje_principal = 'financiera' then 1.1 else 0.1 + (abs(hashtext(d.id_empresa::text || 'f')) % 4) / 10.0 end, 1)),
       greatest(1, round(d.normativa_legal - case when t.eje_principal = 'normativa_legal' then 1.1 else 0.1 + (abs(hashtext(d.id_empresa::text || 'n')) % 4) / 10.0 end, 1)),
       greatest(1, round(d.productividad - case when t.eje_principal = 'productividad' then 1.1 else 0.1 + (abs(hashtext(d.id_empresa::text || 'p')) % 4) / 10.0 end, 1)),
       greatest(1, round(d.transformacion_digital - case when t.eje_principal = 'transformacion_digital' then 1.1 else 0.1 + (abs(hashtext(d.id_empresa::text || 't')) % 4) / 10.0 end, 1)),
       d.realizado_por, true
from ejemplo_brechas t
join lateral (
  select * from public.diagnosticos x where x.id_empresa = t.id_empresa and x.fecha = t.fecha_final and x.es_ejemplo limit 1
) d on true;

-- Brechas del eje principal: detectadas en la línea base; 2 o 3 cerradas en el último diagnóstico
insert into public.brechas_empresa
  (id_empresa, id_brecha, id_proyecto, semestre, detectada_en, cerrada_en, evidencia, es_ejemplo)
select t.id_empresa, c.id, t.id_proyecto, public.semestre_de(t.fecha_inicial), t.fecha_inicial,
       case when c.orden <= 2 + abs(hashtext(t.id_empresa::text)) % 2 then t.fecha_final end,
       case when c.orden <= 2 + abs(hashtext(t.id_empresa::text)) % 2
            then 'Verificado en el seguimiento con el docente y el diagnóstico de cierre (dato de ejemplo).' end,
       true
from ejemplo_brechas t
join public.catalogo_brechas c on c.eje_diagnostico = t.eje_principal and c.orden <= 3;

-- Brechas del segundo eje: detectadas en el último diagnóstico, aún abiertas
insert into public.brechas_empresa (id_empresa, id_brecha, id_proyecto, semestre, detectada_en, es_ejemplo)
select t.id_empresa, c.id, t.id_proyecto, public.semestre_de(t.fecha_final), t.fecha_final, true
from ejemplo_brechas t
join public.catalogo_brechas c on c.eje_diagnostico = t.eje_secundario and c.orden <= 2;

drop table ejemplo_brechas;
