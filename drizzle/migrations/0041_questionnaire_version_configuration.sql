ALTER TABLE public.questionnaire_versions ADD COLUMN version_config jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE public.questionnaire_versions v SET version_config = jsonb_build_object('settings', coalesce(f.document->'settings','{}'::jsonb), 'computed_fields', coalesce(f.document->'computed_fields','{}'::jsonb), 'field_names', coalesce(f.document->'field_names','{}'::jsonb)) FROM public.questionnaires q JOIN public.questionnaire_flows f ON f.id = q.flow_id WHERE v.questionnaire_id = q.id;
CREATE OR REPLACE FUNCTION public.freeze_published_version() RETURNS trigger LANGUAGE plpgsql SET search_path TO public AS $$ BEGIN
 IF OLD.status <> 'draft' AND (NEW.definition IS DISTINCT FROM OLD.definition OR NEW.version_config IS DISTINCT FROM OLD.version_config OR NEW.version_no <> OLD.version_no) THEN RAISE EXCEPTION 'A published or archived questionnaire version cannot be changed'; END IF;
 IF OLD.status = 'archived' AND NEW.status <> 'archived' THEN RAISE EXCEPTION 'An archived version stays archived'; END IF;
 RETURN NEW; END $$;
COMMENT ON COLUMN public.questionnaire_versions.version_config IS 'Version-owned settings, computed fields and display names; immutable after publication.';