CREATE TABLE public.appointment_fee_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id), appointment_id uuid NOT NULL REFERENCES public.appointments(id), amount_cents integer NOT NULL CHECK(amount_cents > 0), status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','paid','withdrawn')), demo_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz, created_by uuid DEFAULT auth.uid());
GRANT SELECT,INSERT,UPDATE ON public.appointment_fee_requests TO authenticated;
GRANT ALL ON public.appointment_fee_requests TO service_role;
ALTER TABLE public.appointment_fee_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY fees_read ON public.appointment_fee_requests FOR SELECT TO authenticated USING(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('agenda.appointments'));
CREATE POLICY fees_insert ON public.appointment_fee_requests FOR INSERT TO authenticated WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('billing.till'));
CREATE POLICY fees_update ON public.appointment_fee_requests FOR UPDATE TO authenticated USING(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('billing.till')) WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('billing.till'));
CREATE TRIGGER fees_audit AFTER INSERT OR UPDATE ON public.appointment_fee_requests FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE UNIQUE INDEX one_open_appointment_fee ON public.appointment_fee_requests(appointment_id) WHERE status='open';