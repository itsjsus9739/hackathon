-- =====================================================================
-- CDE UNAB · Certificado digital de participación
--
--   Al entregar el CDE un canje de la recompensa «Certificado…», la base emite el certificado:
--   un código único y una foto de los logros de la persona en ese momento (puntos, insignias,
--   eventos, aportes). Así el certificado no cambia aunque después gane o canjee puntos.
--   · Lo ven su dueño y el CDE (RLS).
--   · verificar_certificado(codigo) es pública (también sin sesión) y solo confirma lo que dice
--     el certificado: nombre, rol, fecha y logros. El CDE puede anularlo.
--
-- Es seguro ejecutarla de nuevo.
-- =====================================================================

create table if not exists public.certificados (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^CDE-[0-9A-HJ-NP-Z]{4}-[0-9A-HJ-NP-Z]{4}$'),
  id_canje uuid not null unique references public.canjes (id) on delete cascade,
  id_usuario uuid not null references public.perfiles (id) on delete cascade,
  emitido_en timestamptz not null default now(),
  emitido_por uuid references public.perfiles (id) on delete set null,
  datos jsonb not null,           -- nombre, rol, semestre, puntos, insignias, eventos y aportes al emitirlo
  anulado_en timestamptz,
  motivo_anulacion text check (length(motivo_anulacion) <= 300)
);
create index if not exists certificados_usuario_idx on public.certificados (id_usuario);

alter table public.certificados enable row level security;
revoke insert, update, delete on public.certificados from authenticated, anon;
drop policy if exists ven_certificados on public.certificados;
create policy ven_certificados on public.certificados for select to authenticated
  using (id_usuario = (select auth.uid()) or public.es_cde());
drop policy if exists solo_acceso_aprobado on public.certificados;
create policy solo_acceso_aprobado on public.certificados as restrictive for all to authenticated
  using (public.acceso_aprobado()) with check (public.acceso_aprobado());

drop trigger if exists certificados_auditoria on public.certificados;
create trigger certificados_auditoria after insert or update or delete on public.certificados
  for each row execute function public.auditar();

-- Código legible y sin caracteres confusos (sin I, O): CDE-7K2M-Q9XA
create or replace function public.nuevo_codigo_certificado()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  letras constant text := '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  nuevo text;
begin
  loop
    nuevo := 'CDE-';
    for i in 1..8 loop
      nuevo := nuevo || substr(letras, 1 + floor(random() * length(letras))::int, 1);
      if i = 4 then nuevo := nuevo || '-'; end if;
    end loop;
    exit when not exists (select 1 from public.certificados c where c.codigo = nuevo);
  end loop;
  return nuevo;
end;
$$;

-- Foto de los logros de una persona
create or replace function public.logros_para_certificado(usuario uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'nombre', p.nombre,
    'rol', p.rol,
    'semestre', public.semestre_de((now() at time zone 'America/Bogota')::date),
    'puntos', coalesce(pu.puntos, 0),
    'eventos_asistidos', coalesce(pu.eventos_asistidos, 0),
    'aportes_validados', (select count(*) from public.aportes a where a.id_usuario = usuario and a.estado = 'Validado'),
    'compromisos_cumplidos', (select count(*) from public.compromisos c where c.id_responsable = usuario and c.estado = 'Cumplido'),
    'insignias', coalesce((select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'nivel', i.nivel) order by i.nivel desc, iu.otorgada_en)
                           from public.insignias_usuario iu join public.insignias i on i.id = iu.id_insignia
                           where iu.id_usuario = usuario), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(x.nombre order by x.fecha desc) from (
                           select e.nombre, e.fecha from public.inscripciones_eventos ie join public.eventos e on e.id = ie.id_evento
                           where ie.id_usuario = usuario and ie.asistio order by e.fecha desc limit 8) x), '[]'::jsonb),
    'empresas', coalesce((select jsonb_agg(e.nombre order by e.nombre) from public.empresas e
                          where e.id_representante = usuario
                             or e.id in (select ce.id_empresa from public.contactos_empresa ce where ce.id_perfil = usuario)), '[]'::jsonb)
  )
  from public.perfiles p
  left join public.puntos_usuario pu on pu.id_usuario = p.id
  where p.id = usuario;
$$;

-- Canje de certificado entregado → se emite (una sola vez por canje)
create or replace function public.emitir_certificado()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.estado = 'Entregado' and (tg_op = 'INSERT' or old.estado is distinct from 'Entregado')
     and exists (select 1 from public.recompensas r where r.id = new.id_recompensa and r.nombre ilike 'Certificado%') then
    insert into public.certificados (codigo, id_canje, id_usuario, emitido_por, datos)
    values (public.nuevo_codigo_certificado(), new.id, new.id_usuario, auth.uid(), public.logros_para_certificado(new.id_usuario))
    on conflict (id_canje) do nothing;
    perform public.notificar(new.id_usuario, 'canje', 'Tu certificado está listo',
      'Descárgalo en PDF desde Formación y recompensas.', '/formacion');
  end if;
  return null;
end;
$$;
drop trigger if exists canjes_certificado on public.canjes;
create trigger canjes_certificado after insert or update of estado on public.canjes
  for each row execute function public.emitir_certificado();

-- Certificados ya entregados antes de esta migración
insert into public.certificados (codigo, id_canje, id_usuario, emitido_por, datos, emitido_en)
select public.nuevo_codigo_certificado(), c.id, c.id_usuario, c.resuelto_por, public.logros_para_certificado(c.id_usuario), coalesce(c.resuelto_en, now())
from public.canjes c join public.recompensas r on r.id = c.id_recompensa
where c.estado = 'Entregado' and r.nombre ilike 'Certificado%'
on conflict (id_canje) do nothing;

-- El CDE anula un certificado (deja de ser válido en la verificación)
create or replace function public.anular_certificado(certificado uuid, motivo text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.es_cde() then
    raise exception 'Solo el equipo del CDE anula certificados';
  end if;
  update public.certificados set anulado_en = now(), motivo_anulacion = nullif(left(trim(motivo), 300), '')
  where id = certificado and anulado_en is null;
end;
$$;

-- Verificación pública: solo lo que dice el certificado
create or replace function public.verificar_certificado(codigo text)
returns table (valido boolean, codigo_certificado text, nombre text, rol text, emitido_en timestamptz, datos jsonb,
               anulado_en timestamptz, motivo_anulacion text)
language sql stable security definer set search_path = ''
as $$
  select c.anulado_en is null, c.codigo, c.datos->>'nombre', c.datos->>'rol', c.emitido_en,
         c.datos - 'empresas',       -- la verificación no expone a qué empresas está vinculada la persona
         c.anulado_en, c.motivo_anulacion
  from public.certificados c
  where c.codigo = upper(trim(verificar_certificado.codigo));
$$;

revoke execute on function public.nuevo_codigo_certificado(), public.logros_para_certificado(uuid), public.emitir_certificado()
  from public, anon, authenticated;
revoke execute on function public.anular_certificado(uuid, text) from public, anon;
grant execute on function public.anular_certificado(uuid, text) to authenticated;
revoke execute on function public.verificar_certificado(text) from public;
grant execute on function public.verificar_certificado(text) to anon, authenticated;
