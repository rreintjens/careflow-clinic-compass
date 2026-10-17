CREATE TABLE public.equipment_kinds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  key text NOT NULL,
  name text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid,
  UNIQUE (tenant_id, key)
);
CREATE TABLE public.equipment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  kind_id uuid NOT NULL REFERENCES public.equipment_kinds(id) ON DELETE CASCADE,
  brand text NOT NULL,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid,
  UNIQUE (tenant_id, kind_id, brand, type)
);
CREATE TABLE public.equipment_schedule (
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid,
  PRIMARY KEY (equipment_id, weekday)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_kinds, public.equipment_types, public.equipment_schedule TO authenticated;
GRANT ALL ON public.equipment_kinds, public.equipment_types, public.equipment_schedule TO service_role;
CREATE INDEX ON public.equipment_kinds(tenant_id);
CREATE INDEX ON public.equipment_types(tenant_id);
CREATE INDEX ON public.equipment_schedule(tenant_id);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['equipment_kinds','equipment_types','equipment_schedule'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "%s read" ON public.%I FOR SELECT TO authenticated USING (public.is_aal2() AND public.is_staff() AND tenant_id = public.current_tenant())', t, t);
    EXECUTE format('CREATE POLICY "%s insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_aal2() AND public.has_permission(''settings.edit'') AND tenant_id = public.current_tenant())', t, t);
    EXECUTE format('CREATE POLICY "%s update" ON public.%I FOR UPDATE TO authenticated USING (public.is_aal2() AND public.has_permission(''settings.edit'') AND tenant_id = public.current_tenant()) WITH CHECK (public.is_aal2() AND public.has_permission(''settings.edit'') AND tenant_id = public.current_tenant())', t, t);
    EXECUTE format('CREATE POLICY "%s delete" ON public.%I FOR DELETE TO authenticated USING (public.is_aal2() AND public.has_permission(''settings.edit'') AND tenant_id = public.current_tenant())', t, t);
    EXECUTE format('CREATE TRIGGER t_%s BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated()', t, t);
    EXECUTE format('CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t, t);
    EXECUTE format('CREATE TRIGGER trg_freeze_tenant BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant()', t);
  END LOOP;
END $$;

ALTER TABLE public.rooms ADD COLUMN purpose text NOT NULL DEFAULT '';
ALTER TABLE public.equipment
  ADD COLUMN type_id uuid REFERENCES public.equipment_types(id) ON DELETE RESTRICT,
  ADD COLUMN placement text NOT NULL DEFAULT 'fixed_room' CHECK (placement IN ('fixed_room','movable_location','travelling')),
  ADD COLUMN status text NOT NULL DEFAULT 'in_use',
  ADD COLUMN maintenance_interval_months integer CHECK (maintenance_interval_months IS NULL OR maintenance_interval_months > 0),
  ADD COLUMN next_maintenance_on date;

-- Backfill: kinds from the existing kind keys, one type per existing device kind.
INSERT INTO public.equipment_kinds (tenant_id, key, name, sort)
SELECT DISTINCT e.tenant_id, e.kind, COALESCE(o.label_nl, e.kind), COALESCE(o.sort, 0)
FROM public.equipment e LEFT JOIN public.option_lists o ON o.list_key = 'equipment_kind' AND o.value = e.kind;
INSERT INTO public.equipment_kinds (tenant_id, key, name, sort)
SELECT DISTINCT r.tenant_id, r.equipment_kind, COALESCE(o.label_nl, r.equipment_kind), COALESCE(o.sort, 0)
FROM public.treatment_requirements r LEFT JOIN public.option_lists o ON o.list_key = 'equipment_kind' AND o.value = r.equipment_kind
WHERE r.equipment_kind IS NOT NULL
ON CONFLICT (tenant_id, key) DO NOTHING;
INSERT INTO public.equipment_types (tenant_id, kind_id, brand, type)
SELECT DISTINCT k.tenant_id, k.id, k.name, ''
FROM public.equipment_kinds k WHERE EXISTS (SELECT 1 FROM public.equipment e WHERE e.tenant_id = k.tenant_id AND e.kind = k.key);
UPDATE public.equipment e SET
  type_id = (SELECT t.id FROM public.equipment_types t JOIN public.equipment_kinds k ON k.id = t.kind_id WHERE k.tenant_id = e.tenant_id AND k.key = e.kind LIMIT 1),
  placement = CASE WHEN e.mobility = 'between_locations' THEN 'travelling' WHEN e.room_id IS NOT NULL THEN 'fixed_room' ELSE 'movable_location' END,
  location_id = CASE WHEN e.room_id IS NOT NULL THEN (SELECT r.location_id FROM public.rooms r WHERE r.id = e.room_id) ELSE e.location_id END;
INSERT INTO public.equipment_schedule (equipment_id, weekday, location_id, tenant_id)
SELECT equipment_id, weekday, location_id, tenant_id FROM public.equipment_day_locations;

ALTER TABLE public.treatment_requirements
  ADD CONSTRAINT treatment_requirements_kind_fk FOREIGN KEY (tenant_id, equipment_kind) REFERENCES public.equipment_kinds(tenant_id, key) ON UPDATE CASCADE;

COMMENT ON COLUMN public.equipment.name IS 'DEPRECATED: display name is generated from type and placement; kept filled for old readers';
COMMENT ON COLUMN public.equipment.mobility IS 'DEPRECATED: replaced by placement';
COMMENT ON COLUMN public.equipment.recurrence IS 'DEPRECATED: travelling devices use equipment_schedule weekly';
COMMENT ON COLUMN public.equipment.kind IS 'DEPRECATED: kind comes from type_id -> equipment_types.kind_id; kept in sync for old readers';
COMMENT ON TABLE public.equipment_day_locations IS 'DEPRECATED: replaced by equipment_schedule';