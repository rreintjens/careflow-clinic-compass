CREATE OR REPLACE FUNCTION public.mfa_required()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' SET row_security = off AS $$
  -- Reads the server-written active_tenant claim directly: current_tenant() depends on is_aal2(), which depends on this.
  select coalesce((select (value)::text::boolean from public.settings
    where key = 'mfa_required'
      and tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'active_tenant')), true)
$$;