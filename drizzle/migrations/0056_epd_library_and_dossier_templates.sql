INSERT INTO public.permissions(key,group_label,label,sort) VALUES
('dossier_templates.manage','Dossier','Dossiersjablonen beheren',300),
('library.manage','Dossier','Vragenbibliotheek beheren',301),
('labels.manage','Patiënten','Labels beheren',302),
('agenda.double_book','Agenda','Dubbel boeken',303),
('dossier.delete','Dossier','Dossier verwijderen',304),
('billing.close_without_invoice','Kassa','Sluiten zonder factuur',305),
('billing.till','Kassa','Kassa',306),
('prescription.sign','Dossier','Recept ondertekenen',307),
('vat.exemption','Dossier','Btw-vrijstelling vastleggen',308)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions(role_id,permission_key,tenant_id)
SELECT r.id,p.key,r.tenant_id FROM public.roles r CROSS JOIN public.permissions p
WHERE p.key IN ('dossier_templates.manage','library.manage','labels.manage','agenda.double_book','dossier.delete','billing.close_without_invoice','billing.till')
  AND r.key IN ('superadmin','admin') AND NOT (p.key='dossier.delete' AND r.key<>'superadmin')
ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions(role_id,permission_key,tenant_id)
SELECT r.id,p.key,r.tenant_id FROM public.roles r CROSS JOIN public.permissions p
WHERE p.key IN ('prescription.sign','vat.exemption') AND r.key='arts' ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions(role_id,permission_key,tenant_id)
SELECT r.id,'billing.till',r.tenant_id FROM public.roles r WHERE r.key='customer_care' ON CONFLICT DO NOTHING;

INSERT INTO public.option_lists(list_key,value,label_nl,label_en,sort) VALUES
('library_question_type','yes_no','Ja/nee','Yes/no',0),
('library_question_type','yes_no_note','Ja/nee met toelichting','Yes/no with note',1),
('library_question_type','choice','Keuzelijst','Choice',2),
('library_question_type','multi','Keuzelijst meerdere','Multiple choice',3),
('library_question_type','number','Getal','Number',4),
('library_question_type','text_template','Tekst met sjabloon','Text with template',5),
('library_question_type','discussion','Bespreekpunt','Discussion point',6),
('library_question_group','anamnese','Anamnese','Anamnesis',0),
('library_question_group','fiscaal','Fiscaal','Fiscal',1),
('library_question_group','controle','Controle','Check',2),
('library_question_group','bespreekpunt','Bespreekpunt','Discussion point',3),
('library_condition_field','sex_at_birth','Geslacht bij geboorte',NULL,0),
('library_condition_value','female','Vrouw',NULL,0),
('library_condition_value','male','Man',NULL,1),
('dossier_step','medische_status','Medische status',NULL,0),
('dossier_step','anamnese','Anamnese',NULL,1),
('dossier_step','diagnose','Diagnose en besproken',NULL,2),
('dossier_step','plan_recept','Plan en recept',NULL,3),
('dossier_step','behandeling','Behandeling',NULL,4),
('dossier_step','afronden','Afronden',NULL,5),
('reask_days','0','Elke keer opnieuw',NULL,0),
('reask_days','90','Na 90 dagen',NULL,1),
('reask_days','180','Na 180 dagen',NULL,2),
('reask_days','365','Na 365 dagen',NULL,3),
('resign_months','6','Na 6 maanden',NULL,0),
('resign_months','12','Na 12 maanden',NULL,1),
('resign_months','24','Na 24 maanden',NULL,2),
('reminder_days','0','Geen',NULL,0),
('reminder_days','60','60 dagen',NULL,1),
('reminder_days','90','90 dagen',NULL,2),
('reminder_days','120','120 dagen',NULL,3),
('reminder_days','180','180 dagen',NULL,4)
ON CONFLICT DO NOTHING;

CREATE TABLE public.library_questions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
 code text NOT NULL, text_nl text NOT NULL, text_en text,
 qtype text NOT NULL, grp text NOT NULL,
 options jsonb NOT NULL DEFAULT '[]'::jsonb,
 condition jsonb,
 is_example boolean NOT NULL DEFAULT false,
 sort integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid,
 UNIQUE(tenant_id,code));
