-- =====================================================================
-- CDE UNAB · Cada quien queda con el rol que pide y el CDE confirma a los docentes
--   * Rol al registrarse = el pedido (emprendedor, docente o estudiante), con cualquier correo.
--     Nunca un rol del CDE. El acceso sigue la regla de 0008: @unab.edu.co confirmado → aprobado;
--     otro correo → pendiente hasta que el CDE apruebe la solicitud.
--   * Registro como docente → notificación en la app a todos los miembros y admins del CDE
--     (el correo electrónico lo envía el servidor de la app con correos_cde()).
-- =====================================================================

create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  institucional boolean := public.es_correo_institucional(new.email);
  rol_pedido text := new.raw_user_meta_data ->> 'rol_solicitado';
  rol_valido text := case when rol_pedido in ('emprendedor', 'docente', 'estudiante') then rol_pedido else 'emprendedor' end;
  nombre_nuevo text := coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1));
begin
  insert into public.perfiles (id, nombre, rol, estado_acceso)
  values (new.id, nombre_nuevo, rol_valido::public.rol_usuario,
          (case when institucional and new.email_confirmed_at is not null then 'aprobado' else 'pendiente' end)::public.estado_acceso);

  if not institucional then
    insert into public.solicitudes_acceso (id_perfil, correo, rol_solicitado, motivo)
    values (new.id, lower(new.email), rol_valido::public.rol_usuario, left(new.raw_user_meta_data ->> 'motivo', 2000));
  end if;

  if rol_valido = 'docente' then
    insert into public.notificaciones (id_usuario, tipo, titulo, cuerpo)
    select p.id, 'general', 'Confirma un registro como docente',
           nombre_nuevo || ' (' || lower(new.email) || ') se registró como docente'
           || case when institucional then ' con correo UNAB.' else ' con un correo externo: su solicitud está pendiente.' end
           || ' Si no es docente, cambia su rol.'
    from public.perfiles p
    where p.rol::text in ('cde', 'admin_cde') and p.estado_acceso = 'aprobado';
  end if;
  return new;
end;
$$;
revoke execute on function public.crear_perfil_nuevo_usuario() from public, anon, authenticated;

-- Externos ya registrados: su perfil pendiente toma el rol que pidieron en la solicitud
update public.perfiles p
set rol = s.rol_solicitado
from public.solicitudes_acceso s
where s.id_perfil = p.id and p.estado_acceso = 'pendiente' and p.rol::text = 'emprendedor'
  and s.rol_solicitado::text in ('docente', 'estudiante');

-- Correos de los miembros y admins del CDE (viven en auth.users). Solo el servidor (service_role) la usa.
create or replace function public.correos_cde()
returns table (correo text, nombre text)
language sql stable security definer set search_path = ''
as $$
  select u.email::text, p.nombre
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.rol::text in ('cde', 'admin_cde') and p.estado_acceso = 'aprobado' and u.email is not null;
$$;
revoke execute on function public.correos_cde() from public, anon, authenticated;
grant execute on function public.correos_cde() to service_role;
