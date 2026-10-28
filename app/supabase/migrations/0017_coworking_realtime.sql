-- =====================================================================
-- CDE UNAB · Coworking virtual: canal de Realtime privado
--   La sala (quién está, posiciones, avatares) y la señalización de la voz (WebRTC) viajan por
--   canales privados "coworking:<sala>". Solo los usuarios con sesión y acceso aprobado pueden
--   escuchar o enviar en ellos. El chat usa la tabla mensajes (canal "Coworking"), con su propia RLS.
-- =====================================================================

create policy coworking_escuchar on realtime.messages
  for select to authenticated
  using (realtime.topic() like 'coworking:%' and public.acceso_aprobado());

create policy coworking_enviar on realtime.messages
  for insert to authenticated
  with check (realtime.topic() like 'coworking:%' and public.acceso_aprobado());
