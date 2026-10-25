CREATE TABLE public.treatment_menu_root (
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  treatment_id uuid NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  PRIMARY KEY (tenant_id, treatment_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_menu_root TO authenticated;
GRANT ALL ON public.treatment_menu_root TO service_role;
ALTER TABLE public.treatment_menu_root ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_root read" ON public.treatment_menu_root FOR SELECT TO authenticated
  USING ((SELECT public.is_aal2()) AND (SELECT public.is_staff()) AND tenant_id = (SELECT public.current_tenant()));
CREATE POLICY "menu_root portal read" ON public.treatment_menu_root FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant()) AND (SELECT public.portal_patient_id()) IS NOT NULL);
CREATE POLICY "menu_root insert" ON public.treatment_menu_root FOR INSERT TO authenticated
  WITH CHECK (public.is_aal2() AND public.has_permission('settings.edit') AND tenant_id = public.current_tenant());
CREATE POLICY "menu_root update" ON public.treatment_menu_root FOR UPDATE TO authenticated
  USING (public.is_aal2() AND public.has_permission('settings.edit') AND tenant_id = public.current_tenant())
  WITH CHECK (public.is_aal2() AND public.has_permission('settings.edit') AND tenant_id = public.current_tenant());
CREATE POLICY "menu_root delete" ON public.treatment_menu_root FOR DELETE TO authenticated
  USING (public.is_aal2() AND public.has_permission('settings.edit') AND tenant_id = public.current_tenant());
CREATE TRIGGER trg_audit_treatment_menu_root AFTER INSERT OR DELETE OR UPDATE ON public.treatment_menu_root FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TABLE public.custom_icons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  name text NOT NULL,
  svg text NOT NULL CHECK (length(svg) <= 60000 AND svg ~* '^\s*(<\?xml[^>]*>\s*)?<svg'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);
GRANT SELECT, INSERT, DELETE ON public.custom_icons TO authenticated;
GRANT ALL ON public.custom_icons TO service_role;
ALTER TABLE public.custom_icons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_icons read" ON public.custom_icons FOR SELECT TO authenticated
  USING ((SELECT public.is_aal2()) AND (SELECT public.is_staff()) AND tenant_id = (SELECT public.current_tenant()));
CREATE POLICY "custom_icons insert" ON public.custom_icons FOR INSERT TO authenticated
  WITH CHECK (public.is_aal2() AND public.has_permission('settings.edit') AND tenant_id = public.current_tenant());
CREATE POLICY "custom_icons delete" ON public.custom_icons FOR DELETE TO authenticated
  USING (public.is_aal2() AND public.has_permission('settings.edit') AND tenant_id = public.current_tenant());
CREATE TRIGGER trg_audit_custom_icons AFTER INSERT OR DELETE ON public.custom_icons FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE OR REPLACE FUNCTION public.guard_menu_depth() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  max_depth int;
  parent_depth int := 0;
  own_height int;
  cur uuid := NEW.parent_id;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.parent_id IS NOT DISTINCT FROM OLD.parent_id THEN RETURN NEW; END IF;
  SELECT COALESCE((value #>> '{}')::int, 3) INTO max_depth FROM settings WHERE tenant_id = NEW.tenant_id AND key = 'menu_max_depth';
  max_depth := COALESCE(max_depth, 3);
  WHILE cur IS NOT NULL LOOP
    IF cur = NEW.id THEN RAISE EXCEPTION 'Kan niet: een groep kan niet in zichzelf' USING ERRCODE = 'P0001'; END IF;
    parent_depth := parent_depth + 1;
    IF parent_depth > 20 THEN EXIT; END IF;
    SELECT parent_id INTO cur FROM treatment_categories WHERE id = cur AND tenant_id = NEW.tenant_id;
  END LOOP;
  WITH RECURSIVE d AS (
    SELECT id, 1 AS h FROM treatment_categories WHERE id = NEW.id
    UNION ALL SELECT c.id, d.h + 1 FROM treatment_categories c JOIN d ON c.parent_id = d.id WHERE d.h < 20
  ) SELECT COALESCE(max(h), 1) INTO own_height FROM d;
  IF parent_depth + own_height > max_depth THEN
    RAISE EXCEPTION 'Kan niet: maximaal % lagen groepen', max_depth USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_menu_depth BEFORE INSERT OR UPDATE OF parent_id ON public.treatment_categories FOR EACH ROW EXECUTE FUNCTION public.guard_menu_depth();

CREATE OR REPLACE FUNCTION public.menu_reorder(_parent uuid, _items jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE it jsonb; i int := 0;
BEGIN
  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    IF it->>'k' = 'g' THEN
      UPDATE treatment_categories SET sort = i WHERE id = (it->>'id')::uuid AND parent_id IS NOT DISTINCT FROM _parent AND sort <> i;
    ELSIF _parent IS NULL THEN
      UPDATE treatment_menu_root SET sort = i WHERE treatment_id = (it->>'id')::uuid AND tenant_id = current_tenant() AND sort <> i;
    ELSE
      UPDATE treatment_category_links SET sort = i WHERE treatment_id = (it->>'id')::uuid AND category_id = _parent AND sort <> i;
    END IF;
    i := i + 1;
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.menu_reorder(uuid, jsonb) TO authenticated;

UPDATE public.treatment_category_links l SET sort = l.sort + 1000
  WHERE EXISTS (SELECT 1 FROM public.treatment_categories c WHERE c.parent_id = l.category_id);

ALTER TABLE public.settings DROP CONSTRAINT settings_input_type_check;
ALTER TABLE public.settings ADD CONSTRAINT settings_input_type_check CHECK (input_type = ANY (ARRAY['select','text','email','tel','hidden','icon']));

INSERT INTO public.settings (tenant_id, key, section, section_sort, label, help, input_type, options, value, sort)
SELECT t.id, 'menu_max_depth', 'booking', 0, 'Maximaal aantal lagen groepen', 'Geldt voor het menu van de online agenda.', 'select',
  '[{"label":"1 laag","value":1},{"label":"2 lagen","value":2},{"label":"3 lagen","value":3},{"label":"4 lagen","value":4}]'::jsonb, '3'::jsonb, 7
FROM public.tenants t WHERE NOT EXISTS (SELECT 1 FROM public.settings s WHERE s.tenant_id = t.id AND s.key = 'menu_max_depth');
INSERT INTO public.settings (tenant_id, key, section, section_sort, label, help, input_type, options, value, sort)
SELECT t.id, 'menu_default_icon', 'general', 0, 'Standaardicoon', 'Voor groepen en behandelingen in de eerste laag zonder eigen icoon.', 'icon',
  '[]'::jsonb, '"ui:blad"'::jsonb, 2
FROM public.tenants t WHERE NOT EXISTS (SELECT 1 FROM public.settings s WHERE s.tenant_id = t.id AND s.key = 'menu_default_icon');