-- =====================================================================
-- CDE UNAB · Retroalimentación del modelo de datos
--
--   1. Empresa: mentor del CDE, varios contactos e ingresos por año
--   2. Planes de acción con compromisos (responsable, fecha, estado y avance visibles)
--   3. Gamificación: áreas, aportes validados → puntos → insignias, recompensas/canjes,
--      recorrido de bienvenida (mascota)
--   4. Notificaciones y mensajes (foro de coworking y canal por proyecto de aula)
--   5. Detalles: inscripción ligada a la empresa y control de cupos, asignatura única
--      en proyectos de aula, línea de tiempo con planes de acción
--
-- Todas las tablas nuevas: RLS + candado RESTRICTIVE "solo_acceso_aprobado" (0008).
-- Los puntos nunca los escribe el usuario: los generan triggers SECURITY DEFINER.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Empresa: mentor, contactos e ingresos
-- ---------------------------------------------------------------------
alter table public.empresas
  add column id_mentor uuid references public.perfiles (id) on delete set null;
comment on column public.empresas.id_mentor is 'Miembro del CDE que acompaña a la empresa';
create index empresas_mentor_idx on public.empresas (id_mentor);

create or replace function public.validar_mentor()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.id_mentor is not null and not exists (
       select 1 from public.perfiles where id = new.id_mentor and rol::text in ('cde', 'admin_cde')) then
    raise exception 'El mentor debe ser un miembro del CDE';
  end if;
  return new;
end;
$$;
create trigger empresas_validar_mentor before insert or update of id_mentor on public.empresas
  for each row execute function public.validar_mentor();

-- Varios contactos por empresa. id_representante sigue siendo el contacto principal y dueño de la cuenta;
-- un contacto con id_perfil (lo enlaza solo el CDE) también ve la empresa como suya.
create table public.contactos_empresa (
  id uuid primary key default gen_random_uuid(),
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  id_perfil uuid references public.perfiles (id) on delete set null,
  nombre text not null check (length(trim(nombre)) > 0),
  cargo text,
  correo text check (correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefono text,
  es_principal boolean not null default false,
  creado_en timestamptz not null default now(),
  unique (id_empresa, id_perfil)
);
create index contactos_empresa_empresa_idx on public.contactos_empresa (id_empresa);
create index contactos_empresa_perfil_idx on public.contactos_empresa (id_perfil);
create unique index contactos_empresa_un_principal on public.contactos_empresa (id_empresa) where es_principal;

-- Ingresos anuales (un valor por año; el CDE puede verificar el que reporta el emprendedor)
create table public.ingresos_empresa (
  id uuid primary key default gen_random_uuid(),
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  anio smallint not null check (anio between 2000 and 2100),
  monto numeric(16,2) not null check (monto >= 0),           -- pesos colombianos
  fuente text not null default 'Reportado por la empresa'
    check (fuente in ('Reportado por la empresa', 'Verificado por el CDE')),
  registrado_por uuid references public.perfiles (id) default auth.uid(),
  creado_en timestamptz not null default now(),
  unique (id_empresa, anio)
);

-- "Mis empresas" ahora incluye las que el usuario representa como contacto enlazado
create or replace function public.mis_empresas()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.empresas where id_representante = auth.uid()
  union
  select id_empresa from public.contactos_empresa where id_perfil = auth.uid();
$$;

alter policy emprendedor_lee_su_empresa on public.empresas
  using (id in (select public.mis_empresas()));
alter policy emprendedor_lee_sus_atenciones on public.atenciones
  using (id_empresa in (select public.mis_empresas()));

-- ---------------------------------------------------------------------
-- 2. Planes de acción y compromisos
-- ---------------------------------------------------------------------
create table public.planes_accion (
  id uuid primary key default gen_random_uuid(),
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  id_diagnostico uuid references public.diagnosticos (id) on delete set null,   -- brecha que origina el plan
  titulo text not null check (length(trim(titulo)) > 0),
  objetivo text,
  area text check (area in ('estrategia', 'mercadeo_ventas', 'financiera', 'normativa_legal',
                            'productividad', 'transformacion_digital', 'otra')),
  id_responsable uuid not null references public.perfiles (id),
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'En curso', 'Completado', 'Cancelado')),
  fecha_inicio date not null default current_date,
  fecha_limite date,
  creado_por uuid references public.perfiles (id) default auth.uid(),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (fecha_limite is null or fecha_limite >= fecha_inicio)
);
create index planes_accion_empresa_idx on public.planes_accion (id_empresa);
create index planes_accion_responsable_idx on public.planes_accion (id_responsable);

create table public.compromisos (
  id uuid primary key default gen_random_uuid(),
  id_plan uuid not null references public.planes_accion (id) on delete cascade,
  descripcion text not null check (length(trim(descripcion)) > 0),
  id_responsable uuid references public.perfiles (id),        -- null = el responsable del plan
  fecha_limite date,
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'En curso', 'Cumplido', 'Cancelado')),
  avance smallint not null default 0 check (avance between 0 and 100),
  evidencia text,                                             -- enlace o nota de soporte
  completado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index compromisos_plan_idx on public.compromisos (id_plan);
create index compromisos_responsable_idx on public.compromisos (id_responsable);

-- Planes que el usuario puede ver: los de sus empresas, los de las empresas de sus proyectos
-- de aula y aquellos donde es responsable (del plan o de un compromiso)
create or replace function public.planes_visibles()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select p.id from public.planes_accion p
  where p.id_empresa in (select public.mis_empresas())
     or p.id_responsable = auth.uid()
     or p.id_empresa in (select pa.id_empresa from public.proyectos_aula pa
                         where pa.id in (select public.proyectos_del_docente() union select public.proyectos_del_estudiante()))
  union
  select c.id_plan from public.compromisos c where c.id_responsable = auth.uid();
$$;

-- Compromisos cuyo avance puede reportar el usuario: los suyos, los de planes que lidera
-- (cuando no tienen responsable propio) y los de sus empresas
create or replace function public.compromisos_editables()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select c.id from public.compromisos c
  join public.planes_accion p on p.id = c.id_plan
  where coalesce(c.id_responsable, p.id_responsable) = auth.uid()
     or p.id_responsable = auth.uid()
     or p.id_empresa in (select public.mis_empresas());
$$;

