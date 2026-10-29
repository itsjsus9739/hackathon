-- =====================================================================
-- CDE UNAB · Gamificación: correcciones de la revisión
--   1. «Puntos ganados» (nivel, ranking e insignia por puntos) = todo menos los canjes.
--      Antes solo sumaban los movimientos positivos, así que un ajuste negativo del CDE
--      (p. ej. corregir puntos dados por error) bajaba el saldo pero no el nivel ni el ranking.
--      Canjear sigue sin bajar de nivel.
--   2. Un canje ya resuelto (Entregado o Rechazado) no cambia de estado: antes se podía
--      pasar de Entregado a Rechazado y devolver los puntos de algo ya entregado.
--
-- Es seguro repetirla.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Puntos ganados
-- ---------------------------------------------------------------------
create or replace view public.puntos_usuario with (security_invoker = true) as
select m.id_usuario,
       greatest(coalesce(sum(m.puntos) filter (where m.origen_tipo <> 'canje'), 0), 0)::int as puntos,
       (select count(*) from public.inscripciones_eventos i where i.id_usuario = m.id_usuario and i.asistio) as eventos_asistidos,
       coalesce(sum(m.puntos), 0)::int as saldo,
       (select count(*) from public.insignias_usuario iu where iu.id_usuario = m.id_usuario) as insignias
from public.puntos_movimientos m
group by m.id_usuario;

create or replace function public.ranking_puntos(limite integer default 10)
returns table (posicion bigint, id uuid, nombre text, rol public.rol_usuario, puntos integer, insignias bigint)
language sql stable security definer set search_path = ''
as $$
  select rank() over (order by t.puntos desc), p.id, p.nombre, p.rol, t.puntos,
         (select count(*) from public.insignias_usuario iu where iu.id_usuario = p.id)
  from (select id_usuario, sum(puntos)::int as puntos from public.puntos_movimientos
        where origen_tipo <> 'canje' group by id_usuario having sum(puntos) > 0) t
  join public.perfiles p on p.id = t.id_usuario
  where public.acceso_aprobado()
    and p.id in (select public.circulo_gamificacion())
  order by t.puntos desc
  limit least(greatest(limite, 1), 100);
$$;

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
               where m.id_usuario = usuario and m.origen_tipo <> 'canje') >= i.meta
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

-- ---------------------------------------------------------------------
-- 2. Canjes: solo se resuelve uno que esté Solicitado
-- ---------------------------------------------------------------------
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
    if old.estado <> 'Solicitado' and new.estado is distinct from old.estado then
      raise exception 'Un canje ya resuelto no se reabre ni cambia de estado: el usuario debe solicitarlo de nuevo';
    end if;
    if new.estado is distinct from old.estado then
      new.resuelto_por := auth.uid();
      new.resuelto_en := now();
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.otorgar_insignias(uuid) from public, anon, authenticated;
revoke execute on function public.validar_canje() from public, anon, authenticated;
revoke execute on function public.ranking_puntos(integer) from public, anon;
grant execute on function public.ranking_puntos(integer) to authenticated;
