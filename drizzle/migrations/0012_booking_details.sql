ALTER TABLE public.patients
  ADD COLUMN salutation text NULL,
  ADD COLUMN phone_country text NULL,
  ADD COLUMN country text NULL,
  ADD COLUMN postcode text NULL,
  ADD COLUMN house_number text NULL,
  ADD COLUMN house_suffix text NULL,
  ADD COLUMN street text NULL,
  ADD COLUMN city text NULL,
  ADD COLUMN gp_name text NULL;

ALTER TABLE public.appointments
  ADD COLUMN referral_source text NULL,
  ADD COLUMN patient_note text NULL,
  ADD COLUMN new_patient boolean NULL;

CREATE TABLE public.patient_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant(),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  appointment_id uuid NULL REFERENCES public.appointments(id),
  kind text NOT NULL,
  granted boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_consents_patient ON public.patient_consents (patient_id);

-- Questionnaire answers (medical data, no identity columns).
CREATE TABLE public.answer_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant(),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  appointment_id uuid NULL REFERENCES public.appointments(id),
  questionnaire_key text NOT NULL,
  version_id uuid NULL REFERENCES public.questionnaire_versions(id),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);
CREATE INDEX answer_sets_patient ON public.answer_sets (patient_id);
CREATE UNIQUE INDEX answer_sets_appt_q ON public.answer_sets (appointment_id, questionnaire_key);

GRANT SELECT ON public.patient_consents TO authenticated;
GRANT ALL ON public.patient_consents TO service_role;
GRANT SELECT ON public.answer_sets TO authenticated;
GRANT ALL ON public.answer_sets TO service_role;

ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consents read" ON public.patient_consents FOR SELECT TO authenticated
  USING (public.is_aal2() AND public.has_permission('patients.view') AND tenant_id = public.current_tenant());
CREATE POLICY "answer sets read" ON public.answer_sets FOR SELECT TO authenticated
  USING (public.is_aal2() AND public.has_permission('patients.medical') AND tenant_id = public.current_tenant());

CREATE TRIGGER t_answer_sets BEFORE UPDATE ON public.answer_sets FOR EACH ROW EXECUTE FUNCTION public.touch_updated();
CREATE TRIGGER trg_audit_answer_sets AFTER INSERT OR DELETE OR UPDATE ON public.answer_sets FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_consents AFTER INSERT OR DELETE OR UPDATE ON public.patient_consents FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_freeze_tenant BEFORE UPDATE ON public.answer_sets FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant();
CREATE TRIGGER trg_freeze_tenant BEFORE UPDATE ON public.patient_consents FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant();