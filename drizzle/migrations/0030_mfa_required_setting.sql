CREATE OR REPLACE FUNCTION public.mfa_required()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select coalesce((select (value)::text::boolean from public.settings
    where key = 'mfa_required' and tenant_id = public.current_tenant()), true)
$$;
GRANT EXECUTE ON FUNCTION public.mfa_required() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_aal2()
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' or not public.mfa_required()
$$;