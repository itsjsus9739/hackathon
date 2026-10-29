-- =====================================================================
-- CDE UNAB · Sectores para todos y unirse a una empresa existente
--
--   1. El catálogo de sectores solo lo podía leer el CDE (0001): al emprendedor, docente y
--      estudiante la lista les llegaba vacía y el campo Sector quedaba siempre «Sin definir».
--      Ahora cualquier usuario aprobado lo lee; modificarlo sigue siendo solo del CDE.
--   2. buscar_empresa_registro: el emprendedor busca su empresa por NIT o nombre antes de
--      registrarla y recibe solo datos mínimos (nombre, municipio, sector) para reconocerla.
--   3. solicitar_union_empresa: pide unirse a una empresa que ya está en la base, sin volver a
--      escribir sus datos. La confirma un administrador con resolver_solicitud_empresa (0027):
--      sin representante queda como representante; si ya hay uno, como miembro (contacto con
--      cuenta). Cualquier emprendedor vinculado puede actualizar los datos (mis_empresas).
--
-- Es seguro ejecutarla de nuevo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Sectores: lectura para cualquier usuario aprobado
-- ---------------------------------------------------------------------
drop policy if exists aprobados_leen_sectores on public.sectores;
create policy aprobados_leen_sectores on public.sectores for select to authenticated using (true);
-- (la política restrictiva solo_acceso_aprobado ya exige acceso aprobado; cde_todo sigue siendo la única que escribe)
drop policy if exists solo_acceso_aprobado on public.sectores;
create policy solo_acceso_aprobado on public.sectores as restrictive for all to authenticated
  using (public.acceso_aprobado()) with check (public.acceso_aprobado());

-- ---------------------------------------------------------------------
-- 2. Buscar la empresa antes de registrarla
-- ---------------------------------------------------------------------
create or replace function public.buscar_empresa_registro(texto text)
returns table (id uuid, nombre text, nit text, municipio text, sector text, tiene_representante boolean,
               vinculada boolean, solicitud_pendiente boolean)
language sql stable security definer set search_path = ''
as $$
  with consulta as (
    select trim(coalesce(texto, '')) as t,
           -- NIT sin puntos, guiones ni dígito de verificación (lo que va después del guion)
           nullif(regexp_replace(split_part(trim(coalesce(texto, '')), '-', 1), '[^0-9]', '', 'g'), '') as digitos
  )
  select e.id, e.nombre,
         -- Por nombre no se revela el NIT completo: solo los últimos 3 dígitos para reconocerla
         case when c.digitos is not null and e.nit = c.digitos then e.nit
              when e.nit is not null then '•••' || right(e.nit, 3) end,
         e.municipio, e.sector, e.id_representante is not null,
         e.id in (select public.mis_empresas()),
         exists (select 1 from public.solicitudes_empresa s
                 where s.id_solicitante = auth.uid() and s.estado = 'pendiente' and s.id_empresa_existente = e.id)
  from public.empresas e, consulta c
  where public.acceso_aprobado()
    and public.rol_actual() = 'emprendedor'
    and (
      (c.digitos is not null and length(c.digitos) >= 6 and e.nit = c.digitos)
      -- Por nombre si no parece un NIT (un nombre puede llevar números: «Café 2000»)
      or (length(c.t) >= 3 and c.t !~ '^[0-9 .-]+$' and e.nombre ilike '%' || c.t || '%')
    )
  order by (c.digitos is not null and e.nit = c.digitos) desc, e.nombre
  limit 5;
$$;

-- ---------------------------------------------------------------------
-- 3. Pedir unirse a una empresa existente
-- ---------------------------------------------------------------------
create or replace function public.solicitar_union_empresa(empresa uuid, cargo text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  e record;
  nueva uuid;
  solicitante text := (select p.nombre from public.perfiles p where p.id = auth.uid());
  cargo_limpio text := nullif(left(trim(coalesce(cargo, '')), 120), '');
begin
  if not exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text = 'emprendedor' and p.estado_acceso = 'aprobado') then
    raise exception 'Solo los emprendedores se unen a una empresa';
  end if;
  select x.id, x.nombre, x.nit, x.id_representante into e from public.empresas x where x.id = empresa;
  if e.id is null then
    raise exception 'La empresa no existe';
  end if;
  if e.id in (select public.mis_empresas()) then
    raise exception 'Esa empresa ya está vinculada a tu cuenta';
  end if;
  if exists (select 1 from public.solicitudes_empresa s
             where s.id_solicitante = auth.uid() and s.estado = 'pendiente' and s.id_empresa_existente = e.id) then
    raise exception 'Ya enviaste una solicitud para esta empresa';
  end if;

  insert into public.solicitudes_empresa (id_solicitante, nombre, nit, cargo, id_empresa_existente)
  values (auth.uid(), e.nombre, e.nit, cargo_limpio, e.id)
  returning id into nueva;

  insert into public.notificaciones (id_usuario, tipo, titulo, cuerpo, id_referencia)
  select p.id, 'solicitud_empresa', 'Confirma una empresa',
         coalesce(solicitante, 'Un emprendedor') || ' pide unirse a «' || e.nombre || '»'
         || coalesce(' como ' || cargo_limpio, '')
         || case when e.id_representante is null
                 then '. La empresa no tiene representante: al aprobarla quedará como representante.'
                 else '. Ya tiene representante: al aprobarla quedará como miembro de la empresa.' end,
         nueva
  from public.perfiles p where p.rol::text = 'admin_cde' and p.estado_acceso = 'aprobado';
  return nueva;
end;
$$;

revoke execute on function public.buscar_empresa_registro(text), public.solicitar_union_empresa(uuid, text) from public, anon;
grant execute on function public.buscar_empresa_registro(text), public.solicitar_union_empresa(uuid, text) to authenticated;
