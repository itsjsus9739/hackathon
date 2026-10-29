-- =====================================================================
-- CDE UNAB · Empresas vinculadas por asignatura y datos que actualiza el emprendedor
--   * Solo el CDE ve todas las empresas; los demás roles, las vinculadas a ellos (RLS ya lo hacía).
--     El docente crea planes solo para las empresas de sus proyectos o planes.
--   * El docente vincula una empresa a su asignatura (crea el proyecto de aula del semestre) y asigna
--     estudiantes a cada proyecto. Se avisa a la empresa y a los estudiantes, que ven a qué proyecto
--     corresponde cada asignatura.
--   * Para vincular, el docente busca por nombre o NIT (mínimo 3 letras, máximo 8 resultados, solo nombre
--     y municipio): no puede listar el directorio completo.
--   * El emprendedor actualiza los datos de su empresa (sector, tamaño, municipio, formalización,
--     descripción y el NIT si aún no lo tenía); el CDE recibe un aviso.
-- =====================================================================

-- 1. Planes: el docente elige entre las empresas vinculadas a él
create or replace function public.empresas_para_planes()
returns table (id uuid, nombre text)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.nombre from public.empresas e
  where public.es_cde()
     or (public.es_docente()
         and (e.id in (select pa.id_empresa from public.proyectos_aula pa
                       where pa.id in (select public.proyectos_del_docente()) and pa.estado <> 'Cancelado')
              or e.id in (select public.empresas_de_mis_planes())))
  order by e.nombre;
$$;

-- 2. Búsqueda acotada para vincular una empresa a una asignatura
create or replace function public.buscar_empresas_para_vincular(texto text)
returns table (id uuid, nombre text, municipio text)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.nombre, e.municipio
  from public.empresas e
  where (public.es_cde() or public.es_docente())
    and length(trim(texto)) >= 3
    and (e.nombre ilike '%' || replace(replace(trim(texto), '%', ''), '_', '') || '%' or e.nit = regexp_replace(texto, '\D', '', 'g'))
  order by e.nombre
  limit 8;
$$;

