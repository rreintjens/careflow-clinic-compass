-- Feedback op behandelingen (patiënt → arts/kliniek)
CREATE TABLE public.treatment_feedback (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id), appointment_id uuid NOT NULL REFERENCES public.appointments(id), patient_id uuid NOT NULL, practitioner_id uuid REFERENCES public.practitioners(id), rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5), tags text[] NOT NULL DEFAULT '{}', comment text NOT NULL DEFAULT '', share_with_practitioner boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_by uuid, UNIQUE(appointment_id), FOREIGN KEY(tenant_id,patient_id) REFERENCES public.patients(tenant_id,id));
GRANT SELECT, INSERT ON public.treatment_feedback TO authenticated; GRANT ALL ON public.treatment_feedback TO service_role;
ALTER TABLE public.treatment_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY feedback_patient_own ON public.treatment_feedback FOR SELECT TO authenticated USING(tenant_id=public.current_tenant() AND patient_id=public.portal_patient_id());
CREATE POLICY feedback_patient_insert ON public.treatment_feedback FOR INSERT TO authenticated WITH CHECK(tenant_id=public.current_tenant() AND patient_id=public.portal_patient_id());
CREATE POLICY feedback_staff_read ON public.treatment_feedback FOR SELECT TO authenticated USING(tenant_id=public.current_tenant() AND public.is_staff());

-- Behandelinstellingen voor de portal (nazorg, traject, herinnering)
ALTER TABLE public.treatments ADD COLUMN portal_settings jsonb NOT NULL DEFAULT '{}';

-- Boekingslink: inloggen voor bestaande patiënten tonen of niet
ALTER TABLE public.booking_links ADD COLUMN show_patient_login boolean NOT NULL DEFAULT true;

-- Patiënt leest eigen afspraken en de nooit-persoonlijke referentiedata voor de portal
CREATE POLICY portal_appointments_own ON public.appointments FOR SELECT TO authenticated USING(tenant_id=public.current_tenant() AND patient_id=public.portal_patient_id());
CREATE POLICY portal_treatments_read ON public.treatments FOR SELECT TO authenticated USING(tenant_id=public.current_tenant() AND public.portal_patient_id() IS NOT NULL);
CREATE POLICY portal_practitioners_read ON public.practitioners FOR SELECT TO authenticated USING(tenant_id=public.current_tenant() AND public.portal_patient_id() IS NOT NULL);
CREATE POLICY portal_locations_read ON public.locations FOR SELECT TO authenticated USING(tenant_id=public.current_tenant() AND public.portal_patient_id() IS NOT NULL);
CREATE POLICY portal_roles_read ON public.roles FOR SELECT TO authenticated USING(tenant_id=public.current_tenant() AND public.portal_patient_id() IS NOT NULL);
CREATE POLICY portal_categories_read ON public.treatment_categories FOR SELECT TO authenticated USING(tenant_id=public.current_tenant() AND public.portal_patient_id() IS NOT NULL);
CREATE POLICY portal_category_links_read ON public.treatment_category_links FOR SELECT TO authenticated USING(tenant_id=public.current_tenant() AND public.portal_patient_id() IS NOT NULL);

