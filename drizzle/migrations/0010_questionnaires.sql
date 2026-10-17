CREATE TABLE public.questionnaire_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  key text NOT NULL,
  document jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid,
  UNIQUE (tenant_id, key)
);
CREATE TABLE public.questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  flow_id uuid NOT NULL REFERENCES public.questionnaire_flows(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  moment text NOT NULL CHECK (moment IN ('before_booking_confirmation','after_booking')),
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid,
  UNIQUE (tenant_id, key)
);
CREATE TABLE public.questionnaire_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  questionnaire_id uuid NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  definition jsonb NOT NULL,
  note text,
  published_at timestamptz,
  published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid,
  UNIQUE (questionnaire_id, version_no)
);
CREATE UNIQUE INDEX questionnaire_versions_one_published ON public.questionnaire_versions(questionnaire_id) WHERE status = 'published';
CREATE UNIQUE INDEX questionnaire_versions_one_draft ON public.questionnaire_versions(questionnaire_id) WHERE status = 'draft';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionnaire_flows, public.questionnaires, public.questionnaire_versions TO authenticated;
GRANT ALL ON public.questionnaire_flows, public.questionnaires, public.questionnaire_versions TO service_role;

-- A published or archived version is frozen: only its status may move on (published -> archived).
CREATE OR REPLACE FUNCTION public.freeze_published_version() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status <> 'draft' AND (NEW.definition IS DISTINCT FROM OLD.definition OR NEW.version_no <> OLD.version_no) THEN
    RAISE EXCEPTION 'A published or archived questionnaire version cannot be changed';
  END IF;
  IF OLD.status = 'archived' AND NEW.status <> 'archived' THEN
    RAISE EXCEPTION 'An archived version stays archived';
  END IF;
  RETURN NEW;
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['questionnaire_flows','questionnaires','questionnaire_versions'] LOOP
    EXECUTE format('CREATE INDEX ON public.%I(tenant_id)', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "%s read" ON public.%I FOR SELECT TO authenticated USING (public.is_aal2() AND public.has_permission(''questionnaires.view'') AND tenant_id = public.current_tenant())', t, t);
    EXECUTE format('CREATE POLICY "%s insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_aal2() AND public.has_permission(''questionnaires.manage'') AND tenant_id = public.current_tenant())', t, t);
    EXECUTE format('CREATE POLICY "%s update" ON public.%I FOR UPDATE TO authenticated USING (public.is_aal2() AND public.has_permission(''questionnaires.manage'') AND tenant_id = public.current_tenant()) WITH CHECK (public.is_aal2() AND public.has_permission(''questionnaires.manage'') AND tenant_id = public.current_tenant())', t, t);
    EXECUTE format('CREATE TRIGGER t_%s BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated()', t, t);
    EXECUTE format('CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t, t);
    EXECUTE format('CREATE TRIGGER trg_freeze_tenant BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant()', t);
  END LOOP;
END $$;
-- Only drafts may be deleted; published versions are archived instead.
CREATE POLICY "questionnaire_versions delete" ON public.questionnaire_versions FOR DELETE TO authenticated
  USING (public.is_aal2() AND public.has_permission('questionnaires.manage') AND tenant_id = public.current_tenant() AND status = 'draft');
CREATE TRIGGER trg_freeze_published BEFORE UPDATE ON public.questionnaire_versions FOR EACH ROW EXECUTE FUNCTION public.freeze_published_version();