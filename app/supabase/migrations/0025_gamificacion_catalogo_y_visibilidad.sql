-- =====================================================================
-- CDE UNAB · Gamificación: catálogo, visibilidad y ranking
--   (parte de la propuesta 0013_gamificacion_catalogo_y_visibilidad del equipo de diseño)
--
--   1. Recompensas iniciales (catálogo PROPUESTO; la UNAB lo aprueba)
--   2. Insignias para los roles que no son estudiante
--   3. Círculo de gamificación: el directorio, pero un emprendedor nunca ve a otros
--      emprendedores (el directorio sí los incluye si escribieron en el foro abierto)
--   4. Insignias visibles entre personas del círculo
--   5. Ranking limitado al círculo (el CDE ve a todos)
--   6. Aviso al recibir una insignia que otorga el CDE (las automáticas ya avisan)
--
-- Es seguro repetirla: no duplica recompensas ni insignias.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Recompensas (la tabla no tiene columna de rol: el público objetivo
--    va al inicio de la descripción como «Para: ...»; la app lo lee)
-- ---------------------------------------------------------------------
insert into public.recompensas (nombre, descripcion, costo_puntos, stock)
select v.nombre, v.descripcion, v.costo, v.stock
from (values
  ('Certificado digital de participación',
   'Para: todos. Certificado del CDE con tus logros del semestre.', 100, null::integer),
  ('Descuento en la Tienda UNAB',
   'Para: todos. 10 % de descuento en artículos de la Tienda UNAB.', 150, 100),
  ('Mentoría adicional de 1 hora',
   'Para: emprendedores. Una hora extra con una persona asesora del CDE.', 200, 20),
  ('Pasadía en el coworking del CDE',
   'Para: emprendedores. Un día de acceso al espacio de coworking.', 300, 10),
  ('Media jornada libre',
   'Para: docentes y equipo del CDE. Media jornada por aportes destacados.', 400, 5),
  ('Bonificación en la nota de la asignatura',
   'Para: estudiantes. Décimas adicionales, sujetas a la aprobación del docente.', 500, null::integer)
) as v (nombre, descripcion, costo, stock)
where not exists (select 1 from public.recompensas r where r.nombre = v.nombre);

-- ---------------------------------------------------------------------
-- 2. Insignias para docentes, emprendedores y equipo del CDE
--    «manual» = la otorga el CDE desde su panel
-- ---------------------------------------------------------------------
insert into public.insignias (nombre, descripcion, nivel, criterio, meta, roles) values
  ('Primer evento', 'Asististe a tu primer evento del CDE', 1, 'eventos_asistidos', 1, null),
  ('Emprendedor constante', 'Asististe a 5 eventos del CDE', 2, 'eventos_asistidos', 5,
     array['emprendedor']::public.rol_usuario[]),
  ('Capacitado', 'Completaste una capacitación del CDE (la otorga el CDE)', 1, 'manual', 1, null),
  ('Docente guía', 'Reconocimiento del CDE por guiar proyectos de aula con impacto', 3, 'manual', 1,
     array['docente']::public.rol_usuario[]),
  ('Mentor destacado', 'Reconocimiento por acompañar emprendimientos', 3, 'manual', 1,
     array['cde', 'admin_cde']::public.rol_usuario[])
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------
-- 3. Círculo: personas cuyos puntos e insignias puedo ver.
--    directorio() también incluye a quien escribió en el foro abierto de coworking,
--    así que un emprendedor vería ahí a otros emprendedores: se excluyen.
-- ---------------------------------------------------------------------
create or replace function public.circulo_gamificacion()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select d.id
  from public.directorio() d
  where d.id = auth.uid()
     or public.rol_actual() is distinct from 'emprendedor'
     or d.rol <> 'emprendedor';
$$;

-- ---------------------------------------------------------------------
-- 4. Insignias públicas dentro del círculo (compañeros de proyecto, docentes, mentor)
-- ---------------------------------------------------------------------
drop policy if exists circulo_lee_insignias on public.insignias_usuario;
create policy circulo_lee_insignias on public.insignias_usuario
  for select to authenticated
  using (id_usuario in (select public.circulo_gamificacion()));

-- El catálogo muestra también las insignias que ya tiene alguien de mi círculo
-- (p. ej. un estudiante ve «Programación · Oro» de un compañero). La subconsulta respeta RLS.
alter policy usuarios_leen_insignias on public.insignias
  using (roles is null or public.rol_actual() = any (roles)
         or id in (select id_insignia from public.insignias_usuario));

-- ---------------------------------------------------------------------
-- 5. Ranking: antes devolvía a TODOS los usuarios con puntos.
--    Mismas columnas y permisos que la versión anterior.
-- ---------------------------------------------------------------------
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
    and p.id in (select public.circulo_gamificacion())
  order by t.puntos desc
  limit least(greatest(limite, 1), 100);
$$;

-- ---------------------------------------------------------------------
-- 6. Insignia otorgada por el CDE → aviso (las automáticas llegan con otorgada_por null
--    y ya las notifica otorgar_insignias)
-- ---------------------------------------------------------------------
create or replace function public.notificar_insignia_manual()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.otorgada_por is not null then
    perform public.notificar(new.id_usuario, 'insignia', '¡Ganaste una insignia!',
      (select nombre from public.insignias where id = new.id_insignia), '/formacion');
  end if;
  return null;
end;
$$;
drop trigger if exists insignias_usuario_notificar on public.insignias_usuario;
create trigger insignias_usuario_notificar after insert on public.insignias_usuario
  for each row execute function public.notificar_insignia_manual();

revoke execute on function public.notificar_insignia_manual() from public, anon, authenticated;
revoke execute on function public.circulo_gamificacion() from public, anon;
grant execute on function public.circulo_gamificacion() to authenticated;

-- ---------------------------------------------------------------------
-- PRUEBAS (con cada cuenta de demo)
--   select count(*) from public.insignias;       -- 22 (17 + 5)
--   select count(*) from public.recompensas;     -- 6
--   -- con sesión de un emprendedor: no deben aparecer otros emprendedores
--   select * from public.ranking_puntos(10);
--
-- (OPCIONAL, SOLO PARA LA DEMO) Dar puntos a una cuenta de prueba (id de la tabla perfiles).
-- Al pasar de 100 puntos la base otorga sola la insignia «Centenario».
--   insert into public.puntos_movimientos (id_usuario, puntos, motivo, origen_tipo)
--   values ('00000000-0000-0000-0000-000000000000', 120, 'Puntos de demostración', 'ajuste');
-- ---------------------------------------------------------------------