-- Demo-afspraken (testdata): Sanne cosmetisch, Mark/Eva medisch afvallen, Sandra starter
INSERT INTO public.appointments(tenant_id,patient_id,treatment_id,practitioner_id,location_id,starts_at,ends_at,status,source) VALUES
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000001','6bfa2267-5ab1-4834-b832-dfac340cc2b1','64b32bef-86c1-41d9-8879-26482509c89f','82db04b2-38d7-4226-b201-11434d87b8a8','2025-10-02 09:00+02','2025-10-02 09:45+02','booked','online'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000001','cf52e732-c386-42d8-9f51-7f2e59e69776','64b32bef-86c1-41d9-8879-26482509c89f','82db04b2-38d7-4226-b201-11434d87b8a8','2025-11-20 10:00+01','2025-11-20 10:45+01','booked','online'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000001','33859c8d-2a01-4cde-8f18-98cd9edacb71','8a40943c-adb2-4ab6-8521-d6bac733df82','82db04b2-38d7-4226-b201-11434d87b8a8','2026-02-01 11:00+01','2026-02-01 11:30+01','booked','online'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000001','9b3940e9-29a2-45c0-b1ae-b9f59b511ec3','8a40943c-adb2-4ab6-8521-d6bac733df82','82db04b2-38d7-4226-b201-11434d87b8a8','2026-03-15 14:00+01','2026-03-15 14:30+01','booked','online'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000001','33859c8d-2a01-4cde-8f18-98cd9edacb71','8a40943c-adb2-4ab6-8521-d6bac733df82','82db04b2-38d7-4226-b201-11434d87b8a8','2026-07-05 10:30+02','2026-07-05 11:00+02','booked','online'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000001','901eeb33-d1b5-4fc6-a15b-dd74d88a5c75','e773a538-4f88-4d46-bb45-1973209c579e','82db04b2-38d7-4226-b201-11434d87b8a8','2026-10-08 09:30+02','2026-10-08 10:15+02','booked','online'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000001','901eeb33-d1b5-4fc6-a15b-dd74d88a5c75','e773a538-4f88-4d46-bb45-1973209c579e','82db04b2-38d7-4226-b201-11434d87b8a8','2026-10-24 14:00+02','2026-10-24 14:45+02','booked','online'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000002','33859c8d-2a01-4cde-8f18-98cd9edacb71','8a40943c-adb2-4ab6-8521-d6bac733df82','82db04b2-38d7-4226-b201-11434d87b8a8','2025-12-10 15:00+01','2025-12-10 15:30+01','booked','online'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000002','6bfa2267-5ab1-4834-b832-dfac340cc2b1','64b32bef-86c1-41d9-8879-26482509c89f','82db04b2-38d7-4226-b201-11434d87b8a8','2025-09-15 09:00+02','2025-09-15 09:45+02','booked','online'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000002','865257ba-2dd8-4f0b-839c-eba7c329228b','952b8cc7-f653-4a4e-aa49-7ee28b0a377e','82db04b2-38d7-4226-b201-11434d87b8a8','2026-07-28 10:00+02','2026-07-28 10:30+02','booked','online'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000002','2051d89a-f4d3-452c-bff8-4f4fa2d68ebc','952b8cc7-f653-4a4e-aa49-7ee28b0a377e','82db04b2-38d7-4226-b201-11434d87b8a8','2026-09-01 10:00+02','2026-09-01 10:20+02','booked','online'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000002','2051d89a-f4d3-452c-bff8-4f4fa2d68ebc','952b8cc7-f653-4a4e-aa49-7ee28b0a377e','82db04b2-38d7-4226-b201-11434d87b8a8','2026-10-27 10:00+01','2026-10-27 10:20+01','booked','online'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000003','33859c8d-2a01-4cde-8f18-98cd9edacb71','8a40943c-adb2-4ab6-8521-d6bac733df82','82db04b2-38d7-4226-b201-11434d87b8a8','2026-03-01 11:00+01','2026-03-01 11:30+01','booked','online'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000004','865257ba-2dd8-4f0b-839c-eba7c329228b','586f4248-6c1f-4479-87c0-d88d689de06e','82db04b2-38d7-4226-b201-11434d87b8a8','2026-10-22 09:00+02','2026-10-22 09:30+02','booked','online');

-- Meetreeks voor de gewichtsgrafiek (Mark en Eva)
INSERT INTO public.measurements(tenant_id,patient_id,measured_on,weight_kg,height_cm,source) VALUES
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000002','2026-08-01',102.4,175,'staff'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000002','2026-09-01',100.1,175,'staff'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000002','2026-10-01',97.8,175,'staff'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000003','2026-05-02',100,170,'staff'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000003','2026-06-01',96.5,170,'staff'),
('75f25a40-9ec2-4c90-b829-b91918cf14df','a0000000-0000-4000-8000-000000000003','2026-07-01',93.2,170,'staff');

