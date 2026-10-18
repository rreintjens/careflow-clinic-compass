CREATE TABLE public.anamnesis (
  patient_id uuid PRIMARY KEY REFERENCES public.patients(id),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid DEFAULT auth.uid()
);
CREATE TABLE public.measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  appointment_id uuid REFERENCES public.appointments(id),
  measured_on date NOT NULL,
  weight_kg numeric(5,1), height_cm numeric(5,1), waist_cm numeric(5,1),
  bp_systolic integer, bp_diastolic integer, pulse integer,
  source text NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid DEFAULT auth.uid()
);
GRANT SELECT, INSERT, UPDATE ON public.anamnesis TO authenticated;
GRANT ALL ON public.anamnesis TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurements TO authenticated;
GRANT ALL ON public.measurements TO service_role;
ALTER TABLE public.anamnesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['anamnesis','measurements'] LOOP
    EXECUTE format('CREATE POLICY "%s read" ON public.%I FOR SELECT TO authenticated USING (public.is_aal2() AND public.has_permission(''patients.medical'') AND tenant_id = public.current_tenant())', t, t);
    EXECUTE format('CREATE POLICY "%s insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_aal2() AND public.has_permission(''patients.medical'') AND tenant_id = public.current_tenant())', t, t);
    EXECUTE format('CREATE POLICY "%s update" ON public.%I FOR UPDATE TO authenticated USING (public.is_aal2() AND public.has_permission(''patients.medical'') AND tenant_id = public.current_tenant()) WITH CHECK (public.is_aal2() AND public.has_permission(''patients.medical'') AND tenant_id = public.current_tenant())', t, t);
    EXECUTE format('CREATE TRIGGER t_%s BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated()', t, t);
    EXECUTE format('CREATE TRIGGER trg_audit_%s AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t, t);
    EXECUTE format('CREATE TRIGGER trg_freeze_tenant_%s BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant()', t, t);
  END LOOP;
END $$;
CREATE POLICY "measurements delete" ON public.measurements FOR DELETE TO authenticated
  USING (public.is_aal2() AND public.has_permission('patients.medical') AND tenant_id = public.current_tenant());