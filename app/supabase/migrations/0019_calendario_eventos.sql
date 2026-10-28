-- =====================================================================
-- CDE UNAB · Calendario de eventos por roles (antes app Flask aparte, ahora sobre eventos)
--   * Tipos nuevos: Cita y Coworking. Públicos (todos los ven y cualquiera se inscribe): Evento,
--     Networking, Feria, Capacitación...; privados (solo organizador, invitados y CDE):
--     Conversatorio, Cita, Coworking.
--   * Quién crea: CDE todo; emprendedor Evento y Networking; docente Conversatorio;
--     todos Cita y Coworking. Edita y borra el organizador (creado_por) o el CDE.
--   * Invitaciones: el organizador invita (estado 'pendiente') y el invitado responde
--     Asistiré ('confirmado') / No asistiré ('rechazado'). Cada invitación genera una notificación.
-- =====================================================================

alter table public.eventos
  add column fin timestamptz,
  add column creado_por uuid references public.perfiles (id) on delete set null default auth.uid(),
  add column es_ejemplo boolean not null default false;
alter table public.eventos add constraint eventos_fin_check check (fin is null or fin > fecha);
alter table public.eventos drop constraint eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check check (tipo in (
  'Evento', 'Capacitación', 'Ruta de acompañamiento', 'Sesión empresarial', 'Conversatorio', 'Networking', 'Feria',
  'Cita', 'Coworking'));
create index eventos_creado_por_idx on public.eventos (creado_por);
create index eventos_fecha_idx on public.eventos (fecha);

alter table public.inscripciones_eventos
  add column estado text not null default 'confirmado' check (estado in ('pendiente', 'confirmado', 'rechazado')),
  add column invitado_por uuid references public.perfiles (id) on delete set null;

alter table public.notificaciones drop constraint notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check check (tipo in (
  'general', 'proyecto', 'plan', 'compromiso', 'aporte', 'insignia', 'canje', 'cita', 'mentor', 'registro_docente', 'evento'));

-- ---------------------------------------------------------------------
-- Reglas (una sola fuente de verdad; src/lib/eventos.ts las replica para la interfaz)
-- ---------------------------------------------------------------------
create or replace function public.tipo_evento_publico(tipo text)
returns boolean
language sql immutable set search_path = ''
as $$
  select tipo not in ('Conversatorio', 'Cita', 'Coworking');
$$;

create or replace function public.puede_crear_tipo_evento(tipo text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_cde() or exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.estado_acceso = 'aprobado'
      and case tipo
            when 'Evento' then p.rol::text = 'emprendedor'
            when 'Networking' then p.rol::text = 'emprendedor'
            when 'Conversatorio' then p.rol::text = 'docente'
            when 'Cita' then true
            when 'Coworking' then true
            else false
          end);
$$;

create or replace function public.organiza_evento(ev uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.eventos where id = ev and creado_por = auth.uid());
$$;

create or replace function public.evento_publico(ev uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.eventos where id = ev and public.tipo_evento_publico(tipo));
$$;

create or replace function public.invitado_a_evento(ev uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.inscripciones_eventos where id_evento = ev and id_usuario = auth.uid());
$$;