GRANT SELECT,INSERT,UPDATE ON public.library_questions TO authenticated; GRANT ALL ON public.library_questions TO service_role;
ALTER TABLE public.library_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY library_read ON public.library_questions FOR SELECT TO authenticated USING(tenant_id=public.current_tenant() AND public.is_aal2() AND (public.has_permission('library.manage') OR public.has_permission('patients.medical') OR public.has_permission('questionnaires.view') OR public.has_permission('dossier_templates.manage')));
CREATE POLICY library_insert ON public.library_questions FOR INSERT TO authenticated WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('library.manage'));
CREATE POLICY library_update ON public.library_questions FOR UPDATE TO authenticated USING(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('library.manage')) WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('library.manage'));
CREATE TRIGGER library_touch BEFORE UPDATE ON public.library_questions FOR EACH ROW EXECUTE FUNCTION public.touch_updated();
CREATE TRIGGER library_audit AFTER INSERT OR UPDATE ON public.library_questions FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TABLE public.dossier_templates(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
 category_id uuid NOT NULL REFERENCES public.treatment_categories(id),
 name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid,
 UNIQUE(tenant_id,category_id));
GRANT SELECT,INSERT,UPDATE ON public.dossier_templates TO authenticated; GRANT ALL ON public.dossier_templates TO service_role;
ALTER TABLE public.dossier_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY templates_read ON public.dossier_templates FOR SELECT TO authenticated USING(tenant_id=public.current_tenant() AND public.is_aal2() AND (public.has_permission('dossier_templates.manage') OR public.has_permission('patients.medical') OR public.has_permission('library.manage')));
CREATE POLICY templates_insert ON public.dossier_templates FOR INSERT TO authenticated WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('dossier_templates.manage'));
CREATE POLICY templates_update ON public.dossier_templates FOR UPDATE TO authenticated USING(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('dossier_templates.manage')) WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('dossier_templates.manage'));
CREATE TRIGGER templates_touch BEFORE UPDATE ON public.dossier_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated();
CREATE TRIGGER templates_audit AFTER INSERT OR UPDATE ON public.dossier_templates FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TABLE public.dossier_template_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
 template_id uuid NOT NULL REFERENCES public.dossier_templates(id) ON DELETE CASCADE,
 version integer NOT NULL,
 status text NOT NULL CHECK(status IN ('concept','live','archived')),
 content jsonb NOT NULL DEFAULT '{}'::jsonb,
 change_note text,
 published_at timestamptz, published_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid,
 UNIQUE(template_id,version));
CREATE UNIQUE INDEX dossier_template_one_concept ON public.dossier_template_versions(template_id) WHERE status='concept';
CREATE UNIQUE INDEX dossier_template_one_live ON public.dossier_template_versions(template_id) WHERE status='live';
GRANT SELECT,INSERT,UPDATE ON public.dossier_template_versions TO authenticated; GRANT ALL ON public.dossier_template_versions TO service_role;
ALTER TABLE public.dossier_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tversions_read ON public.dossier_template_versions FOR SELECT TO authenticated USING(tenant_id=public.current_tenant() AND public.is_aal2() AND (public.has_permission('dossier_templates.manage') OR public.has_permission('patients.medical') OR public.has_permission('library.manage')));
CREATE POLICY tversions_insert ON public.dossier_template_versions FOR INSERT TO authenticated WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND (public.has_permission('dossier_templates.manage') OR public.has_permission('library.manage')));
CREATE POLICY tversions_update ON public.dossier_template_versions FOR UPDATE TO authenticated USING(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('dossier_templates.manage')) WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('dossier_templates.manage'));
CREATE FUNCTION public.freeze_template_version() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF OLD.status<>'concept' AND NEW.content IS DISTINCT FROM OLD.content THEN RAISE EXCEPTION 'Een gepubliceerde sjabloonversie kun je niet wijzigen'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER tversions_freeze BEFORE UPDATE ON public.dossier_template_versions FOR EACH ROW EXECUTE FUNCTION public.freeze_template_version();
CREATE TRIGGER tversions_touch BEFORE UPDATE ON public.dossier_template_versions FOR EACH ROW EXECUTE FUNCTION public.touch_updated();
CREATE TRIGGER tversions_audit AFTER INSERT OR UPDATE ON public.dossier_template_versions FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

ALTER TABLE public.treatments ADD COLUMN dossier_template_override uuid REFERENCES public.dossier_templates(id);
ALTER TABLE public.consult_notes ADD COLUMN template_version_ids uuid[] NOT NULL DEFAULT '{}';

