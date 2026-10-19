GRANT INSERT, DELETE ON public.roles TO authenticated;
CREATE POLICY "create roles" ON public.roles FOR INSERT TO authenticated
  WITH CHECK (public.is_aal2() AND public.has_permission('roles.manage') AND tenant_id = public.current_tenant() AND key <> 'superadmin');
CREATE POLICY "delete unused roles" ON public.roles FOR DELETE TO authenticated
  USING (public.is_aal2() AND public.has_permission('roles.manage') AND tenant_id = public.current_tenant() AND key <> 'superadmin'
    AND NOT EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.role_id = roles.id));