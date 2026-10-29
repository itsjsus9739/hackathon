-- =====================================================================
-- CDE UNAB · Portal del emprendedor: quién lo ve y con qué datos
--
--   Ven el portal de una empresa:
--     · el emprendedor (representante o contacto de la empresa),
--     · el equipo del CDE (Miembro y Admin), cualquier empresa,
--     · el docente de un proyecto de aula de esa empresa,
--     · un estudiante SOLO si un miembro del CDE le dio acceso a esa empresa
--       (lo pide desde el portal; el CDE lo aprueba, lo rechaza o lo revoca).
--
--   portal_datos(empresa) reúne en un solo JSON lo que muestra el portal, después
--   de validar el permiso en la base (no solo en la interfaz). Es de solo lectura:
--   cada módulo (Planes, Eventos, Formación…) sigue siendo dueño de sus datos.
--
-- Es seguro ejecutarla de nuevo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Accesos de estudiantes al portal de una empresa
-- ---------------------------------------------------------------------
create table if not exists public.accesos_portal (
  id uuid primary key default gen_random_uuid(),
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  id_estudiante uuid not null references public.perfiles (id) on delete cascade default auth.uid(),
  motivo text check (length(motivo) <= 500),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado', 'revocado')),
  resuelto_por uuid references public.perfiles (id) on delete set null,
  resuelto_en timestamptz,
  creado_en timestamptz not null default now(),
  unique (id_empresa, id_estudiante)
);
create index if not exists accesos_portal_estudiante_idx on public.accesos_portal (id_estudiante);

alter table public.accesos_portal enable row level security;
-- Se escribe solo con las funciones de abajo
revoke insert, update, delete on public.accesos_portal from authenticated;

drop policy if exists ven_accesos_portal on public.accesos_portal;
create policy ven_accesos_portal on public.accesos_portal for select to authenticated
  using (id_estudiante = (select auth.uid()) or public.es_cde());
drop policy if exists solo_acceso_aprobado on public.accesos_portal;
create policy solo_acceso_aprobado on public.accesos_portal as restrictive for all to authenticated
  using (public.acceso_aprobado()) with check (public.acceso_aprobado());

drop trigger if exists accesos_portal_auditoria on public.accesos_portal;
create trigger accesos_portal_auditoria after insert or update or delete on public.accesos_portal
  for each row execute function public.auditar();

-- Aviso nuevo en la campana del CDE
alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check check (tipo in (
  'general', 'proyecto', 'plan', 'compromiso', 'aporte', 'insignia', 'canje', 'cita', 'mentor', 'registro_docente', 'evento',
  'solicitud_acceso', 'solicitud_empresa', 'acceso_portal'));

