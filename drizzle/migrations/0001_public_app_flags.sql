create or replace function public.public_app_flags()
returns table (test_mode boolean, banner text, idle_timeout_minutes int)
language sql stable security definer set search_path = public as $$
  select (select (value)::text::boolean from public.settings where key = 'test_mode'),
         (select value #>> '{}' from public.settings where key = 'test_mode_banner'),
         (select (value)::text::int from public.settings where key = 'idle_timeout_minutes_medical')
$$;
revoke execute on function public.public_app_flags() from public;
grant execute on function public.public_app_flags() to anon, authenticated;