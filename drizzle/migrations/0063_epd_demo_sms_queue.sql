CREATE TABLE public.sms_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
 appointment_id uuid NOT NULL REFERENCES public.appointments(id),
 moment text NOT NULL,
 status text NOT NULL DEFAULT 'demo_only' CHECK(status = 'demo_only'),
 dedupe_key text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid DEFAULT auth.uid()
);
GRANT SELECT, INSERT ON public.sms_outbox TO authenticated;
GRANT ALL ON public.sms_outbox TO service_role;
ALTER TABLE public.sms_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY sms_read ON public.sms_outbox FOR SELECT TO authenticated USING (tenant_id = public.current_tenant() AND public.is_aal2() AND public.has_permission('agenda.appointments'));
CREATE POLICY sms_write ON public.sms_outbox FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant() AND public.is_aal2() AND public.has_permission('agenda.appointments'));
CREATE TRIGGER sms_audit AFTER INSERT ON public.sms_outbox FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();