/** El docente vincula una empresa a la asignatura que dicta en ese semestre: crea (o reactiva) el proyecto de aula. */
create or replace function public.vincular_empresa_asignatura(asignatura uuid, sem text, empresa uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  proyecto uuid;
  nombre_asignatura text := (select nombre from public.asignaturas where id = asignatura);
  nombre_empresa text := (select nombre from public.empresas where id = empresa);
  nombre_docente text := (select nombre from public.perfiles where id = auth.uid());
  reactivados integer := 0;
  avisar boolean := true;   -- solo al vincular por primera vez o al reactivar
begin
  if not (public.dicta_asignatura(asignatura, sem) or public.es_cde()) then
    raise exception 'Solo el docente que dicta la asignatura puede vincular empresas';
  end if;
  if nombre_empresa is null or nombre_asignatura is null then
    raise exception 'La empresa o la asignatura no existe';
  end if;

  select p.id into proyecto from public.proyectos_aula p
  where p.id_empresa = empresa and p.id_asignatura = asignatura and p.semestre = sem
  limit 1;
  if proyecto is not null then
    update public.proyectos_aula set estado = 'En curso' where id = proyecto and estado = 'Cancelado';
    get diagnostics reactivados = row_count;
    avisar := reactivados > 0;
  else
    insert into public.proyectos_aula (id_empresa, nombre, id_asignatura, semestre, estado, fecha_inicio)
    values (empresa, nombre_asignatura || ' · ' || nombre_empresa, asignatura, sem, 'En curso',
            (now() at time zone 'America/Bogota')::date)
    returning id into proyecto;
  end if;
  if public.es_docente() then
    insert into public.proyecto_docentes (id_proyecto, id_docente) values (proyecto, auth.uid()) on conflict do nothing;
  end if;

  -- Ya estaba vinculada y activa: no se repiten los avisos
  if not avisar then
    return proyecto;
  end if;

  -- Avisos: la empresa y los estudiantes de la asignatura
  perform public.notificar(persona, 'proyecto', 'Tu empresa trabajará con ' || nombre_asignatura,
                           coalesce(nombre_docente, 'Un docente') || ' vinculó a ' || nombre_empresa || ' a la asignatura '
                           || nombre_asignatura || ' (' || sem || '). Verás al docente y al equipo en Mis contactos.', '/contactos')
  from public.personas_de_empresa(empresa) persona;
  perform public.notificar(ae.id_estudiante, 'proyecto', nombre_asignatura || ': nueva empresa del proyecto',
                           'La asignatura ' || nombre_asignatura || ' (' || sem || ') trabajará con ' || nombre_empresa || '.',
                           '/contactos')
  from public.asignatura_estudiantes ae where ae.id_asignatura = asignatura and ae.semestre = sem;
  return proyecto;
end;
$$;

-- 3. Aviso al estudiante cuando lo asignan a un proyecto de aula (sabe con qué empresa y en qué asignatura)
create or replace function public.avisar_estudiante_proyecto()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  p record;
begin
  select coalesce(a.nombre, pa.nombre) as asignatura, e.nombre as empresa, pa.semestre into p
  from public.proyectos_aula pa
  left join public.asignaturas a on a.id = pa.id_asignatura
  left join public.empresas e on e.id = pa.id_empresa
  where pa.id = new.id_proyecto;
  perform public.notificar(new.id_estudiante, 'proyecto', 'Te asignaron al proyecto con ' || coalesce(p.empresa, 'una empresa'),
                           'Asignatura ' || p.asignatura || ' · ' || p.semestre || '. Lo ves en Mis contactos.', '/contactos');
  return null;
end;
$$;
create trigger proyecto_estudiantes_aviso after insert on public.proyecto_estudiantes
  for each row execute function public.avisar_estudiante_proyecto();

-- 4. Mis contactos: la relación del proyecto dice también la asignatura
create or replace function public.mis_contactos()
returns table (id uuid, nombre text, rol public.rol_usuario, relacion text)
language sql stable security definer set search_path = ''
as $$
  with yo as (
    select p.id, p.rol::text as rol from public.perfiles p where p.id = auth.uid() and p.estado_acceso = 'aprobado'
  ),
  mis_proyectos as (
    select pa.id, pa.id_empresa, pa.id_asignatura, pa.semestre
    from public.proyectos_aula pa
    where pa.estado <> 'Cancelado'
      and (pa.id in (select public.proyectos_del_docente() union select public.proyectos_del_estudiante())
           or pa.id_empresa in (select public.mis_empresas()))
  ),
  docentes_de_proyectos as (
    select pd.id_docente as id, mp.id_empresa, mp.id_asignatura from mis_proyectos mp
    join public.proyecto_docentes pd on pd.id_proyecto = mp.id
    union
    select ad.id_docente, mp.id_empresa, mp.id_asignatura from mis_proyectos mp
    join public.asignatura_docentes ad on ad.id_asignatura = mp.id_asignatura and ad.semestre = mp.semestre
  ),
  relaciones as (
    select p.id,
           case p.rol::text
             when 'docente' then coalesce('Dicta ' || (select string_agg(distinct a.nombre, ', ') from public.asignatura_docentes ad
                                                       join public.asignaturas a on a.id = ad.id_asignatura where ad.id_docente = p.id), 'Docente')
             when 'estudiante' then coalesce('Cursa ' || (select string_agg(distinct a.nombre, ', ') from public.asignatura_estudiantes ae
                                                          join public.asignaturas a on a.id = ae.id_asignatura where ae.id_estudiante = p.id), 'Estudiante')
             when 'emprendedor' then coalesce((select string_agg(distinct e.nombre, ', ') from public.empresas e
                                               where e.id_representante = p.id
                                                  or e.id in (select ce.id_empresa from public.contactos_empresa ce where ce.id_perfil = p.id)), 'Emprendedor')
             else 'Equipo del CDE'
           end as relacion
    from public.perfiles p
    where (select rol from yo) in ('cde', 'admin_cde') and p.estado_acceso = 'aprobado'
    union all
    select ae.id_estudiante, a.nombre || ' · ' || ae.semestre
    from public.asignatura_docentes ad
    join public.asignatura_estudiantes ae on ae.id_asignatura = ad.id_asignatura and ae.semestre = ad.semestre
    join public.asignaturas a on a.id = ad.id_asignatura
    where ad.id_docente = auth.uid() and (select rol from yo) = 'docente'
    union all
    select pe.id_estudiante, 'Proyecto con ' || coalesce(e.nombre, 'una empresa') || coalesce(' · ' || a.nombre, '')
    from mis_proyectos mp
    join public.proyecto_estudiantes pe on pe.id_proyecto = mp.id
    left join public.empresas e on e.id = mp.id_empresa
    left join public.asignaturas a on a.id = mp.id_asignatura
    where (select rol from yo) in ('docente', 'estudiante', 'emprendedor')
    union all
    select e.id_representante, 'Empresa: ' || e.nombre || coalesce(' · ' || a.nombre, '')
    from mis_proyectos mp join public.empresas e on e.id = mp.id_empresa
    left join public.asignaturas a on a.id = mp.id_asignatura
    where (select rol from yo) in ('docente', 'estudiante') and e.id_representante is not null
    union all
    select d.id, 'Docente de tu proyecto' || coalesce(' · ' || a.nombre, '')
    from docentes_de_proyectos d left join public.asignaturas a on a.id = d.id_asignatura
    where (select rol from yo) in ('emprendedor', 'estudiante')
    union all
    select ad.id_docente, 'Tu docente · ' || a.nombre
    from public.asignatura_estudiantes ae
    join public.asignatura_docentes ad on ad.id_asignatura = ae.id_asignatura and ad.semestre = ae.semestre
    join public.asignaturas a on a.id = ae.id_asignatura
    where ae.id_estudiante = auth.uid() and (select rol from yo) = 'estudiante'
    union all
    select e.id_mentor, 'Mentor del CDE · ' || e.nombre
    from public.empresas e
    where e.id in (select public.mis_empresas()) and e.id_mentor is not null and (select rol from yo) = 'emprendedor'
  )
  select p.id, p.nombre, p.rol, string_agg(distinct r.relacion, ' | ') as relacion
  from relaciones r
  join public.perfiles p on p.id = r.id and p.estado_acceso = 'aprobado'
  where p.id <> auth.uid()
  group by p.id, p.nombre, p.rol
  order by p.nombre;
$$;

-- 5. El emprendedor actualiza los datos de su empresa
create or replace function public.actualizar_mi_empresa(
  empresa uuid, nuevo_sector text, nuevo_tamano text, nuevo_municipio text, nueva_formalizacion text,
  nueva_descripcion text, nuevo_nit text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actual record;
  nit_limpio text := nullif(regexp_replace(coalesce(nuevo_nit, ''), '\D', '', 'g'), '');
begin
  if empresa not in (select public.mis_empresas()) then
    raise exception 'Solo puedes actualizar los datos de tu empresa';
  end if;
  if nuevo_sector is not null and not exists (select 1 from public.sectores where nombre = nuevo_sector) then
    raise exception 'Sector no válido';
  end if;
  select * into actual from public.empresas where id = empresa;
  if nit_limpio is not null and actual.nit is not null and nit_limpio <> actual.nit then
    raise exception 'El NIT ya registrado solo lo cambia el CDE';
  end if;

  update public.empresas set
    sector = nuevo_sector,
    tamano = nuevo_tamano::public.tamano_empresa,
    municipio = nullif(trim(nuevo_municipio), ''),
    formalizacion = nueva_formalizacion,
    descripcion = nullif(left(trim(nueva_descripcion), 2000), ''),
    nit = coalesce(actual.nit, nit_limpio),
    -- Sector y tamaño confirmados por la empresa dejan de ser datos estimados
    datos_estimados = array_remove(array_remove(actual.datos_estimados, 'sector'), 'tamano')
  where id = empresa;

  perform public.notificar(p.id, 'general', actual.nombre || ' actualizó sus datos',
                           'El emprendedor revisó y actualizó los datos de su empresa.', '/empresas/' || empresa)
  from public.perfiles p where p.rol::text in ('cde', 'admin_cde') and p.estado_acceso = 'aprobado';
end;
$$;

revoke execute on function public.buscar_empresas_para_vincular(text), public.vincular_empresa_asignatura(uuid, text, uuid),
  public.actualizar_mi_empresa(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.buscar_empresas_para_vincular(text), public.vincular_empresa_asignatura(uuid, text, uuid),
  public.actualizar_mi_empresa(uuid, text, text, text, text, text, text) to authenticated;
revoke execute on function public.avisar_estudiante_proyecto() from public, anon, authenticated;