create or replace function public.puede_ver_evento(ev uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_cde() or exists (
    select 1 from public.eventos e
    where e.id = ev
      and (public.tipo_evento_publico(e.tipo)
           or e.creado_por = auth.uid()
           or exists (select 1 from public.inscripciones_eventos i where i.id_evento = e.id and i.id_usuario = auth.uid())));
$$;

/** Personas de la comunidad aprobadas (solo nombre y rol) para invitar y mostrar asistentes. */
create or replace function public.personas_comunidad()
returns table (id uuid, nombre text, rol public.rol_usuario)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.nombre, p.rol from public.perfiles p
  where public.acceso_aprobado() and p.estado_acceso = 'aprobado'
  order by p.nombre;
$$;

-- Fuera del CDE nadie fija puntos ni enlaza el cronograma, ni cambia al organizador
create or replace function public.proteger_evento()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if public.es_cde() or auth.uid() is null then
    if tg_op = 'INSERT' then new.creado_por := coalesce(new.creado_por, auth.uid()); end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
    new.puntos_gamificacion := 0;
    new.id_actividad_cronograma := null;
    new.es_ejemplo := false;
  else
    new.creado_por := old.creado_por;
    new.puntos_gamificacion := old.puntos_gamificacion;
    new.id_actividad_cronograma := old.id_actividad_cronograma;
    new.es_ejemplo := old.es_ejemplo;
  end if;
  return new;
end;
$$;
create trigger eventos_proteger before insert or update on public.eventos
  for each row execute function public.proteger_evento();

-- Cupo: cuentan las inscripciones que no fueron rechazadas
create or replace function public.preparar_inscripcion()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  cupo_evento integer;
begin
  if tg_op = 'UPDATE' and not (old.estado = 'rechazado' and new.estado <> 'rechazado') then
    return new;
  end if;
  select cupo into cupo_evento from public.eventos where id = new.id_evento for update;  -- serializa inscripciones
  if cupo_evento is not null and new.estado <> 'rechazado'
     and (select count(*) from public.inscripciones_eventos
          where id_evento = new.id_evento and estado <> 'rechazado' and id <> new.id) >= cupo_evento then
    raise exception 'El evento no tiene cupos disponibles';
  end if;

  if tg_op = 'UPDATE' then
    return new;
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
create trigger inscripciones_cupo_respuesta before update of estado on public.inscripciones_eventos
  for each row execute function public.preparar_inscripcion();

-- El invitado solo cambia su respuesta (la asistencia real la marca el CDE)
create or replace function public.proteger_inscripcion()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if public.es_cde() or auth.uid() is null then
    return new;
  end if;
  new.id_evento := old.id_evento;
  new.id_usuario := old.id_usuario;
  new.id_empresa := old.id_empresa;
  new.asistio := old.asistio;
  new.invitado_por := old.invitado_por;
  new.inscrito_en := old.inscrito_en;
  return new;
end;
$$;
create trigger inscripciones_proteger before update on public.inscripciones_eventos
  for each row execute function public.proteger_inscripcion();

-- Aviso en la campana a cada invitado
create or replace function public.avisar_invitacion_evento()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  ev record;
begin
  if new.estado <> 'pendiente' then
    return null;
  end if;
  select nombre, tipo, fecha into ev from public.eventos where id = new.id_evento;
  perform public.notificar(new.id_usuario, 'evento', 'Te invitaron: ' || ev.nombre,
    ev.tipo || ' · ' || to_char(ev.fecha at time zone 'America/Bogota', 'DD/MM/YYYY HH24:MI')
      || '. Responde Asistiré o No asistiré en el calendario.',
    '/eventos?e=' || new.id_evento);
  return null;
end;
$$;
create trigger inscripciones_aviso after insert on public.inscripciones_eventos
  for each row execute function public.avisar_invitacion_evento();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
drop policy autenticados_leen_eventos on public.eventos;
-- Con las columnas de la fila (no con puede_ver_evento): así insert ... returning ve la fila recién creada
create policy ven_eventos on public.eventos for select to authenticated
  using (public.tipo_evento_publico(tipo) or creado_por = (select auth.uid()) or public.es_cde() or public.invitado_a_evento(id));
create policy crean_eventos on public.eventos for insert to authenticated
  with check (creado_por = (select auth.uid()) and public.puede_crear_tipo_evento(tipo));
create policy organizador_edita_evento on public.eventos for update to authenticated
  using (creado_por = (select auth.uid()))
  with check (creado_por = (select auth.uid()) and public.puede_crear_tipo_evento(tipo));
create policy organizador_borra_evento on public.eventos for delete to authenticated
  using (creado_por = (select auth.uid()));

drop policy usuario_lee_sus_inscripciones on public.inscripciones_eventos;
create policy ven_asistentes on public.inscripciones_eventos for select to authenticated
  using (id_usuario = (select auth.uid()) or public.puede_ver_evento(id_evento));

-- Inscribirse uno mismo: solo en eventos públicos (a los privados se entra por invitación)
drop policy usuario_se_inscribe on public.inscripciones_eventos;
create policy usuario_se_inscribe on public.inscripciones_eventos for insert to authenticated
  with check (id_usuario = (select auth.uid()) and asistio = false and estado <> 'pendiente'
              and public.evento_publico(id_evento)
              and (id_empresa is null or id_empresa in (select public.mis_empresas())));
create policy organizador_invita on public.inscripciones_eventos for insert to authenticated
  with check (public.organiza_evento(id_evento) and asistio = false and estado = 'pendiente'
              and invitado_por = (select auth.uid()) and id_usuario <> (select auth.uid()));
create policy usuario_responde on public.inscripciones_eventos for update to authenticated
  using (id_usuario = (select auth.uid())) with check (id_usuario = (select auth.uid()));
create policy organizador_quita_invitado on public.inscripciones_eventos for delete to authenticated
  using (public.organiza_evento(id_evento) and asistio = false);

-- Los rechazos no cuentan como inscritos
create or replace function public.cupos_eventos()
returns table (id_evento uuid, cupo integer, inscritos bigint, disponibles integer)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.cupo, count(i.id),
         case when e.cupo is null then null else greatest(e.cupo - count(i.id), 0)::int end
  from public.eventos e
  left join public.inscripciones_eventos i on i.id_evento = e.id and i.estado <> 'rechazado'
  where public.acceso_aprobado()
  group by e.id;
$$;

create or replace view public.asistencia_eventos with (security_invoker = true) as
select e.id, e.nombre, e.fecha,
       count(i.id) as inscritos,
       count(i.id) filter (where i.asistio) as asistentes,
       round(100.0 * count(i.id) filter (where i.asistio) / nullif(count(i.id), 0), 1) as tasa_asistencia
from public.eventos e
left join public.inscripciones_eventos i on i.id_evento = e.id and i.estado <> 'rechazado'
group by e.id;

revoke execute on function public.puede_crear_tipo_evento(text), public.organiza_evento(uuid), public.evento_publico(uuid),
  public.puede_ver_evento(uuid), public.invitado_a_evento(uuid), public.personas_comunidad() from public, anon;
grant execute on function public.puede_crear_tipo_evento(text), public.organiza_evento(uuid), public.evento_publico(uuid),
  public.puede_ver_evento(uuid), public.invitado_a_evento(uuid), public.personas_comunidad() to authenticated;
revoke execute on function public.proteger_evento(), public.proteger_inscripcion(), public.avisar_invitacion_evento()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Actividades de ejemplo (es_ejemplo = true), organizadas por el primer administrador del CDE
-- ---------------------------------------------------------------------
insert into public.eventos (nombre, tipo, fecha, fin, lugar, descripcion, cupo, puntos_gamificacion, creado_por, es_ejemplo)
select v.nombre, v.tipo,
       ((date '2026-10-26' + v.dia) + v.hora) at time zone 'America/Bogota',
       ((date '2026-10-26' + v.dia) + v.hora + v.duracion) at time zone 'America/Bogota',
       v.lugar, v.descripcion, v.cupo, v.puntos, a.id, true
from (select id from public.perfiles where rol::text = 'admin_cde' order by creado_en limit 1) a
cross join (values
  ('UNAB Venture Challenge', 'Evento', 2, time '08:00', interval '10 hours', 'Campus El Jardín · UNAB',
   'Hackathon de emprendimiento: retos reales del CDE y premiación.', null, 50),
  ('Feria de Emprendimiento UNAB', 'Feria', 9, time '09:00', interval '4 hours', 'Plazoleta central',
   'Muestra de emprendimientos de la comunidad UNAB.', 80, 30),
  ('Café de networking: agroindustria', 'Networking', 3, time '16:00', interval '2 hours', 'CDE · Sala 2',
   'Conecta con empresas del sector agro de Santander.', 30, 20),
  ('Rueda de negocios Santander', 'Networking', 14, time '14:00', interval '3 hours', 'Centro de Convenciones Neomundo',
   'Encuentro entre emprendedores e inversionistas.', 60, 30),
  ('Taller: flujo de caja para pymes', 'Capacitación', 7, time '10:00', interval '2 hours', 'Auditorio Mayor',
   'Construye el flujo de caja mensual de tu negocio.', 40, 25),
  ('Conversatorio: formalización empresarial', 'Conversatorio', 10, time '10:00', interval '2 hours', 'Auditorio Menor',
   'Registro mercantil, RUT y facturación electrónica, con docentes de la UNAB.', null, 15),
  ('Coworking del equipo CDE', 'Coworking', 4, time '08:00', interval '3 hours', 'Coworking virtual · Sala principal',
   'Trabajo en equipo sobre los planes de acción.', null, 0),
  ('Asesoría plan de negocio', 'Cita', 1, time '14:00', interval '1 hour', 'CDE · Oficina 3',
   'Revisión del modelo Canvas.', null, 0)
) as v(nombre, tipo, dia, hora, duracion, lugar, descripcion, cupo, puntos);
