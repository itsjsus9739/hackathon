-- =====================================================================
-- CDE UNAB · Se retira la recompensa «Pasadía en el coworking del CDE» (pedido del equipo).
-- Si alguien ya la hubiera canjeado, se desactiva en vez de borrarla para no perder el historial.
-- Es seguro repetirla.
-- =====================================================================
update public.recompensas set activa = false
where nombre = 'Pasadía en el coworking del CDE'
  and exists (select 1 from public.canjes c where c.id_recompensa = recompensas.id);

delete from public.recompensas r
where r.nombre = 'Pasadía en el coworking del CDE'
  and not exists (select 1 from public.canjes c where c.id_recompensa = r.id);
