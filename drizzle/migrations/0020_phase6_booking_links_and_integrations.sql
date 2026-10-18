-- Phase 6: booking links with sources, eKis export runs, statistics API log, Meet link bookkeeping.

CREATE UNIQUE INDEX IF NOT EXISTS practitioners_tenant_id_id ON public.practitioners(tenant_id,id);

CREATE TABLE public.booking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  slug text NOT NULL,
  name text NOT NULL,
  source text NOT NULL DEFAULT '',
  treatment_id uuid,
  location_ids uuid[] NOT NULL DEFAULT '{}',
  practitioner_mode text,
  practitioner_id uuid,
  language text NOT NULL DEFAULT 'nl',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  UNIQUE (tenant_id,id),
  UNIQUE (tenant_id,slug),
  CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  CHECK (practitioner_id IS NULL OR practitioner_mode = 'fixed'),
  FOREIGN KEY (tenant_id,treatment_id) REFERENCES public.treatments(tenant_id,id),
  FOREIGN KEY (tenant_id,practitioner_id) REFERENCES public.practitioners(tenant_id,id)
);
COMMENT ON TABLE public.booking_links IS 'Operational: pre-filled booking entries (treatment, locations, practitioner mode, language, reporting source). No patient data.';
GRANT SELECT, INSERT, UPDATE ON public.booking_links TO authenticated;
GRANT ALL ON public.booking_links TO service_role;
ALTER TABLE public.booking_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_links_read ON public.booking_links FOR SELECT TO authenticated USING (tenant_id=public.current_tenant() AND public.is_aal2() AND (public.has_permission('booking_links.view') OR public.has_permission('booking_links.manage')));
CREATE POLICY booking_links_insert ON public.booking_links FOR INSERT TO authenticated WITH CHECK (tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('booking_links.manage'));
CREATE POLICY booking_links_update ON public.booking_links FOR UPDATE TO authenticated USING (tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('booking_links.manage')) WITH CHECK (tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('booking_links.manage'));
CREATE TRIGGER t_booking_links BEFORE UPDATE ON public.booking_links FOR EACH ROW EXECUTE FUNCTION public.touch_updated();
CREATE TRIGGER trg_freeze_tenant_booking_links BEFORE UPDATE ON public.booking_links FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant();
CREATE TRIGGER trg_audit_booking_links AFTER INSERT OR UPDATE OR DELETE ON public.booking_links FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS booking_link_id uuid;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS meet_link_created_at timestamptz;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_booking_link FOREIGN KEY (tenant_id,booking_link_id) REFERENCES public.booking_links(tenant_id,id);
COMMENT ON COLUMN public.appointments.meet_link_created_at IS 'When the meeting provider created the link on this row; reschedule keeps both the link and this moment.';

CREATE TABLE public.ekis_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  ran_at timestamptz NOT NULL DEFAULT now(),
  trigger_kind text NOT NULL DEFAULT 'schedule' CHECK (trigger_kind IN ('schedule','manual')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','failed')),
  patients integer NOT NULL DEFAULT 0,
  answer_sets integer NOT NULL DEFAULT 0,
  document jsonb NOT NULL DEFAULT '{}',
  error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  UNIQUE (tenant_id,id)
);
COMMENT ON TABLE public.ekis_exports IS 'Operational: one row per eKis export run; document holds the generated import file for the day (test data only).';
GRANT SELECT, INSERT ON public.ekis_exports TO authenticated;
GRANT ALL ON public.ekis_exports TO service_role;
ALTER TABLE public.ekis_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY ekis_exports_read ON public.ekis_exports FOR SELECT TO authenticated USING (tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('settings.view'));
CREATE POLICY ekis_exports_insert ON public.ekis_exports FOR INSERT TO authenticated WITH CHECK (tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('settings.edit'));
CREATE TRIGGER t_ekis_exports BEFORE UPDATE ON public.ekis_exports FOR EACH ROW EXECUTE FUNCTION public.touch_updated();
CREATE TRIGGER trg_freeze_tenant_ekis_exports BEFORE UPDATE ON public.ekis_exports FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant();
CREATE TRIGGER trg_audit_ekis_exports AFTER INSERT OR UPDATE OR DELETE ON public.ekis_exports FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TABLE public.stats_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  endpoint text NOT NULL DEFAULT '',
  ok boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  UNIQUE (tenant_id,id)
);
COMMENT ON TABLE public.stats_requests IS 'Operational: log of statistics-API calls made with a tenant key; counts only, no patient data.';
GRANT SELECT ON public.stats_requests TO authenticated;
GRANT ALL ON public.stats_requests TO service_role;
ALTER TABLE public.stats_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY stats_requests_read ON public.stats_requests FOR SELECT TO authenticated USING (tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('settings.view'));
CREATE TRIGGER t_stats_requests BEFORE UPDATE ON public.stats_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated();
CREATE TRIGGER trg_freeze_tenant_stats_requests BEFORE UPDATE ON public.stats_requests FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant();
CREATE TRIGGER trg_audit_stats_requests AFTER INSERT OR UPDATE OR DELETE ON public.stats_requests FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
