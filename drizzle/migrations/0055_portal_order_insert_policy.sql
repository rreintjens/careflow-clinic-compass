GRANT INSERT ON public.ma_packages TO authenticated;
CREATE POLICY portal_packages_order ON public.ma_packages FOR INSERT TO authenticated
WITH CHECK (tenant_id = current_tenant() AND patient_id = portal_patient_id() AND status = 'ordered');