-- Behandelinstellingen voor de demo
UPDATE public.treatments SET portal_settings='{"course_count":3,"course_interval":"Meestal drie behandelingen, met vier tot zes weken ertussen.","aftercare_days":7,"reminder_weeks":0,"aftercare_tips":["Houd de huid de eerste 24 uur schoon en rustig.","Vermijd zon en sauna de eerste dagen.","Gebruik elke dag SPF 50."]}' WHERE id='901eeb33-d1b5-4fc6-a15b-dd74d88a5c75';
UPDATE public.treatments SET portal_settings='{"reminder_weeks":12,"aftercare_days":3,"aftercare_tips":["Niet masseren of liggen de eerste 4 uur.","Geen intensieve sport op de dag van de behandeling."]}' WHERE id='33859c8d-2a01-4cde-8f18-98cd9edacb71';
UPDATE public.treatments SET portal_settings='{"reminder_weeks":16,"aftercare_days":3,"aftercare_tips":["Koel de lippen als ze opzwellen.","Niet masseren de eerste week."]}' WHERE id='9b3940e9-29a2-45c0-b1ae-b9f59b511ec3';

-- Portalteksten en prijsconfiguratie (placeholders)
UPDATE public.portal_config SET content=content||'{"yourDoctor":"Jouw arts","visitsLine":"Je was {n} keer bij {voornaam}, laatst op {datum}","planWith":"Plan een afspraak bij {voornaam}","alsoYour":"Ook jouw {rol}","plan":"Plan","courseLabel":"Je behandeltraject","ofTreatments":"behandelingen","nextTreatment":"Volgende behandeling, {x} van {n}","feedbackTitle":"Hoe was je behandeling?","feedbackGoesTo":"Je reactie gaat naar {voornaam} en de kliniek","rebookTitle":"Opnieuw boeken","rebook":"Boek opnieuw","weeksAgo":"{n} weken geleden","viewAllHistory":"Bekijk al je {n} behandelingen","discoverTitle":"Bekijk deze behandelingen eens","moreInfo":"Meer weten","historyTitle":"Historie","historySub":"Alle behandelingen die je bij ons hebt gehad, met je behandelaar.","filterAll":"Alle","treatedBy":"Behandeld door","bigRegistered":"BIG-geregistreerd","aftercare":"Nazorg","invoice":"Factuur","view":"Bekijk","replanWith":"Opnieuw plannen bij {voornaam}","askQuestion":"Stel een vraag","nextAppointment":"Je volgende afspraak","reschedule":"Verzetten","againWithPractitioner":"Opnieuw bij je behandelaar","orChooseTreatment":"Of kies een behandeling","ratingLabels":["Slecht","Matig","Redelijk","Goed","Uitstekend"],"whatWentWell":"Wat ging goed?","feedbackTags":["Uitleg vooraf","Resultaat","Aandacht","Op tijd","Nazorg"],"anythingElse":"Wil je nog iets kwijt?","anythingElseHint":"Bijvoorbeeld wat je anders zou willen of wat je fijn vond.","mayRead":"{voornaam} mag je reactie lezen","mayReadSub":"Anders ziet alleen de kliniek hem","sendFeedback":"Verstuur","feedbackNote":"Je reactie hoort bij deze behandeling bij {voornaam}.","feedbackThanks":"Bedankt voor je reactie!","prices":{"strengths":[2.5,5,7.5,10,12.5,15],"base":[219,239,259,279,299,319],"discount":{"1":0,"2":10,"3":20,"6":30}}}'::jsonb WHERE tenant_id='75f25a40-9ec2-4c90-b829-b91918cf14df';