-- Fuera del CDE solo se reporta avance: estado, porcentaje y evidencia
create or replace function public.proteger_compromiso()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.es_cde() and (
       new.id_plan is distinct from old.id_plan
    or new.descripcion is distinct from old.descripcion
    or new.id_responsable is distinct from old.id_responsable
    or new.fecha_limite is distinct from old.fecha_limite) then
    raise exception 'Solo el CDE cambia la descripción, el responsable o la fecha del compromiso';
  end if;
  -- Estado y avance coherentes
  if new.estado = 'Cumplido' then
    new.avance := 100;
  elsif new.avance = 100 and new.estado <> 'Cancelado' then
    new.estado := 'Cumplido';
  elsif new.avance > 0 and new.estado = 'Pendiente' then
    new.estado := 'En curso';
  end if;
  new.completado_en := case when new.estado = 'Cumplido' then coalesce(new.completado_en, now()) end;
  new.actualizado_en := now();
  return new;
end;
$$;
create trigger compromisos_proteger before insert or update on public.compromisos
  for each row execute function public.proteger_compromiso();

create or replace function public.proteger_plan()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- El responsable (no CDE) solo mueve el estado del plan
  if auth.uid() is not null and not public.es_cde() and (
       new.id_empresa is distinct from old.id_empresa
    or new.id_diagnostico is distinct from old.id_diagnostico
    or new.titulo is distinct from old.titulo
    or new.objetivo is distinct from old.objetivo
    or new.area is distinct from old.area
    or new.id_responsable is distinct from old.id_responsable
    or new.fecha_inicio is distinct from old.fecha_inicio
    or new.fecha_limite is distinct from old.fecha_limite) then
    raise exception 'El responsable solo puede cambiar el estado del plan';
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;
create trigger planes_accion_proteger before update on public.planes_accion
  for each row execute function public.proteger_plan();

-- ---------------------------------------------------------------------
-- 3. Gamificación
-- ---------------------------------------------------------------------
-- Áreas configurables (programación, diseño, teoría…) y cuántos puntos da un aporte validado
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  puntos_por_aporte integer not null default 10 check (puntos_por_aporte between 1 and 1000),
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Aportes de cada persona a un proyecto de aula; el docente (o el CDE) los valida
create table public.aportes (
  id uuid primary key default gen_random_uuid(),
  id_proyecto uuid not null references public.proyectos_aula (id) on delete cascade,
  id_usuario uuid not null references public.perfiles (id) on delete cascade default auth.uid(),
  id_area uuid not null references public.areas (id),
  descripcion text not null check (length(trim(descripcion)) between 1 and 2000),
  evidencia_url text check (evidencia_url ~* '^https?://'),
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'Validado', 'Rechazado')),
  comentario_revision text,
  validado_por uuid references public.perfiles (id),
  validado_en timestamptz,
  creado_en timestamptz not null default now()
);
create index aportes_proyecto_idx on public.aportes (id_proyecto);
create index aportes_usuario_idx on public.aportes (id_usuario, estado);

-- Catálogo de insignias con un criterio que la base evalúa sola
create table public.insignias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text not null,
  id_area uuid references public.areas (id) on delete cascade,     -- null = cualquier área
  nivel smallint not null default 1 check (nivel between 1 and 3),  -- 1 bronce, 2 plata, 3 oro
  criterio text not null check (criterio in ('aportes_validados', 'puntos', 'eventos_asistidos', 'onboarding', 'manual')),
  meta integer not null default 1 check (meta > 0),
  roles public.rol_usuario[],                                       -- quién la ve y la puede ganar; null = todos
  icono text,
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.insignias_usuario (
  id_usuario uuid not null references public.perfiles (id) on delete cascade,
  id_insignia uuid not null references public.insignias (id) on delete cascade,
  otorgada_en timestamptz not null default now(),
  otorgada_por uuid references public.perfiles (id) default auth.uid(),   -- null = automática
  primary key (id_usuario, id_insignia)
);

-- Libro de puntos: un movimiento por cada punto ganado o gastado. El total se calcula, no se guarda.
create table public.puntos_movimientos (
  id bigint generated always as identity primary key,
  id_usuario uuid not null references public.perfiles (id) on delete cascade,
  puntos integer not null check (puntos <> 0),
  motivo text not null,
  origen_tipo text not null check (origen_tipo in ('evento', 'aporte', 'onboarding', 'canje', 'ajuste')),
  origen_id uuid,                                   -- inscripción, aporte, canje… (null en ajustes)
  creado_por uuid references public.perfiles (id) default auth.uid(),
  creado_en timestamptz not null default now(),
  unique (origen_tipo, origen_id, id_usuario)       -- el mismo origen nunca suma dos veces
);
create index puntos_movimientos_usuario_idx on public.puntos_movimientos (id_usuario);

-- Catálogo de recompensas (lo aprueba la UNAB) y canjes
create table public.recompensas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  costo_puntos integer not null check (costo_puntos > 0),
  stock integer check (stock >= 0),                 -- null = ilimitado
  activa boolean not null default true,
  aprobada_por uuid references public.perfiles (id) default auth.uid(),
  creado_en timestamptz not null default now()
);

create table public.canjes (
  id uuid primary key default gen_random_uuid(),
  id_recompensa uuid not null references public.recompensas (id),
  id_usuario uuid not null references public.perfiles (id) on delete cascade default auth.uid(),
  puntos integer not null default 0,                -- lo fija el trigger con el costo vigente
  estado text not null default 'Solicitado' check (estado in ('Solicitado', 'Entregado', 'Rechazado')),
  comentario text,
  resuelto_por uuid references public.perfiles (id),
  resuelto_en timestamptz,
  creado_en timestamptz not null default now()
);
create index canjes_usuario_idx on public.canjes (id_usuario);

-- Recorrido de bienvenida de la mascota
create table public.progreso_onboarding (
  id_usuario uuid primary key references public.perfiles (id) on delete cascade default auth.uid(),
  paso_actual smallint not null default 0 check (paso_actual >= 0),
  pasos_completados text[] not null default '{}',
  completado_en timestamptz,
  actualizado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Notificaciones y mensajes
-- ---------------------------------------------------------------------
create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  id_usuario uuid not null references public.perfiles (id) on delete cascade,
  tipo text not null default 'general'
    check (tipo in ('general', 'proyecto', 'plan', 'compromiso', 'aporte', 'insignia', 'canje', 'cita', 'mentor')),
  titulo text not null,
  cuerpo text,
  enlace text check (enlace like '/%'),             -- ruta interna de la app
  leida_en timestamptz,
  creado_en timestamptz not null default now()
);
create index notificaciones_usuario_idx on public.notificaciones (id_usuario, creado_en desc);

