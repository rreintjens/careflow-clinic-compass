CREATE TABLE public.waitlist_entries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
 patient_id uuid NOT NULL REFERENCES public.patients(id),
 treatment_id uuid REFERENCES public.treatments(id),
 note text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid);
GRANT SELECT,INSERT,UPDATE ON public.waitlist_entries TO authenticated; GRANT ALL ON public.waitlist_entries TO service_role;
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY waitlist_read ON public.waitlist_entries FOR SELECT TO authenticated USING(tenant_id=public.current_tenant() AND public.is_aal2() AND (public.has_permission('patients.view') OR public.has_permission('patients.medical')));
CREATE POLICY waitlist_insert ON public.waitlist_entries FOR INSERT TO authenticated WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.medical'));
CREATE POLICY waitlist_update ON public.waitlist_entries FOR UPDATE TO authenticated USING(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.medical')) WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.medical'));
CREATE TRIGGER waitlist_touch BEFORE UPDATE ON public.waitlist_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated();
CREATE TRIGGER waitlist_audit AFTER INSERT OR UPDATE ON public.waitlist_entries FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();