-- ---------------------------------------------------------------------
-- 2. Permisos
-- ---------------------------------------------------------------------
create or replace function public.puede_ver_portal(empresa uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.acceso_aprobado() and (
       public.es_cde()
    or empresa in (select public.mis_empresas())
    or (public.rol_actual() = 'docente'
        and empresa in (select p.id_empresa from public.proyectos_aula p where p.id in (select public.proyectos_del_docente())))
    or (public.rol_actual() = 'estudiante'
        and exists (select 1 from public.accesos_portal a
                    where a.id_empresa = empresa and a.id_estudiante = auth.uid() and a.estado = 'aprobado'))
  );
$$;

-- Empresas cuyo portal puede abrir el usuario (para elegir una). El CDE busca por nombre.
create or replace function public.portal_empresas(texto text default null)
returns table (id uuid, nombre text, municipio text, representante text, motivo text)
language sql stable security definer set search_path = ''
as $$
  with permitidas as (
    select e.id, 'propia'::text as motivo from public.empresas e where e.id in (select public.mis_empresas())
    union
    select p.id_empresa, 'proyecto de aula' from public.proyectos_aula p
    where public.rol_actual() = 'docente' and p.id in (select public.proyectos_del_docente())
    union
    select a.id_empresa, 'acceso otorgado por el CDE' from public.accesos_portal a
    where public.rol_actual() = 'estudiante' and a.id_estudiante = auth.uid() and a.estado = 'aprobado'
    union
    select e.id, 'CDE' from public.empresas e where public.es_cde()
  )
  select distinct on (e.nombre, e.id) e.id, e.nombre, e.municipio, r.nombre, pm.motivo
  from permitidas pm
  join public.empresas e on e.id = pm.id
  left join public.perfiles r on r.id = e.id_representante
  where public.acceso_aprobado()
    and (texto is null or trim(texto) = '' or e.nombre ilike '%' || trim(texto) || '%' or e.nit like '%' || trim(texto) || '%')
  order by e.nombre, e.id
  limit 60;
$$;

-- ---------------------------------------------------------------------
-- 3. Estudiante pide acceso; el CDE lo resuelve (y puede darlo o revocarlo directamente)
-- ---------------------------------------------------------------------
create or replace function public.solicitar_acceso_portal(empresa uuid, motivo text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  nueva uuid;
  solicitante text := (select nombre from public.perfiles where id = auth.uid());
  nombre_empresa text := (select nombre from public.empresas where id = empresa);
begin
  if public.rol_actual() is distinct from 'estudiante' or not public.acceso_aprobado() then
    raise exception 'Solo los estudiantes piden acceso al portal';
  end if;
  if nombre_empresa is null then
    raise exception 'La empresa no existe';
  end if;
  if exists (select 1 from public.accesos_portal a where a.id_empresa = empresa and a.id_estudiante = auth.uid()
             and a.estado in ('pendiente', 'aprobado')) then
    raise exception 'Ya pediste acceso a esta empresa';
  end if;

  insert into public.accesos_portal (id_empresa, id_estudiante, motivo, estado)
  values (empresa, auth.uid(), nullif(left(trim(motivo), 500), ''), 'pendiente')
  on conflict (id_empresa, id_estudiante) do update
    set estado = 'pendiente', motivo = excluded.motivo, resuelto_por = null, resuelto_en = null, creado_en = now()
  returning id into nueva;

  insert into public.notificaciones (id_usuario, tipo, titulo, cuerpo, enlace, id_referencia)
  select p.id, 'acceso_portal', 'Acceso al portal del emprendedor',
         coalesce(solicitante, 'Un estudiante') || ' pide ver el portal de «' || nombre_empresa || '»'
         || coalesce(': ' || nullif(trim(motivo), ''), '.'),
         '/portal?empresa=' || empresa, nueva
  from public.perfiles p where p.rol::text in ('cde', 'admin_cde') and p.estado_acceso = 'aprobado';
  return nueva;
end;
$$;

create or replace function public.resolver_acceso_portal(acceso uuid, aprobar boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  a record;
begin
  if not public.es_cde() then
    raise exception 'Solo el equipo del CDE da acceso al portal';
  end if;
  select ap.*, e.nombre as empresa into a
  from public.accesos_portal ap join public.empresas e on e.id = ap.id_empresa where ap.id = acceso for update of ap;
  if a.id is null then
    raise exception 'La solicitud no existe';
  end if;
  update public.accesos_portal
  set estado = case when aprobar then 'aprobado' else 'rechazado' end, resuelto_por = auth.uid(), resuelto_en = now()
  where id = acceso;
  perform public.notificar(a.id_estudiante, 'general',
    case when aprobar then 'Tienes acceso a un portal del emprendedor' else 'Tu acceso al portal no fue aprobado' end,
    '«' || a.empresa || '»', case when aprobar then '/portal?empresa=' || a.id_empresa else '/portal' end);
  update public.notificaciones set leida_en = now() where id_referencia = acceso and tipo = 'acceso_portal' and leida_en is null;
end;
$$;

-- El CDE da acceso directo a un estudiante (sin solicitud) o lo revoca
create or replace function public.otorgar_acceso_portal(empresa uuid, estudiante uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.es_cde() then
    raise exception 'Solo el equipo del CDE da acceso al portal';
  end if;
  if not exists (select 1 from public.perfiles where id = estudiante and rol::text = 'estudiante') then
    raise exception 'Solo se da acceso a estudiantes';
  end if;
  insert into public.accesos_portal (id_empresa, id_estudiante, estado, resuelto_por, resuelto_en)
  values (empresa, estudiante, 'aprobado', auth.uid(), now())
  on conflict (id_empresa, id_estudiante) do update set estado = 'aprobado', resuelto_por = auth.uid(), resuelto_en = now();
  perform public.notificar(estudiante, 'general', 'Tienes acceso a un portal del emprendedor',
    '«' || (select nombre from public.empresas where id = empresa) || '»', '/portal?empresa=' || empresa);
end;
$$;

create or replace function public.revocar_acceso_portal(acceso uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.es_cde() then
    raise exception 'Solo el equipo del CDE revoca accesos';
  end if;
  update public.accesos_portal set estado = 'revocado', resuelto_por = auth.uid(), resuelto_en = now()
  where id = acceso and estado = 'aprobado';
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Datos del portal (solo lectura, con el permiso validado aquí)
-- ---------------------------------------------------------------------
create or replace function public.portal_datos(empresa uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  representante uuid := (select id_representante from public.empresas where id = empresa);
  hoy date := (now() at time zone 'America/Bogota')::date;
begin
  if not public.puede_ver_portal(empresa) then
    raise exception 'No tienes acceso al portal de esta empresa';
  end if;

  return jsonb_build_object(
    'empresa', (select to_jsonb(x) from (
        select e.id, e.nombre, e.nit, e.sector, e.tamano, e.municipio, e.departamento, e.formalizacion,
               e.descripcion, e.vinculo_unab, e.datos_estimados, e.creado_en,
               r.nombre as representante, m.nombre as mentor
        from public.empresas e
        left join public.perfiles r on r.id = e.id_representante
        left join public.perfiles m on m.id = e.id_mentor
        where e.id = empresa) x),
    'diagnosticos', coalesce((select jsonb_agg(to_jsonb(d) order by d.fecha desc, d.creado_en desc) from (
        select id, fecha, tipo_iniciativa, estrategia, mercadeo_ventas, financiera, normativa_legal, productividad,
               transformacion_digital, promedio, nivel, es_ejemplo, creado_en
        from public.diagnosticos where id_empresa = empresa) d), '[]'::jsonb),
    'brechas', coalesce((select jsonb_agg(to_jsonb(b) order by b.cerrada_en nulls first, b.detectada_en desc) from (
        select be.id, cb.area, cb.descripcion, cb.eje_diagnostico, be.semestre, be.detectada_en, be.cerrada_en, be.es_ejemplo
        from public.brechas_empresa be join public.catalogo_brechas cb on cb.id = be.id_brecha
        where be.id_empresa = empresa) b), '[]'::jsonb),
    'planes', coalesce((select jsonb_agg(to_jsonb(p) order by p.fecha_limite nulls last) from (
        select pl.id, pl.titulo, pl.area, pl.estado, pl.fecha_inicio, pl.fecha_limite, pl.es_ejemplo, r.nombre as responsable,
               coalesce((select round(avg(c.avance)) from public.compromisos c where c.id_plan = pl.id and c.estado <> 'Cancelado'), 0)::int as avance,
               coalesce((select jsonb_agg(jsonb_build_object(
                   'id', c.id, 'descripcion', c.descripcion, 'estado', c.estado, 'avance', c.avance, 'fecha_limite', c.fecha_limite,
                   'responsable', rc.nombre,
                   'vencido', c.estado in ('Pendiente', 'En curso') and c.fecha_limite < hoy)
                 order by c.fecha_limite nulls last)
                 from public.compromisos c left join public.perfiles rc on rc.id = c.id_responsable
                 where c.id_plan = pl.id and c.estado <> 'Cancelado'), '[]'::jsonb) as compromisos
        from public.planes_accion pl left join public.perfiles r on r.id = pl.id_responsable
        where pl.id_empresa = empresa) p), '[]'::jsonb),
    'historial', coalesce((select jsonb_agg(to_jsonb(h) order by h.fecha desc) from (
        select tipo, fecha, titulo, detalle, estado, id_registro
        from public.historial_empresa where id_empresa = empresa and fecha is not null
        order by fecha desc limit 40) h), '[]'::jsonb),
    -- Actividades del representante (inscripciones) y oferta abierta del CDE
    'mis_eventos', coalesce((select jsonb_agg(to_jsonb(ev) order by ev.fecha) from (
        select e.id, e.nombre, e.tipo, e.fecha, e.lugar, e.puntos_gamificacion, i.estado, i.asistio
        from public.inscripciones_eventos i join public.eventos e on e.id = i.id_evento
        where (i.id_usuario = representante or i.id_empresa = empresa) and e.fecha >= now() - interval '1 day'
          and i.estado <> 'rechazado'
        order by e.fecha limit 10) ev), '[]'::jsonb),
    'oferta', coalesce((select jsonb_agg(to_jsonb(ev) order by ev.fecha) from (
        select e.id, e.nombre, e.tipo, e.fecha, e.lugar, e.descripcion, e.cupo, e.puntos_gamificacion, e.es_ejemplo
        from public.eventos e
        where e.fecha >= now() and public.tipo_evento_publico(e.tipo)
          and e.tipo in ('Capacitación', 'Evento', 'Networking', 'Feria', 'Sesión empresarial', 'Ruta de acompañamiento', 'Conversatorio')
        order by e.fecha limit 30) ev), '[]'::jsonb),
    'progreso', case when representante is null then null else (select jsonb_build_object(
        'puntos', coalesce(pu.puntos, 0), 'saldo', coalesce(pu.saldo, 0), 'eventos_asistidos', coalesce(pu.eventos_asistidos, 0),
        'insignias', coalesce((select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'nivel', i.nivel, 'criterio', i.criterio,
                                 'otorgada_en', iu.otorgada_en) order by iu.otorgada_en desc)
                               from public.insignias_usuario iu join public.insignias i on i.id = iu.id_insignia
                               where iu.id_usuario = representante), '[]'::jsonb))
        from (select 1) uno left join public.puntos_usuario pu on pu.id_usuario = representante) end,
    'equipo', coalesce((select jsonb_agg(distinct jsonb_build_object('nombre', pf.nombre, 'rol', pf.rol)) from public.proyectos_aula pa
        join public.proyecto_docentes pd on pd.id_proyecto = pa.id join public.perfiles pf on pf.id = pd.id_docente
        where pa.id_empresa = empresa), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.puede_ver_portal(uuid), public.portal_empresas(text), public.solicitar_acceso_portal(uuid, text),
  public.resolver_acceso_portal(uuid, boolean), public.otorgar_acceso_portal(uuid, uuid), public.revocar_acceso_portal(uuid),
  public.portal_datos(uuid) from public, anon;
grant execute on function public.puede_ver_portal(uuid), public.portal_empresas(text), public.solicitar_acceso_portal(uuid, text),
  public.resolver_acceso_portal(uuid, boolean), public.otorgar_acceso_portal(uuid, uuid), public.revocar_acceso_portal(uuid),
  public.portal_datos(uuid) to authenticated;
