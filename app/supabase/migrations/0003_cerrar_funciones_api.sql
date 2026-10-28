-- =====================================================================
-- Cierra las funciones SECURITY DEFINER expuestas en /rest/v1/rpc (asesor de seguridad de Supabase)
-- =====================================================================

-- Funciones de trigger: nadie debe llamarlas directamente (los triggers se ejecutan igual,
-- Postgres no revisa EXECUTE al disparar un trigger)
revoke execute on function public.auditar()                    from public, anon, authenticated;
revoke execute on function public.auditar_asignacion()         from public, anon, authenticated;
revoke execute on function public.crear_perfil_nuevo_usuario() from public, anon, authenticated;
revoke execute on function public.validar_rol_asignado()       from public, anon, authenticated;

-- Funciones usadas por las políticas RLS: las políticas corren con los permisos de quien consulta,
-- así que 'authenticated' las necesita. Solo devuelven datos del propio usuario. 'anon' no.
revoke execute on function public.es_cde()                   from public, anon;
revoke execute on function public.rol_actual()               from public, anon;
revoke execute on function public.proyectos_del_docente()    from public, anon;
revoke execute on function public.proyectos_del_estudiante() from public, anon;
grant execute on function public.es_cde(), public.rol_actual(),
                          public.proyectos_del_docente(), public.proyectos_del_estudiante() to authenticated;
