CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant(),
  patient_id uuid NULL REFERENCES public.patients(id),
  treatment_id uuid NOT NULL REFERENCES public.treatments(id),
  practitioner_id uuid NOT NULL REFERENCES public.practitioners(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  room_id uuid NULL REFERENCES public.rooms(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','booked','cancelled','released','expired')),
  hold_expires_at timestamptz NULL,
  hold_token uuid NULL DEFAULT gen_random_uuid(),
  source text NULL,
  language text NOT NULL DEFAULT 'nl',
  cancel_reason text NULL,
  meet_link text NULL,
  manage_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  CHECK (ends_at > starts_at)
);
CREATE INDEX appointments_practitioner_time ON public.appointments (practitioner_id, starts_at) WHERE status IN ('held','booked');
CREATE INDEX appointments_room_time ON public.appointments (room_id, starts_at) WHERE status IN ('held','booked');
CREATE UNIQUE INDEX appointments_manage_token ON public.appointments (manage_token);

CREATE TABLE public.triage_rejection_counts (
  tenant_id uuid NOT NULL DEFAULT public.current_tenant(),
  day date NOT NULL,
  questionnaire_key text NOT NULL,
  reason text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, day, questionnaire_key, reason)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
GRANT SELECT ON public.triage_rejection_counts TO authenticated;
GRANT ALL ON public.triage_rejection_counts TO service_role;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triage_rejection_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments read" ON public.appointments FOR SELECT TO authenticated
  USING (public.is_aal2() AND public.has_permission('agenda.view') AND tenant_id = public.current_tenant());
CREATE POLICY "appointments insert" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.is_aal2() AND public.has_permission('agenda.appointments') AND tenant_id = public.current_tenant());
CREATE POLICY "appointments update" ON public.appointments FOR UPDATE TO authenticated
  USING (public.is_aal2() AND public.has_permission('agenda.appointments') AND tenant_id = public.current_tenant())
  WITH CHECK (public.is_aal2() AND public.has_permission('agenda.appointments') AND tenant_id = public.current_tenant());
CREATE POLICY "appointments delete" ON public.appointments FOR DELETE TO authenticated
  USING (public.is_aal2() AND public.has_permission('agenda.appointments') AND tenant_id = public.current_tenant());
CREATE POLICY "rejection counts read" ON public.triage_rejection_counts FOR SELECT TO authenticated
  USING (public.is_aal2() AND public.has_permission('dashboard.view') AND tenant_id = public.current_tenant());

CREATE TRIGGER t_appointments BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.touch_updated();
CREATE TRIGGER trg_audit_appointments AFTER INSERT OR DELETE OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_freeze_tenant BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant();

-- Anonymous reason count; never stores answers.
CREATE OR REPLACE FUNCTION public.count_triage_rejection(_tenant uuid, _questionnaire text, _reason text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.triage_rejection_counts (tenant_id, day, questionnaire_key, reason, count)
  VALUES (_tenant, current_date, _questionnaire, _reason, 1)
  ON CONFLICT (tenant_id, day, questionnaire_key, reason) DO UPDATE SET count = triage_rejection_counts.count + 1;
$$;
REVOKE ALL ON FUNCTION public.count_triage_rejection(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_triage_rejection(uuid, text, text) TO service_role;