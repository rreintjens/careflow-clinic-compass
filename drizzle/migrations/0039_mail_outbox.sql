CREATE TABLE public.mail_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  recipient text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  moment text NOT NULL,
  appointment_id uuid REFERENCES public.appointments(id),
  patient_id uuid REFERENCES public.patients(id),
  template_id uuid REFERENCES public.mail_templates(id),
  status text NOT NULL DEFAULT 'demo_only' CHECK (status IN ('demo_only','queued','sent','failed','waiting_domain')),
  error text,
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
GRANT SELECT ON public.mail_outbox TO authenticated;
GRANT ALL ON public.mail_outbox TO service_role;
ALTER TABLE public.mail_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read outbox" ON public.mail_outbox FOR SELECT TO authenticated
  USING (public.is_aal2() AND (public.has_permission('emails.templates') OR public.has_permission('emails.send')) AND tenant_id = public.current_tenant());
CREATE INDEX mail_outbox_tenant_created ON public.mail_outbox (tenant_id, created_at DESC);