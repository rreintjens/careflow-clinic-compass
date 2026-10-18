CREATE TABLE public.consult_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  appointment_id uuid REFERENCES public.appointments(id),
  kind text NOT NULL DEFAULT 'consult',
  subjective text NOT NULL DEFAULT '', objective text NOT NULL DEFAULT '', evaluation text NOT NULL DEFAULT '', plan text NOT NULL DEFAULT '',
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','final')),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid DEFAULT auth.uid()
);
CREATE UNIQUE INDEX consult_notes_appt ON public.consult_notes(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE TABLE public.treatment_plans (
  patient_id uuid PRIMARY KEY REFERENCES public.patients(id),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid DEFAULT auth.uid()
);
CREATE TABLE public.patient_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  title text NOT NULL,
  storage_path text,
  source text NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid DEFAULT auth.uid()
);
GRANT SELECT, INSERT, UPDATE ON public.consult_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.treatment_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_documents TO authenticated;
GRANT ALL ON public.consult_notes, public.treatment_plans, public.patient_documents TO service_role;
ALTER TABLE public.consult_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t text; r text; w text; BEGIN
  FOREACH t IN ARRAY ARRAY['consult_notes','treatment_plans','patient_documents'] LOOP
    r := CASE WHEN t = 'patient_documents' THEN 'patients.view' ELSE 'patients.medical' END;
    w := CASE WHEN t = 'patient_documents' THEN 'patients.edit' ELSE 'patients.medical' END;
    EXECUTE format('CREATE POLICY "%s read" ON public.%I FOR SELECT TO authenticated USING (public.is_aal2() AND public.has_permission(%L) AND tenant_id = public.current_tenant())', t, t, r);
    EXECUTE format('CREATE POLICY "%s insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_aal2() AND public.has_permission(%L) AND tenant_id = public.current_tenant())', t, t, w);
    EXECUTE format('CREATE POLICY "%s update" ON public.%I FOR UPDATE TO authenticated USING (public.is_aal2() AND public.has_permission(%L) AND tenant_id = public.current_tenant()) WITH CHECK (public.is_aal2() AND public.has_permission(%L) AND tenant_id = public.current_tenant())', t, t, w, w);
    EXECUTE format('CREATE TRIGGER t_%s BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated()', t, t);
    EXECUTE format('CREATE TRIGGER trg_audit_%s AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t, t);
    EXECUTE format('CREATE TRIGGER trg_freeze_tenant_%s BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant()', t, t);
  END LOOP;
END $$;
CREATE POLICY "patient_documents delete" ON public.patient_documents FOR DELETE TO authenticated
  USING (public.is_aal2() AND public.has_permission('patients.edit') AND tenant_id = public.current_tenant());
CREATE OR REPLACE FUNCTION public.freeze_final_consult() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'final' THEN RAISE EXCEPTION 'consult note is final'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_freeze_final_consult BEFORE UPDATE ON public.consult_notes FOR EACH ROW EXECUTE FUNCTION public.freeze_final_consult();
CREATE POLICY "patient documents read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'patient-documents-' || public.current_tenant_slug() AND public.is_aal2() AND public.has_permission('patients.view'));
CREATE POLICY "patient documents write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'patient-documents-' || public.current_tenant_slug() AND public.is_aal2() AND public.has_permission('patients.edit'));