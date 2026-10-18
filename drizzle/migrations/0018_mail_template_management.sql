CREATE UNIQUE INDEX IF NOT EXISTS treatment_categories_tenant_id_id ON public.treatment_categories(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS treatments_tenant_id_id ON public.treatments(tenant_id,id);
CREATE TABLE public.mail_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id), name text NOT NULL, moment text NOT NULL, scope text NOT NULL DEFAULT 'base' CHECK (scope IN ('base','category','treatment')), category_id uuid, treatment_id uuid,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('active','draft','archived')), subject_nl text NOT NULL DEFAULT '', subject_en text NOT NULL DEFAULT '', blocks jsonb NOT NULL DEFAULT '[]', description text NOT NULL DEFAULT '', sort integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(), updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid DEFAULT auth.uid(),
 CHECK ((scope='base' AND category_id IS NULL AND treatment_id IS NULL) OR (scope='category' AND category_id IS NOT NULL AND treatment_id IS NULL) OR (scope='treatment' AND treatment_id IS NOT NULL AND category_id IS NULL)),
 UNIQUE (tenant_id,id), FOREIGN KEY (tenant_id,category_id) REFERENCES public.treatment_categories(tenant_id,id), FOREIGN KEY (tenant_id,treatment_id) REFERENCES public.treatments(tenant_id,id)
);
GRANT SELECT, INSERT, UPDATE ON public.mail_templates TO authenticated;
GRANT ALL ON public.mail_templates TO service_role;
ALTER TABLE public.mail_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY mail_templates_read ON public.mail_templates FOR SELECT TO authenticated USING (tenant_id=public.current_tenant() AND public.is_aal2() AND (public.has_permission('emails.templates') OR public.has_permission('emails.send')));
CREATE POLICY mail_templates_insert ON public.mail_templates FOR INSERT TO authenticated WITH CHECK (tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('emails.templates'));
CREATE POLICY mail_templates_update ON public.mail_templates FOR UPDATE TO authenticated USING (tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('emails.templates')) WITH CHECK (tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('emails.templates'));
CREATE UNIQUE INDEX mail_templates_base_unique ON public.mail_templates(tenant_id,moment) WHERE scope='base' AND status<>'archived';
CREATE UNIQUE INDEX mail_templates_category_unique ON public.mail_templates(tenant_id,moment,category_id) WHERE scope='category' AND status<>'archived';
CREATE UNIQUE INDEX mail_templates_treatment_unique ON public.mail_templates(tenant_id,moment,treatment_id) WHERE scope='treatment' AND status<>'archived';
CREATE TRIGGER t_mail_templates BEFORE UPDATE ON public.mail_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated();
CREATE TRIGGER trg_freeze_tenant_mail_templates BEFORE UPDATE ON public.mail_templates FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant();
CREATE TRIGGER trg_audit_mail_templates AFTER INSERT OR UPDATE OR DELETE ON public.mail_templates FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
COMMENT ON TABLE public.mail_templates IS 'Operational: tenant-specific email content and conditional blocks; no recipient identity or medical answers.';