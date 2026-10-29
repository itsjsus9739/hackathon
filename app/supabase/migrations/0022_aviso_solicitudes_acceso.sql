-- =====================================================================
-- CDE UNAB · Aviso al CDE de toda solicitud de acceso con correo externo
--   Antes solo se avisaba cuando alguien se registraba como docente: las solicitudes externas de
--   emprendedores y estudiantes quedaban pendientes sin que el CDE se enterara.
--   Ahora cada una crea una notificación 'solicitud_acceso' (con la persona en id_referencia) para los
--   miembros y admins del CDE, que la aprueban o rechazan desde la campana.
-- =====================================================================

alter table public.notificaciones drop constraint notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check check (tipo in (
  'general', 'proyecto', 'plan', 'compromiso', 'aporte', 'insignia', 'canje', 'cita', 'mentor', 'registro_docente', 'evento',
  'solicitud_acceso'));

create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  institucional boolean := public.es_correo_institucional(new.email);
  rol_pedido text := new.raw_user_meta_data ->> 'rol_solicitado';
  rol_valido text := case when rol_pedido in ('emprendedor', 'docente', 'estudiante') then rol_pedido else 'emprendedor' end;
  nombre_nuevo text := coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1));
  motivo_nuevo text := nullif(trim(left(new.raw_user_meta_data ->> 'motivo', 2000)), '');
begin
  insert into public.perfiles (id, nombre, rol, estado_acceso)
  values (new.id, nombre_nuevo, rol_valido::public.rol_usuario,
          (case when institucional and new.email_confirmed_at is not null then 'aprobado' else 'pendiente' end)::public.estado_acceso);

  if not institucional then
    insert into public.solicitudes_acceso (id_perfil, correo, rol_solicitado, motivo)
    values (new.id, lower(new.email), rol_valido::public.rol_usuario, motivo_nuevo);
  end if;

  -- Docente (con cualquier correo): confirmar el rol. Externo con otro rol: aprobar o rechazar el acceso.
  if rol_valido = 'docente' or not institucional then
    insert into public.notificaciones (id_usuario, tipo, titulo, cuerpo, id_referencia)
    select p.id,
           case when rol_valido = 'docente' then 'registro_docente' else 'solicitud_acceso' end,
           case when rol_valido = 'docente' then 'Confirma un registro como docente' else 'Nueva solicitud de acceso' end,
           nombre_nuevo || ' (' || lower(new.email) || ')'
           || case when rol_valido = 'docente'
                   then ' se registró como docente'
                        || case when institucional then ' con correo UNAB.' else ' con un correo externo: su solicitud está pendiente.' end
                   else ' pide acceso como ' || rol_valido || ' con un correo externo.' end
           || coalesce(' Motivo: «' || left(motivo_nuevo, 300) || '»', ''),
           new.id
    from public.perfiles p
    where p.rol::text in ('cde', 'admin_cde') and p.estado_acceso = 'aprobado';
  end if;
  return new;
end;
$$;
revoke execute on function public.crear_perfil_nuevo_usuario() from public, anon, authenticated;

-- Solicitudes que ya estaban pendientes sin aviso: se crea ahora
insert into public.notificaciones (id_usuario, tipo, titulo, cuerpo, id_referencia)
select cde.id, 'solicitud_acceso', 'Nueva solicitud de acceso',
       coalesce(pf.nombre, s.correo) || ' (' || s.correo || ') pide acceso como ' || s.rol_solicitado::text || ' con un correo externo.'
       || coalesce(' Motivo: «' || left(nullif(trim(s.motivo), ''), 300) || '»', ''),
       s.id_perfil
from public.solicitudes_acceso s
join public.perfiles pf on pf.id = s.id_perfil
cross join public.perfiles cde
where s.estado = 'pendiente'
  and cde.rol::text in ('cde', 'admin_cde') and cde.estado_acceso = 'aprobado'
  and not exists (select 1 from public.notificaciones n where n.id_referencia = s.id_perfil and n.id_usuario = cde.id);
