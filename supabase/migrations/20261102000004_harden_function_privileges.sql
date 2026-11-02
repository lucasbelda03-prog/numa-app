-- Nüma · 4/4 · Permisos de funciones
-- Ninguna función es invocable sin sesión; handle_new_user solo la usa el trigger.

revoke execute on function public.handle_new_user()                 from public, anon, authenticated;
revoke execute on function public.owns_dog(uuid)                    from public, anon;
revoke execute on function public.refresh_dog_analytics(uuid, date) from public, anon;
revoke execute on function public.start_premium_trial()             from public, anon;
revoke execute on function public.cancel_premium()                  from public, anon;
grant  execute on function public.owns_dog(uuid)                    to authenticated;
grant  execute on function public.refresh_dog_analytics(uuid, date) to authenticated;
grant  execute on function public.start_premium_trial()             to authenticated;
grant  execute on function public.cancel_premium()                  to authenticated;
