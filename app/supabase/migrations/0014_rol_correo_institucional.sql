-- =====================================================================
-- CDE UNAB · Con correo @unab.edu.co se respeta el rol elegido al registrarse
--   Antes: el institucional se aprobaba al confirmar el correo, pero siempre como 'emprendedor'
--   (el rol pedido solo se usaba en la solicitud de los correos externos).
--   Ahora: institucional → emprendedor, docente o estudiante según lo que eligió; nunca un rol del CDE
--   (esos los asigna un administrador). Un docente solo ve los proyectos y asignaturas que el CDE le asigne.
-- =====================================================================

create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  institucional boolean := public.es_correo_institucional(new.email);
  rol_pedido text := new.raw_user_meta_data ->> 'rol_solicitado';
  rol_valido text := case when rol_pedido in ('emprendedor', 'docente', 'estudiante') then rol_pedido else 'emprendedor' end;
begin
  insert into public.perfiles (id, nombre, rol, estado_acceso)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
          -- Externo: arranca como emprendedor y el rol pedido se aplica cuando el CDE aprueba la solicitud
          (case when institucional then rol_valido else 'emprendedor' end)::public.rol_usuario,
          (case when institucional and new.email_confirmed_at is not null then 'aprobado' else 'pendiente' end)::public.estado_acceso);

  if not institucional then
    insert into public.solicitudes_acceso (id_perfil, correo, rol_solicitado, motivo)
    values (new.id, lower(new.email), rol_valido::public.rol_usuario, left(new.raw_user_meta_data ->> 'motivo', 2000));
  end if;
  return new;
end;
$$;
revoke execute on function public.crear_perfil_nuevo_usuario() from public, anon, authenticated;

-- Cuentas institucionales ya creadas que quedaron como emprendedor habiendo pedido docente o estudiante
update public.perfiles p
set rol = (u.raw_user_meta_data ->> 'rol_solicitado')::public.rol_usuario
from auth.users u
where u.id = p.id
  and public.es_correo_institucional(u.email)
  and p.rol = 'emprendedor'
  and u.raw_user_meta_data ->> 'rol_solicitado' in ('docente', 'estudiante');
