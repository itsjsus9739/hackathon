-- =====================================================================
-- CDE UNAB · Planes de acción DE EJEMPLO para la demo
--   8 planes sobre empresas con diagnóstico, enfocados en su mayor brecha, con
--   compromisos en distintos estados (cumplidos, en curso y vencidos).
--   Responsable: el primer administrador del CDE. Marcados con es_ejemplo; para quitarlos:
--     delete from public.planes_accion where es_ejemplo;
-- =====================================================================

alter table public.planes_accion add column es_ejemplo boolean not null default false;
comment on column public.planes_accion.es_ejemplo is 'Dato inventado para la demo; borrar al registrar planes reales';

do $$
declare
  responsable uuid := (select id from public.perfiles where rol::text = 'admin_cde' order by creado_en limit 1);
  d record;
  i int := 0;
  plan uuid;
  area text;
  tareas text[];
  avances int[] := array[100, 60, 20, 0];
begin
  if responsable is null then
    raise notice 'No hay administrador del CDE: no se crean planes de ejemplo';
    return;
  end if;

  for d in
    select distinct on (dg.id_empresa) dg.*
    from public.diagnosticos dg
    where dg.es_ejemplo
    order by dg.id_empresa, dg.fecha desc
    limit 8
  loop
    -- Área con el puntaje más bajo de su diagnóstico
    select a into area from (values
      ('estrategia', d.estrategia), ('mercadeo_ventas', d.mercadeo_ventas), ('financiera', d.financiera),
      ('normativa_legal', d.normativa_legal), ('productividad', d.productividad),
      ('transformacion_digital', d.transformacion_digital)) as t(a, v)
    order by v, a limit 1;

    tareas := case area
      when 'transformacion_digital' then array['Crear perfil de Google Business y redes sociales', 'Montar catálogo o tienda en línea', 'Llevar ventas e inventario en una herramienta digital']
      when 'financiera' then array['Separar las finanzas personales de las del negocio', 'Construir el flujo de caja mensual', 'Calcular costos y punto de equilibrio']
      when 'mercadeo_ventas' then array['Definir cliente ideal y propuesta de valor', 'Plan de contenidos para redes (4 semanas)', 'Medir ventas por canal']
      when 'normativa_legal' then array['Registro mercantil en la Cámara de Comercio', 'RUT y facturación electrónica', 'Revisar permisos sanitarios y de funcionamiento']
      when 'estrategia' then array['Definir misión, visión y metas a un año', 'Análisis DOFA con el mentor', 'Tablero de 3 indicadores clave']
      else array['Documentar el proceso principal', 'Reducir los tiempos de entrega', 'Plan de compras e inventario']
    end;

    insert into public.planes_accion (id_empresa, id_diagnostico, titulo, objetivo, area, id_responsable,
                                      fecha_inicio, fecha_limite, es_ejemplo)
    values (d.id_empresa, d.id,
            'Plan de ' || case area
              when 'transformacion_digital' then 'transformación digital' when 'financiera' then 'gestión financiera'
              when 'mercadeo_ventas' then 'mercadeo y ventas' when 'normativa_legal' then 'formalización'
              when 'estrategia' then 'estrategia empresarial' else 'productividad' end,
            'Cerrar la mayor brecha del diagnóstico de madurez',
            area, responsable, current_date - 40 + i * 3, current_date + 35, true)
    returning id into plan;

    -- Fechas escalonadas alrededor de hoy: los primeros planes tienen compromisos ya vencidos
    for k in 0..2 loop
      insert into public.compromisos (id_plan, descripcion, fecha_limite, avance)
      values (plan, tareas[k + 1], current_date + (i * 5 - 15 + k * 10), avances[((i + k) % 4) + 1]);
    end loop;

    update public.planes_accion p set estado =
      case when not exists (select 1 from public.compromisos c where c.id_plan = p.id and c.estado <> 'Cumplido') then 'Completado'
           when exists (select 1 from public.compromisos c where c.id_plan = p.id and c.avance > 0) then 'En curso'
           else 'Pendiente' end
    where p.id = plan;
    i := i + 1;
  end loop;

  -- Las notificaciones de "eres responsable" de esta carga no aportan nada
  delete from public.notificaciones where creado_en = now() and tipo in ('plan', 'compromiso');
end
$$;
