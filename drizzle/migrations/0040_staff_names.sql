CREATE OR REPLACE FUNCTION public.staff_names(_ids uuid[])
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name FROM public.profiles p
  WHERE p.id = ANY(_ids) AND public.is_staff() AND public.is_aal2()
    AND (EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.user_id = p.id AND m.tenant_id = public.current_tenant())
         OR EXISTS (SELECT 1 FROM public.group_admins g WHERE g.user_id = p.id));
$$;
REVOKE ALL ON FUNCTION public.staff_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_names(uuid[]) TO authenticated;