-- Canales: el foro abierto del coworking y uno por proyecto de aula
create table public.canales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  tipo text not null default 'foro' check (tipo in ('foro', 'proyecto')),
  id_proyecto uuid unique references public.proyectos_aula (id) on delete cascade,
  creado_en timestamptz not null default now(),
  check ((tipo = 'proyecto') = (id_proyecto is not null))
);

create table public.mensajes (
  id uuid primary key default gen_random_uuid(),
  id_canal uuid not null references public.canales (id) on delete cascade,
  id_autor uuid not null references public.perfiles (id) on delete cascade default auth.uid(),
  contenido text not null check (length(trim(contenido)) between 1 and 4000),
  id_respuesta_a uuid references public.mensajes (id) on delete set null,
  creado_en timestamptz not null default now(),
  editado_en timestamptz
);
create index mensajes_canal_idx on public.mensajes (id_canal, creado_en);

create or replace function public.puede_ver_canal(canal uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_cde() or exists (
    select 1 from public.canales k
    where k.id = canal
      and (k.tipo = 'foro'
           or k.id_proyecto in (select public.proyectos_del_docente()
                                union select public.proyectos_del_estudiante()
                                union select p.id from public.proyectos_aula p
                                      where p.id_empresa in (select public.mis_empresas()))));
$$;

create or replace function public.preparar_mensaje()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.id_canal is distinct from old.id_canal or new.id_autor is distinct from old.id_autor then
    raise exception 'Un mensaje no cambia de canal ni de autor';
  end if;
  new.editado_en := now();
  return new;
end;
$$;
create trigger mensajes_preparar before update on public.mensajes
  for each row execute function public.preparar_mensaje();

-- Notificación interna (no se notifica a quien hizo la acción)
create or replace function public.notificar(destino uuid, tipo text, titulo text, cuerpo text, enlace text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notificaciones (id_usuario, tipo, titulo, cuerpo, enlace)
  select destino, tipo, titulo, cuerpo, enlace
  where destino is not null and destino is distinct from auth.uid();
$$;

-- Personas de una empresa: representante + contactos con cuenta
create or replace function public.personas_de_empresa(empresa uuid)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select id_representante from public.empresas where id = empresa and id_representante is not null
  union
  select id_perfil from public.contactos_empresa where id_empresa = empresa and id_perfil is not null;
$$;

-- ---------------------------------------------------------------------
-- 3b. Motor de puntos e insignias
-- ---------------------------------------------------------------------
create or replace function public.otorgar_insignias(usuario uuid)
returns void
language sql security definer set search_path = ''
as $$
  with candidata as (
    select i.id, i.nombre from public.insignias i
    where i.activa and i.criterio <> 'manual'
      and (i.roles is null or (select rol from public.perfiles where id = usuario) = any (i.roles))
      and case i.criterio
            when 'aportes_validados' then
              (select count(*) from public.aportes a
               where a.id_usuario = usuario and a.estado = 'Validado' and (i.id_area is null or a.id_area = i.id_area)) >= i.meta
            when 'puntos' then
              (select coalesce(sum(m.puntos), 0) from public.puntos_movimientos m
               where m.id_usuario = usuario and m.puntos > 0) >= i.meta
            when 'eventos_asistidos' then
              (select count(*) from public.inscripciones_eventos e where e.id_usuario = usuario and e.asistio) >= i.meta
            when 'onboarding' then
              exists (select 1 from public.progreso_onboarding o where o.id_usuario = usuario and o.completado_en is not null)
          end
  ), nuevas as (
    insert into public.insignias_usuario (id_usuario, id_insignia, otorgada_por)
    select usuario, id, null from candidata
    on conflict do nothing
    returning id_insignia
  )
  insert into public.notificaciones (id_usuario, tipo, titulo, cuerpo, enlace)
  select usuario, 'insignia', '¡Ganaste una insignia!', c.nombre, '/logros'
  from nuevas n join candidata c on c.id = n.id_insignia;
$$;

create or replace function public.tras_movimiento_puntos()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.otorgar_insignias(new.id_usuario);
  return null;
end;
$$;
create trigger puntos_movimientos_insignias after insert on public.puntos_movimientos
  for each row execute function public.tras_movimiento_puntos();

-- Asistencia a eventos → puntos (y desmarcarla los retira)
create or replace function public.puntos_por_asistencia()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  ev record;
begin
  select nombre, puntos_gamificacion into ev from public.eventos where id = new.id_evento;
  if new.asistio and (tg_op = 'INSERT' or not old.asistio) then
    if ev.puntos_gamificacion > 0 then
      insert into public.puntos_movimientos (id_usuario, puntos, motivo, origen_tipo, origen_id)
      values (new.id_usuario, ev.puntos_gamificacion, 'Asistencia: ' || ev.nombre, 'evento', new.id)
      on conflict do nothing;
    else
      perform public.otorgar_insignias(new.id_usuario);   -- cuenta para "eventos asistidos"
    end if;
  elsif tg_op = 'UPDATE' and old.asistio and not new.asistio then
    delete from public.puntos_movimientos where origen_tipo = 'evento' and origen_id = new.id;
  end if;
  return null;
end;
$$;
create trigger inscripciones_puntos after insert or update of asistio on public.inscripciones_eventos
  for each row execute function public.puntos_por_asistencia();

-- Aportes: el estudiante propone, el docente del proyecto (o el CDE) valida
create or replace function public.gestionar_aporte()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.es_cde() then
    if tg_op = 'INSERT' then
      new.estado := 'Pendiente';
      new.comentario_revision := null;
    elsif auth.uid() = old.id_usuario then
      -- El autor edita su aporte mientras está pendiente (RLS) y no lo valida
      if new.estado <> 'Pendiente' or new.id_usuario <> old.id_usuario or new.id_proyecto <> old.id_proyecto then
        raise exception 'No puedes validar ni mover tu propio aporte';
      end if;
    else
      -- El docente solo decide: estado y comentario
      if new.id_usuario <> old.id_usuario or new.id_proyecto <> old.id_proyecto or new.id_area <> old.id_area
         or new.descripcion <> old.descripcion or new.evidencia_url is distinct from old.evidencia_url then
        raise exception 'El docente solo puede validar o rechazar el aporte';
      end if;
    end if;
  end if;
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    if new.estado = 'Pendiente' then
      new.validado_por := null;
      new.validado_en := null;
    else
      new.validado_por := coalesce(auth.uid(), new.validado_por);
      new.validado_en := now();
    end if;
  end if;
  return new;
end;
$$;
create trigger aportes_gestionar before insert or update on public.aportes
  for each row execute function public.gestionar_aporte();

create or replace function public.puntos_por_aporte()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  ar record;
  proyecto text;
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then
    return null;
  end if;
  select nombre, puntos_por_aporte into ar from public.areas where id = new.id_area;
  select nombre into proyecto from public.proyectos_aula where id = new.id_proyecto;

  if new.estado = 'Validado' then
    insert into public.puntos_movimientos (id_usuario, puntos, motivo, origen_tipo, origen_id)
    values (new.id_usuario, ar.puntos_por_aporte, 'Aporte validado en ' || ar.nombre, 'aporte', new.id)
    on conflict do nothing;
  elsif tg_op = 'UPDATE' and old.estado = 'Validado' then
    delete from public.puntos_movimientos where origen_tipo = 'aporte' and origen_id = new.id;
  end if;

  if new.estado <> 'Pendiente' then
    perform public.notificar(new.id_usuario, 'aporte',
      case new.estado when 'Validado' then 'Tu aporte fue validado (+' || ar.puntos_por_aporte || ' puntos)'
                      else 'Tu aporte fue rechazado' end,
      coalesce(new.comentario_revision, proyecto), '/logros');
  end if;
  return null;
end;
$$;
create trigger aportes_puntos after insert or update of estado on public.aportes
  for each row execute function public.puntos_por_aporte();

-- Canjes: se validan el saldo y el stock; rechazar un canje devuelve los puntos
create or replace function public.validar_canje()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  saldo integer;
begin
  if tg_op = 'INSERT' then
    -- Un canje a la vez por usuario: evita gastar el mismo saldo dos veces
    perform pg_advisory_xact_lock(hashtextextended('canje:' || new.id_usuario::text, 0));
    select * into r from public.recompensas where id = new.id_recompensa for update;
    if not found or not r.activa then
      raise exception 'La recompensa no está disponible';
    end if;
    if r.stock is not null and r.stock = 0 then
      raise exception 'La recompensa está agotada';
    end if;
    select coalesce(sum(puntos), 0) into saldo from public.puntos_movimientos where id_usuario = new.id_usuario;
    if saldo < r.costo_puntos then
      raise exception 'Puntos insuficientes: tienes % y la recompensa cuesta %', saldo, r.costo_puntos;
    end if;
    new.puntos := r.costo_puntos;
    new.estado := 'Solicitado';
    new.resuelto_por := null;
    new.resuelto_en := null;
    update public.recompensas set stock = stock - 1 where id = r.id and stock is not null;
  else
    if new.id_usuario <> old.id_usuario or new.id_recompensa <> old.id_recompensa or new.puntos <> old.puntos then
      raise exception 'Un canje no cambia de usuario, recompensa ni puntos';
    end if;
    if old.estado = 'Rechazado' and new.estado <> 'Rechazado' then
      raise exception 'Un canje rechazado no se reabre: el usuario debe solicitarlo de nuevo';
    end if;
    if new.estado is distinct from old.estado then
      new.resuelto_por := auth.uid();
      new.resuelto_en := now();
    end if;
  end if;
  return new;
end;
$$;
create trigger canjes_validar before insert or update on public.canjes
  for each row execute function public.validar_canje();

create or replace function public.movimiento_canje()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  recompensa text;
begin
  select nombre into recompensa from public.recompensas where id = new.id_recompensa;
  if tg_op = 'INSERT' then
    insert into public.puntos_movimientos (id_usuario, puntos, motivo, origen_tipo, origen_id)
    values (new.id_usuario, -new.puntos, 'Canje: ' || recompensa, 'canje', new.id);
  elsif new.estado is distinct from old.estado then
    if new.estado = 'Rechazado' then
      delete from public.puntos_movimientos where origen_tipo = 'canje' and origen_id = new.id;
      update public.recompensas set stock = stock + 1 where id = new.id_recompensa and stock is not null;
    end if;
    perform public.notificar(new.id_usuario, 'canje',
      case new.estado when 'Entregado' then 'Tu recompensa fue entregada'
                      else 'Tu canje fue rechazado; te devolvimos los puntos' end,
      coalesce(new.comentario, recompensa), '/logros');
  end if;
  return null;
end;
$$;
create trigger canjes_movimiento after insert or update of estado on public.canjes
  for each row execute function public.movimiento_canje();

-- Recorrido de bienvenida completado → puntos (una sola vez)
create or replace function public.puntos_por_onboarding()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.actualizado_en := now();
  if new.completado_en is not null and (tg_op = 'INSERT' or old.completado_en is null) then
    new.completado_en := now();   -- la fecha la pone el servidor
  elsif tg_op = 'UPDATE' and old.completado_en is not null then
    new.completado_en := old.completado_en;   -- completado no se deshace
  end if;
  return new;
end;
$$;
create trigger progreso_onboarding_preparar before insert or update on public.progreso_onboarding
  for each row execute function public.puntos_por_onboarding();

create or replace function public.premiar_onboarding()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.completado_en is not null then
    insert into public.puntos_movimientos (id_usuario, puntos, motivo, origen_tipo, origen_id)
    values (new.id_usuario, 20, 'Recorrido de bienvenida completado', 'onboarding', new.id_usuario)
    on conflict do nothing;
  end if;
  return null;
end;
$$;
create trigger progreso_onboarding_premiar after insert or update of completado_en on public.progreso_onboarding
  for each row execute function public.premiar_onboarding();

-- Saldo y ranking. puntos = ganados (ranking); saldo = ganados − canjeados
create or replace view public.puntos_usuario with (security_invoker = true) as
select m.id_usuario,
       coalesce(sum(m.puntos) filter (where m.puntos > 0), 0)::int as puntos,
       (select count(*) from public.inscripciones_eventos i where i.id_usuario = m.id_usuario and i.asistio) as eventos_asistidos,
       coalesce(sum(m.puntos), 0)::int as saldo,
       (select count(*) from public.insignias_usuario iu where iu.id_usuario = m.id_usuario) as insignias
from public.puntos_movimientos m
group by m.id_usuario;

-- Tabla de posiciones: solo nombre, rol y totales (los movimientos de cada quien siguen privados)
create or replace function public.ranking_puntos(limite integer default 10)
returns table (posicion bigint, id uuid, nombre text, rol public.rol_usuario, puntos integer, insignias bigint)
language sql stable security definer set search_path = ''
as $$
  select rank() over (order by t.puntos desc), p.id, p.nombre, p.rol, t.puntos,
         (select count(*) from public.insignias_usuario iu where iu.id_usuario = p.id)
  from (select id_usuario, sum(puntos)::int as puntos from public.puntos_movimientos
        where puntos > 0 group by id_usuario) t
  join public.perfiles p on p.id = t.id_usuario
  where public.acceso_aprobado()
  order by t.puntos desc
  limit least(greatest(limite, 1), 100);
$$;

-- ---------------------------------------------------------------------
-- 4b. Notificaciones automáticas
-- ---------------------------------------------------------------------
create or replace function public.notificar_proyecto()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.estado is distinct from old.estado or new.resultados is distinct from old.resultados then
    perform public.notificar(persona, 'proyecto', 'Avance en tu proyecto de aula: ' || new.nombre,
                             'Estado: ' || new.estado::text || coalesce(' · ' || new.resultados, ''),
                             '/empresas/' || new.id_empresa)
    from public.personas_de_empresa(new.id_empresa) persona;
  end if;
  return null;
end;
$$;
create trigger proyectos_aula_notificar after update on public.proyectos_aula
  for each row execute function public.notificar_proyecto();

create or replace function public.notificar_plan()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notificar(new.id_responsable, 'plan', 'Eres responsable de un plan de acción', new.titulo,
                             '/empresas/' || new.id_empresa);
    perform public.notificar(persona, 'plan', 'Nuevo plan de acción para tu empresa', new.titulo,
                             '/empresas/' || new.id_empresa)
    from public.personas_de_empresa(new.id_empresa) persona
    where persona is distinct from new.id_responsable;
  elsif new.id_responsable is distinct from old.id_responsable then
    perform public.notificar(new.id_responsable, 'plan', 'Eres responsable de un plan de acción', new.titulo,
                             '/empresas/' || new.id_empresa);
  end if;
  return null;
end;
$$;
create trigger planes_accion_notificar after insert or update of id_responsable on public.planes_accion
  for each row execute function public.notificar_plan();

create or replace function public.notificar_compromiso()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  empresa uuid;
begin
  if new.id_responsable is not null and (tg_op = 'INSERT' or new.id_responsable is distinct from old.id_responsable) then
    select id_empresa into empresa from public.planes_accion where id = new.id_plan;
    perform public.notificar(new.id_responsable, 'compromiso', 'Tienes un nuevo compromiso',
                             new.descripcion || coalesce(' · vence el ' || to_char(new.fecha_limite, 'DD/MM/YYYY'), ''),
                             '/empresas/' || empresa);
  end if;
  return null;
end;
$$;
create trigger compromisos_notificar after insert or update of id_responsable on public.compromisos
  for each row execute function public.notificar_compromiso();

create or replace function public.notificar_cita()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.estado is distinct from old.estado or new.fecha_hora is distinct from old.fecha_hora then
    perform public.notificar(new.solicitada_por, 'cita', 'Tu cita está ' || lower(new.estado),
      new.motivo || coalesce(' · ' || to_char(new.fecha_hora at time zone 'America/Bogota', 'DD/MM/YYYY HH24:MI'), ''),
      '/empresas/' || new.id_empresa);
  end if;
  return null;
end;
$$;
create trigger citas_notificar after update on public.citas
  for each row execute function public.notificar_cita();

create or replace function public.notificar_mentor()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.id_mentor is not null and (tg_op = 'INSERT' or new.id_mentor is distinct from old.id_mentor) then
    perform public.notificar(new.id_mentor, 'mentor', 'Te asignaron como mentor', new.nombre, '/empresas/' || new.id);
  end if;
  return null;
end;
$$;
create trigger empresas_notificar_mentor after insert or update of id_mentor on public.empresas
  for each row execute function public.notificar_mentor();

-- Cada proyecto de aula nace con su canal de mensajes
create or replace function public.crear_canal_proyecto()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.canales (nombre, tipo, id_proyecto) values (new.nombre, 'proyecto', new.id)
  on conflict (id_proyecto) do nothing;
  return null;
end;
$$;
create trigger proyectos_aula_canal after insert on public.proyectos_aula
  for each row execute function public.crear_canal_proyecto();

-- ---------------------------------------------------------------------
-- 5. Detalles
-- ---------------------------------------------------------------------
-- 5a. Cada inscripción queda asociada a una empresa (la del inscrito, si tiene) y se respetan los cupos
alter table public.inscripciones_eventos
  add column id_empresa uuid references public.empresas (id) on delete set null;
create index inscripciones_empresa_idx on public.inscripciones_eventos (id_empresa);

create or replace function public.preparar_inscripcion()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  cupo_evento integer;
begin
  select cupo into cupo_evento from public.eventos where id = new.id_evento for update;  -- serializa inscripciones
  if cupo_evento is not null
     and (select count(*) from public.inscripciones_eventos where id_evento = new.id_evento) >= cupo_evento then
    raise exception 'El evento no tiene cupos disponibles';
  end if;

  if new.id_empresa is null then
    select e.id into new.id_empresa
    from public.empresas e
    where e.id_representante = new.id_usuario
       or e.id in (select id_empresa from public.contactos_empresa where id_perfil = new.id_usuario)
    order by e.creado_en
    limit 1;
  elsif auth.uid() is not null and not public.es_cde()
        and new.id_empresa not in (select public.mis_empresas()) then
    raise exception 'Solo puedes inscribir a una empresa que representas';
  end if;
  return new;
end;
$$;
create trigger inscripciones_preparar before insert on public.inscripciones_eventos
  for each row execute function public.preparar_inscripcion();

update public.inscripciones_eventos i set id_empresa = e.id
from public.empresas e
where i.id_empresa is null and e.id_representante = i.id_usuario;

create or replace function public.cupos_eventos()
returns table (id_evento uuid, cupo integer, inscritos bigint, disponibles integer)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.cupo, count(i.id),
         case when e.cupo is null then null else greatest(e.cupo - count(i.id), 0)::int end
  from public.eventos e
  left join public.inscripciones_eventos i on i.id_evento = e.id
  where public.acceso_aprobado()
  group by e.id;
$$;

-- 5b. Proyectos de aula: id_asignatura es la única fuente; el texto libre queda como dato heredado
alter table public.proyectos_aula rename column asignatura to asignatura_heredada;
comment on column public.proyectos_aula.asignatura_heredada is 'Dato heredado (texto libre). Usar id_asignatura.';
-- Flexible pero sin duplicados: una empresa no tiene dos proyectos de la misma asignatura en un semestre
create unique index proyectos_aula_unico_por_asignatura
  on public.proyectos_aula (id_empresa, id_asignatura, semestre) where id_asignatura is not null;

-- 5c. Canales: foro de coworking + uno por cada proyecto existente
insert into public.canales (nombre, descripcion, tipo)
values ('Coworking', 'Foro abierto de la comunidad del CDE', 'foro');
insert into public.canales (nombre, tipo, id_proyecto)
select nombre, 'proyecto', id from public.proyectos_aula
on conflict (id_proyecto) do nothing;

-- 5d. Directorio: también el mentor, los responsables de planes visibles y quienes escriben en mis canales
create or replace function public.directorio()
returns table (id uuid, nombre text, rol public.rol_usuario)
language sql stable security definer set search_path = ''
as $$
  with mis_proyectos as (
    select public.proyectos_del_docente()
    union select public.proyectos_del_estudiante()
    union select p.id from public.proyectos_aula p where p.id_empresa in (select public.mis_empresas())
  ), mis_planes as (
    select public.planes_visibles() as id
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
                 where id_asignatura in (select public.asignaturas_del_docente()))
     or p.id in (select id_mentor from public.empresas where id in (select public.mis_empresas()))
     or p.id in (select id_responsable from public.planes_accion where id in (select id from mis_planes))
     or p.id in (select id_responsable from public.compromisos where id_plan in (select id from mis_planes))
     or p.id in (select m.id_autor from public.mensajes m where public.puede_ver_canal(m.id_canal));
$$;

-- 5e. Avance de cada plan (responsable, estado, % y compromisos vencidos)
create view public.avance_planes with (security_invoker = true) as
select p.id, p.id_empresa, e.nombre as empresa, p.titulo, p.area, p.estado,
       p.fecha_inicio, p.fecha_limite, p.id_responsable, r.nombre as responsable,
       count(c.id) filter (where c.estado <> 'Cancelado') as compromisos,
       count(c.id) filter (where c.estado = 'Cumplido') as cumplidos,
       count(c.id) filter (where c.estado in ('Pendiente', 'En curso')
                             and c.fecha_limite < (now() at time zone 'America/Bogota')::date) as vencidos,
       coalesce(round(avg(c.avance) filter (where c.estado <> 'Cancelado')), 0)::int as avance
from public.planes_accion p
left join public.empresas e on e.id = p.id_empresa
left join public.compromisos c on c.id_plan = p.id
left join public.directorio() r on r.id = p.id_responsable
group by p.id, e.nombre, r.nombre;

-- 5f. Línea de tiempo de la Ficha 360°: + planes de acción; eventos por la empresa de la inscripción
create or replace view public.historial_empresa with (security_invoker = true) as
select a.id_empresa, 'atencion'::text as tipo, (a.fecha::timestamp at time zone 'America/Bogota') as fecha,
       a.tipo_actividad as titulo, a.notas as detalle, null::text as estado, a.id as id_registro
from public.atenciones a
where not (a.tipo_actividad = 'Proyectos de aula'
           and exists (select 1 from public.proyectos_aula p where p.id_empresa = a.id_empresa and p.semestre = a.semestre))
union all
select p.id_empresa, 'proyecto_aula', coalesce(p.fecha_inicio::timestamp at time zone 'America/Bogota', p.creado_en),
       coalesce(asig.nombre, 'Proyecto de aula') || ' · ' || p.semestre,
       coalesce(p.resultados, p.area_intervenida, p.descripcion), p.estado::text, p.id
from public.proyectos_aula p
left join public.asignaturas asig on asig.id = p.id_asignatura
union all
select c.id_empresa, 'cita', coalesce(c.fecha_hora, c.creado_en), c.motivo, c.notas, c.estado, c.id
from public.citas c
union all
select d.id_empresa, 'diagnostico', d.fecha::timestamp at time zone 'America/Bogota', 'Diagnóstico de madurez',
       'Promedio ' || d.promedio || ' / 5' || coalesce(' · ' || d.tipo_iniciativa, ''), d.nivel, d.id
from public.diagnosticos d
union all
select i.id_empresa, 'evento', ev.fecha, ev.nombre, ev.tipo, 'Asistió', i.id
from public.inscripciones_eventos i
join public.eventos ev on ev.id = i.id_evento
where i.asistio and i.id_empresa is not null
union all
select pl.id_empresa, 'plan_accion', pl.fecha_inicio::timestamp at time zone 'America/Bogota', pl.titulo,
       coalesce((select round(avg(c.avance)) from public.compromisos c
                 where c.id_plan = pl.id and c.estado <> 'Cancelado'), 0) || '% de avance'
         || coalesce(' · vence el ' || to_char(pl.fecha_limite, 'DD/MM/YYYY'), ''),
       pl.estado, pl.id
from public.planes_accion pl;

-- ---------------------------------------------------------------------
-- 6. Datos iniciales de gamificación
-- ---------------------------------------------------------------------
insert into public.areas (nombre, descripcion) values
  ('Programación', 'Desarrollo de software, automatización y datos'),
  ('Diseño', 'Marca, experiencia de usuario y piezas gráficas'),
  ('Teoría', 'Investigación, análisis y documentación'),
  ('Negocios', 'Finanzas, mercadeo y modelo de negocio');

insert into public.insignias (nombre, descripcion, id_area, nivel, criterio, meta, roles)
select a.nombre || ' · ' || n.etiqueta,
       n.meta || case when n.meta = 1 then ' aporte validado' else ' aportes validados' end || ' en ' || lower(a.nombre),
       a.id, n.nivel, 'aportes_validados', n.meta, array['estudiante']::public.rol_usuario[]
from public.areas a
cross join (values (1, 'Bronce', 1), (2, 'Plata', 5), (3, 'Oro', 10)) as n (nivel, etiqueta, meta);

insert into public.insignias (nombre, descripcion, nivel, criterio, meta, roles) values
  ('Bienvenida', 'Completaste el recorrido de bienvenida', 1, 'onboarding', 1, null),
  ('Siempre presente', 'Asististe a 3 eventos del CDE', 1, 'eventos_asistidos', 3, null),
  ('Comunidad activa', 'Asististe a 10 eventos del CDE', 2, 'eventos_asistidos', 10, null),
  ('Centenario', 'Acumulaste 100 puntos', 2, 'puntos', 100, null),
  ('Leyenda CDE', 'Acumulaste 500 puntos', 3, 'puntos', 500, null);

-- ---------------------------------------------------------------------
-- 7. Auditoría
-- ---------------------------------------------------------------------
create trigger contactos_empresa_auditoria after insert or update or delete on public.contactos_empresa
  for each row execute function public.auditar();
create trigger ingresos_empresa_auditoria after insert or update or delete on public.ingresos_empresa
  for each row execute function public.auditar();
create trigger planes_accion_auditoria after insert or update or delete on public.planes_accion
  for each row execute function public.auditar();
create trigger compromisos_auditoria after insert or update or delete on public.compromisos
  for each row execute function public.auditar();
create trigger aportes_auditoria after insert or update or delete on public.aportes
  for each row execute function public.auditar();
create trigger recompensas_auditoria after insert or update or delete on public.recompensas
  for each row execute function public.auditar();
create trigger canjes_auditoria after insert or update or delete on public.canjes
  for each row execute function public.auditar();

-- ---------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------
alter table public.contactos_empresa   enable row level security;
alter table public.ingresos_empresa    enable row level security;
alter table public.planes_accion       enable row level security;
alter table public.compromisos         enable row level security;
alter table public.areas               enable row level security;
alter table public.aportes             enable row level security;
alter table public.insignias           enable row level security;
alter table public.insignias_usuario   enable row level security;
alter table public.puntos_movimientos  enable row level security;
alter table public.recompensas         enable row level security;
alter table public.canjes              enable row level security;
alter table public.progreso_onboarding enable row level security;
alter table public.notificaciones      enable row level security;
alter table public.canales             enable row level security;
alter table public.mensajes            enable row level security;

-- CDE: acceso total; candado de acceso aprobado en todas
do $$
declare t text;
begin
  foreach t in array array['contactos_empresa', 'ingresos_empresa', 'planes_accion', 'compromisos', 'areas',
                           'aportes', 'insignias', 'insignias_usuario', 'puntos_movimientos', 'recompensas',
                           'canjes', 'progreso_onboarding', 'notificaciones', 'canales', 'mensajes']
  loop
    execute format('create policy cde_todo on public.%I for all to authenticated
                      using (public.es_cde()) with check (public.es_cde())', t);
    execute format('create policy solo_acceso_aprobado on public.%I as restrictive for all to authenticated
                      using (public.acceso_aprobado()) with check (public.acceso_aprobado())', t);
  end loop;
end
$$;

-- Contactos: el emprendedor ve y gestiona los de su empresa; enlazar una cuenta (id_perfil) es solo del CDE
create policy emprendedor_lee_sus_contactos on public.contactos_empresa
  for select to authenticated using (id_empresa in (select public.mis_empresas()));
create policy emprendedor_agrega_contactos on public.contactos_empresa
  for insert to authenticated with check (id_empresa in (select public.mis_empresas()) and id_perfil is null);
create policy emprendedor_edita_contactos on public.contactos_empresa
  for update to authenticated
  using (id_empresa in (select public.mis_empresas()) and id_perfil is null)
  with check (id_empresa in (select public.mis_empresas()) and id_perfil is null);
create policy emprendedor_borra_contactos on public.contactos_empresa
  for delete to authenticated using (id_empresa in (select public.mis_empresas()) and id_perfil is null);

-- Ingresos: dato sensible; solo la empresa y el CDE. La empresa reporta, el CDE verifica.
create policy emprendedor_lee_sus_ingresos on public.ingresos_empresa
  for select to authenticated using (id_empresa in (select public.mis_empresas()));
create policy emprendedor_reporta_ingresos on public.ingresos_empresa
  for insert to authenticated
  with check (id_empresa in (select public.mis_empresas()) and fuente = 'Reportado por la empresa');
create policy emprendedor_corrige_ingresos on public.ingresos_empresa
  for update to authenticated
  using (id_empresa in (select public.mis_empresas()) and fuente = 'Reportado por la empresa')
  with check (id_empresa in (select public.mis_empresas()) and fuente = 'Reportado por la empresa');

-- Planes y compromisos
create policy involucrados_leen_planes on public.planes_accion
  for select to authenticated using (id in (select public.planes_visibles()));
create policy responsable_actualiza_plan on public.planes_accion
  for update to authenticated
  using (id_responsable = (select auth.uid())) with check (id_responsable = (select auth.uid()));
create policy involucrados_leen_compromisos on public.compromisos
  for select to authenticated using (id_plan in (select public.planes_visibles()));
create policy responsable_reporta_avance on public.compromisos
  for update to authenticated
  using (id in (select public.compromisos_editables())) with check (id in (select public.compromisos_editables()));

-- Catálogos de gamificación: los ve cualquier usuario aprobado
create policy autenticados_leen_areas on public.areas
  for select to authenticated using (true);
create policy autenticados_leen_recompensas on public.recompensas
  for select to authenticated using (activa);
create policy usuarios_leen_insignias on public.insignias
  for select to authenticated
  using (roles is null or public.rol_actual() = any (roles)
         or id in (select id_insignia from public.insignias_usuario where id_usuario = (select auth.uid())));

-- Aportes
create policy estudiante_lee_aportes_de_su_proyecto on public.aportes
  for select to authenticated
  using (id_usuario = (select auth.uid()) or id_proyecto in (select public.proyectos_del_estudiante()));
create policy estudiante_registra_aporte on public.aportes
  for insert to authenticated
  with check (id_usuario = (select auth.uid()) and estado = 'Pendiente'
              and id_proyecto in (select public.proyectos_del_estudiante()));
create policy autor_edita_aporte_pendiente on public.aportes
  for update to authenticated
  using (id_usuario = (select auth.uid()) and estado = 'Pendiente')
  with check (id_usuario = (select auth.uid()) and estado = 'Pendiente');
create policy autor_borra_aporte_pendiente on public.aportes
  for delete to authenticated using (id_usuario = (select auth.uid()) and estado = 'Pendiente');
create policy docente_lee_aportes on public.aportes
  for select to authenticated using (id_proyecto in (select public.proyectos_del_docente()));
create policy docente_valida_aportes on public.aportes
  for update to authenticated
  using (id_proyecto in (select public.proyectos_del_docente()) and id_usuario <> (select auth.uid()))
  with check (id_proyecto in (select public.proyectos_del_docente()) and id_usuario <> (select auth.uid()));
create policy emprendedor_lee_aportes_de_su_proyecto on public.aportes
  for select to authenticated
  using (id_proyecto in (select id from public.proyectos_aula where id_empresa in (select public.mis_empresas())));

-- Lo propio: insignias, puntos, canjes y recorrido
create policy usuario_lee_sus_insignias on public.insignias_usuario
  for select to authenticated using (id_usuario = (select auth.uid()));
create policy usuario_lee_sus_puntos on public.puntos_movimientos
  for select to authenticated using (id_usuario = (select auth.uid()));
create policy usuario_lee_sus_canjes on public.canjes
  for select to authenticated using (id_usuario = (select auth.uid()));
create policy usuario_solicita_canje on public.canjes
  for insert to authenticated with check (id_usuario = (select auth.uid()));
create policy usuario_lee_su_recorrido on public.progreso_onboarding
  for select to authenticated using (id_usuario = (select auth.uid()));
create policy usuario_inicia_su_recorrido on public.progreso_onboarding
  for insert to authenticated with check (id_usuario = (select auth.uid()));
create policy usuario_avanza_su_recorrido on public.progreso_onboarding
  for update to authenticated
  using (id_usuario = (select auth.uid())) with check (id_usuario = (select auth.uid()));

-- Notificaciones: cada quien las suyas; solo puede marcarlas como leídas o borrarlas
create policy usuario_lee_sus_notificaciones on public.notificaciones
  for select to authenticated using (id_usuario = (select auth.uid()));
create policy usuario_marca_sus_notificaciones on public.notificaciones
  for update to authenticated
  using (id_usuario = (select auth.uid())) with check (id_usuario = (select auth.uid()));
create policy usuario_borra_sus_notificaciones on public.notificaciones
  for delete to authenticated using (id_usuario = (select auth.uid()));
revoke update on public.notificaciones from authenticated;
grant update (leida_en) on public.notificaciones to authenticated;

-- Canales y mensajes
create policy miembros_leen_canales on public.canales
  for select to authenticated using (public.puede_ver_canal(id));
create policy miembros_leen_mensajes on public.mensajes
  for select to authenticated using (public.puede_ver_canal(id_canal));
create policy miembros_escriben_mensajes on public.mensajes
  for insert to authenticated with check (id_autor = (select auth.uid()) and public.puede_ver_canal(id_canal));
create policy autor_edita_mensaje on public.mensajes
  for update to authenticated using (id_autor = (select auth.uid())) with check (id_autor = (select auth.uid()));
create policy autor_borra_mensaje on public.mensajes
  for delete to authenticated using (id_autor = (select auth.uid()));
revoke update on public.mensajes from authenticated;
grant update (contenido) on public.mensajes to authenticated;

-- Inscripción: el usuario solo asocia empresas que representa
alter policy usuario_se_inscribe on public.inscripciones_eventos
  with check (id_usuario = (select auth.uid()) and asistio = false
              and (id_empresa is null or id_empresa in (select public.mis_empresas())));

-- Chat y notificaciones en tiempo real (Supabase Realtime respeta RLS)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.mensajes, public.notificaciones;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 9. ia_lectura: datos de negocio sí; mensajes, notificaciones y datos de contacto no
-- ---------------------------------------------------------------------
grant select on public.ingresos_empresa, public.planes_accion, public.compromisos, public.areas, public.aportes,
                public.insignias, public.insignias_usuario, public.puntos_movimientos, public.recompensas,
                public.canjes, public.progreso_onboarding to ia_lectura;
grant select (id, id_empresa, id_perfil, nombre, cargo, es_principal, creado_en) on public.contactos_empresa to ia_lectura;
do $$
declare t text;
begin
  foreach t in array array['contactos_empresa', 'ingresos_empresa', 'planes_accion', 'compromisos', 'areas',
                           'aportes', 'insignias', 'insignias_usuario', 'puntos_movimientos', 'recompensas',
                           'canjes', 'progreso_onboarding']
  loop
    execute format('create policy ia_lectura on public.%I for select to ia_lectura using (true)', t);
  end loop;
end
$$;
grant select on public.avance_planes to authenticated;

-- ---------------------------------------------------------------------
-- 10. Permisos de funciones
-- ---------------------------------------------------------------------
-- Funciones de trigger e internas: nadie las llama por la API
do $$
declare f text;
begin
  foreach f in array array['validar_mentor()', 'proteger_compromiso()', 'proteger_plan()', 'preparar_mensaje()',
                           'tras_movimiento_puntos()', 'puntos_por_asistencia()', 'gestionar_aporte()',
                           'puntos_por_aporte()', 'validar_canje()', 'movimiento_canje()', 'puntos_por_onboarding()',
                           'premiar_onboarding()', 'notificar_proyecto()', 'notificar_plan()', 'notificar_compromiso()',
                           'notificar_cita()', 'notificar_mentor()', 'crear_canal_proyecto()', 'preparar_inscripcion()',
                           'otorgar_insignias(uuid)', 'notificar(uuid, text, text, text, text)',
                           'personas_de_empresa(uuid)']
  loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
  -- Ayudantes de RLS y consultas para usuarios con sesión
  foreach f in array array['planes_visibles()', 'compromisos_editables()', 'puede_ver_canal(uuid)',
                           'ranking_puntos(integer)', 'cupos_eventos()']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;