INSERT INTO public.library_questions(tenant_id,code,text_nl,qtype,grp,options,condition,is_example,sort)
SELECT t.id, q.code, q.text_nl, q.qtype, q.grp, q.options::jsonb, q.cond::jsonb, true, q.sort FROM public.tenants t CROSS JOIN (VALUES
('L01','Wat is je hulpvraag?','text_template','anamnese','[]',NULL,1),
('L02','Heb je eerder geprobeerd af te vallen?','yes_no_note','anamnese','[]',NULL,2),
('L03','Heb je ooit een alvleesklierontsteking (pancreatitis) gehad?','yes_no','anamnese','[]',NULL,3),
('L04','Komt MTC of MEN2 voor in je familie?','yes_no','anamnese','[]',NULL,4),
('L05','Fitzpatrick-huidtype','choice','anamnese','[{"value":"1","label":"Type I"},{"value":"2","label":"Type II"},{"value":"3","label":"Type III"},{"value":"4","label":"Type IV"},{"value":"5","label":"Type V"},{"value":"6","label":"Type VI"}]',NULL,5),
('L06','Glogau-classificatie','choice','anamnese','[{"value":"1","label":"I – geen rimpels"},{"value":"2","label":"II – rimpels bij bewegen"},{"value":"3","label":"III – rimpels in rust"},{"value":"4","label":"IV – alleen rimpels"}]',NULL,6),
('L07','Ben je zwanger of geef je borstvoeding?','yes_no','anamnese','[]','{"field":"sex_at_birth","equals":"female"}',7),
('L08','Is de behandeling medisch noodzakelijk?','yes_no_note','fiscaal','[]',NULL,8),
('L09','Valt de behandeling onder de zorg van een BIG-geregistreerde arts?','yes_no','fiscaal','[]',NULL,9),
('L10','Assistent aanwezig','yes_no','controle','[]',NULL,10),
('L11','Naald gecontroleerd en afgevoerd','yes_no','controle','[]',NULL,11),
('L12','Hematoom','yes_no_note','controle','[]',NULL,12),
('L13','Verloop van de behandeling','choice','controle','[{"value":"normal","label":"Normaal"},{"value":"deviation","label":"Met afwijking"}]',NULL,13),
('L14','Werking en verwachtingen','discussion','bespreekpunt','[]',NULL,14),
('L15','Bijwerkingen en risico''s','discussion','bespreekpunt','[]',NULL,15),
('L16','Kosten en pakket','discussion','bespreekpunt','[]',NULL,16)
) AS q(code,text_nl,qtype,grp,options,cond,sort) ON CONFLICT DO NOTHING;

INSERT INTO public.dossier_templates(tenant_id,category_id,name)
SELECT c.tenant_id,c.id,CASE WHEN c.name_nl='Consulten' THEN 'Medisch afvallen › Consult' ELSE 'Injectables › Botox' END
FROM public.treatment_categories c LEFT JOIN public.treatment_categories p ON p.id=c.parent_id
WHERE (c.name_nl='Consulten' AND p.name_nl='Medisch afvallen') OR (c.name_nl='Botox' AND c.parent_id IS NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.dossier_template_versions(tenant_id,template_id,version,status,content,published_at)
SELECT d.tenant_id,d.id,1,'live', CASE WHEN d.name LIKE 'Medisch%' THEN
'{"steps":["medische_status","anamnese","diagnose","plan_recept","afronden"],"questionnaire":{"key":null,"reaskDays":180},"anamnese":["L01","L02","L03","L04"],"fiscaal":["L08","L09"],"bespreekpunt":["L14","L15","L16"],"controle":[],"diagnoses":["E66.0"],"consentForms":[],"resignMonths":12,"aftercare":"Begin rustig met de eerste dosis en drink voldoende water. Neem contact op als je aanhoudend misselijk bent.","patientNote":"","reminderDays":0,"roomKind":null}'
ELSE
'{"steps":["medische_status","anamnese","behandeling","afronden"],"questionnaire":{"key":null,"reaskDays":365},"anamnese":["L05","L06","L07"],"fiscaal":[],"bespreekpunt":["L14","L15"],"controle":["L10","L11","L12","L13"],"diagnoses":[],"consentForms":[],"resignMonths":12,"aftercare":"Ga de eerste 4 uur niet liggen en masseer het behandelde gebied niet. Sport en sauna kun je de eerste 24 uur beter overslaan.","patientNote":"","reminderDays":120,"roomKind":null}'
END::jsonb, now() FROM public.dossier_templates d;