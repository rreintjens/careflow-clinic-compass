-- Owner decision 19-10: tenants in test mode never require a second factor (demo project, test data only).
CREATE OR REPLACE FUNCTION public.mfa_required()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' SET row_security = off AS $$
  with t as (select (auth.jwt() -> 'app_metadata' ->> 'active_tenant') as id)
  select coalesce((select (value)::text::boolean from public.settings, t
      where key = 'mfa_required' and tenant_id::text = t.id), true)
    and not coalesce((select (value)::text::boolean from public.settings, t
      where key = 'test_mode' and tenant_id::text = t.id), false)
$$;
GRANT EXECUTE ON FUNCTION public.mfa_required() TO authenticated;

INSERT INTO public.group_settings (key, value) VALUES ('demo_login_email', '"rob@bodyclinic.nl"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = excluded.value;