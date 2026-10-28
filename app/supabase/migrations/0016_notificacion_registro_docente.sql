-- =====================================================================
-- CDE UNAB · La notificación de "registro como docente" lleva a quién se refiere,
-- para resolverla desde la campana (confirmar, aprobar/rechazar la solicitud o cambiar el rol).
-- =====================================================================

alter table public.notificaciones add column id_referencia uuid;
comment on column public.notificaciones.id_referencia is 'Registro al que se refiere (p. ej. el perfil del docente que se registró)';

alter table public.notificaciones drop constraint notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check
  check (tipo in ('general', 'proyecto', 'plan', 'compromiso', 'aporte', 'insignia', 'canje', 'cita', 'mentor', 'registro_docente'));

-- Las ya creadas por 0015 (texto con el correo entre paréntesis) pasan al tipo nuevo con su referencia
update public.notificaciones n
set tipo = 'registro_docente', id_referencia = u.id
from auth.users u
where n.tipo = 'general' and n.titulo = 'Confirma un registro como docente'
  and n.cuerpo like '%(' || lower(u.email) || ')%';

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
    insert into public.notificaciones (id_usuario, tipo, titulo, cuerpo, id_referencia)
    select p.id, 'registro_docente', 'Confirma un registro como docente',
           nombre_nuevo || ' (' || lower(new.email) || ') se registró como docente'
           || case when institucional then ' con correo UNAB.' else ' con un correo externo: su solicitud está pendiente.' end,
           new.id
    from public.perfiles p
    where p.rol::text in ('cde', 'admin_cde') and p.estado_acceso = 'aprobado';
  end if;
  return new;
end;
$$;
revoke execute on function public.crear_perfil_nuevo_usuario() from public, anon, authenticated;
