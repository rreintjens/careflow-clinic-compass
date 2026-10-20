-- EPD v0.1 fase 2: consultstappen, recepten, foto's, labels en statushistorie.

ALTER TABLE public.consult_notes ADD COLUMN step_data jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.patients ADD COLUMN labels text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.patients ADD COLUMN online_booking_blocked boolean NOT NULL DEFAULT false;

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('held','booked','cancelled','released','expired','gearriveerd','in_behandeling','klaar_voor_betaling','afgerond','no_show','tentatief'));
ALTER TABLE public.appointments ADD COLUMN kind text;
ALTER TABLE public.appointments ADD COLUMN reception_note text;

CREATE TABLE public.appointment_status_history(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  from_status text, to_status text NOT NULL,
  changed_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT ON public.appointment_status_history TO authenticated; GRANT ALL ON public.appointment_status_history TO service_role;
ALTER TABLE public.appointment_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY status_history_read ON public.appointment_status_history FOR SELECT TO authenticated
  USING(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('agenda.view'));
CREATE POLICY status_history_insert ON public.appointment_status_history FOR INSERT TO authenticated
  WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2());

CREATE OR REPLACE FUNCTION public.log_appointment_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.appointment_status_history(tenant_id, appointment_id, from_status, to_status, changed_by)
    VALUES (NEW.tenant_id, NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER appointments_status_history AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.log_appointment_status();

CREATE TABLE public.address_book(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  kind text NOT NULL CHECK (kind IN ('huisarts','apotheek','noodcontact')),
  name text NOT NULL, city text NOT NULL DEFAULT '', send_channel text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.address_book TO authenticated; GRANT ALL ON public.address_book TO service_role;
ALTER TABLE public.address_book ENABLE ROW LEVEL SECURITY;
CREATE POLICY address_read ON public.address_book FOR SELECT TO authenticated
  USING(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.view'));
CREATE POLICY address_write ON public.address_book FOR INSERT TO authenticated
  WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.edit'));
CREATE POLICY address_update ON public.address_book FOR UPDATE TO authenticated
  USING(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.edit'))
  WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.edit'));
CREATE TRIGGER address_touch BEFORE UPDATE ON public.address_book FOR EACH ROW EXECUTE FUNCTION public.touch_updated();
CREATE TRIGGER address_audit AFTER INSERT OR UPDATE OR DELETE ON public.address_book FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TABLE public.prescriptions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  consult_note_id uuid NOT NULL REFERENCES public.consult_notes(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  medication text NOT NULL, r_text text NOT NULL DEFAULT '', s_text text NOT NULL DEFAULT '',
  pharmacy_id uuid REFERENCES public.address_book(id),
  signature text, signed_by uuid, signed_at timestamptz,
  status text NOT NULL DEFAULT 'concept' CHECK (status IN ('concept','verstuurd','ontvangen','klaargezet','verzonden','ingetrokken')),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid,
  FOREIGN KEY(tenant_id,patient_id) REFERENCES public.patients(tenant_id,id));
GRANT SELECT,INSERT,UPDATE ON public.prescriptions TO authenticated; GRANT ALL ON public.prescriptions TO service_role;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY prescription_read ON public.prescriptions FOR SELECT TO authenticated
  USING(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.medical'));
CREATE POLICY prescription_insert ON public.prescriptions FOR INSERT TO authenticated
  WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.medical'));
CREATE POLICY prescription_update ON public.prescriptions FOR UPDATE TO authenticated
  USING(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.medical'))
  WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.medical'));
CREATE TRIGGER prescription_touch BEFORE UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated();
CREATE TRIGGER prescription_audit AFTER INSERT OR UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TABLE public.consult_photos(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  consult_note_id uuid NOT NULL REFERENCES public.consult_notes(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  slot text NOT NULL DEFAULT 'tijdens',
  image text NOT NULL,
  shared_with_patient boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
  FOREIGN KEY(tenant_id,patient_id) REFERENCES public.patients(tenant_id,id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.consult_photos TO authenticated; GRANT ALL ON public.consult_photos TO service_role;
ALTER TABLE public.consult_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY photo_read ON public.consult_photos FOR SELECT TO authenticated
  USING(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.medical'));
CREATE POLICY photo_write ON public.consult_photos FOR INSERT TO authenticated
  WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.medical'));
CREATE POLICY photo_update ON public.consult_photos FOR UPDATE TO authenticated
  USING(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.medical'))
  WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.medical'));
CREATE TRIGGER photo_audit AFTER INSERT OR UPDATE OR DELETE ON public.consult_photos FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TABLE public.photo_upload_tokens(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id),
  consult_note_id uuid NOT NULL REFERENCES public.consult_notes(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  slot text NOT NULL DEFAULT 'tijdens',
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid());
GRANT SELECT,INSERT ON public.photo_upload_tokens TO authenticated; GRANT ALL ON public.photo_upload_tokens TO service_role;
ALTER TABLE public.photo_upload_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY upload_token_read ON public.photo_upload_tokens FOR SELECT TO authenticated
  USING(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.medical'));
CREATE POLICY upload_token_insert ON public.photo_upload_tokens FOR INSERT TO authenticated
  WITH CHECK(tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('patients.medical'));

ALTER TABLE public.treatments
  ADD COLUMN price_cents integer, ADD COLUMN price_per text, ADD COLUMN btw_rate text,
  ADD COLUMN vat_exemption_possible boolean NOT NULL DEFAULT false,
  ADD COLUMN material_brand text, ADD COLUMN material_unit text,
  ADD COLUMN lot_required boolean NOT NULL DEFAULT false, ADD COLUMN supplier text,
  ADD COLUMN reminder_days integer, ADD COLUMN online_booking text NOT NULL DEFAULT 'bookable';

INSERT INTO public.option_lists(list_key,value,label_nl,label_en,sort) VALUES
('icd10','E66.0','Obesitas door te veel calorieën','Obesity due to excess calories',0),
('icd10','E66.9','Obesitas, niet gespecificeerd','Obesity, unspecified',1),
('icd10','E10','Diabetes mellitus type 1','Type 1 diabetes mellitus',2),
('icd10','E11','Diabetes mellitus type 2','Type 2 diabetes mellitus',3),
('icd10','I10','Essentiële hypertensie','Essential hypertension',4),
('icd10','L90.5','Litteken van de huid','Scar conditions of skin',5),
('icd10','L70','Acne','Acne',6),
('icd10','G43','Migraine','Migraine',7),
('icd10','R51','Hoofdpijn','Headache',8),
('icd10','Z00.0','Algemene medische keuring','General medical examination',9),
('secure_mail_channel','zorgmail','Zorgmail','Zorgmail',0),
('secure_mail_channel','zivver','Zivver','Zivver',1),
('secure_mail_channel','none','Niet versturen','Do not send',2),
('patient_label','niet_welkom','Niet welkom','Not welcome',0),
('patient_label','online_boeken_uit','Online boeken uit','Online booking off',1),
('patient_label','allergie_lidocaine','Allergie: lidocaïne','Allergy: lidocaine',2),
('prescription_status','concept','Concept','Draft',0),
('prescription_status','verstuurd','Verstuurd naar apotheek','Sent to pharmacy',1),
('prescription_status','ontvangen','Ontvangen door apotheek','Received by pharmacy',2),
('prescription_status','klaargezet','Klaargezet (wacht op betaling pakket)','Prepared (awaiting package payment)',3),
('prescription_status','verzonden','Verzonden','Shipped',4),
('prescription_status','ingetrokken','Ingetrokken','Withdrawn',5),
('cancel_reason','op_tijd','Op tijd geannuleerd','Cancelled in time',0),
('cancel_reason','te_laat','Te laat geannuleerd','Cancelled too late',1),
('cancel_reason','door_kliniek','Door de kliniek geannuleerd','Cancelled by clinic',2),
('cancel_reason','vooruitbetaling','Vooruitbetaling niet voldaan','Prepayment not met',3),
('material_unit','zones','Zones','Zones',0),
('material_unit','ml','Milliliter','Millilitre',1),
('material_unit','eenheden','Eenheden','Units',2),
('material_brand','botox','Botox','Botox',0),
('material_brand','relfydess','Relfydess','Relfydess',1),
('material_brand','juvederm','Juvéderm','Juvéderm',2),
('material_supplier','allergan','Allergan','Allergan',0),
('material_supplier','galderma','Galderma','Galderma',1)
ON CONFLICT DO NOTHING;

INSERT INTO public.option_lists(list_key,value,label_nl,sort) VALUES
('soep_template','Consulten','Patiënt komt voor een eerste consult. Wensen en verwachtingen besproken.',0),
('soep_template','Consulten','Geen contra-indicaties gevonden in de anamnese.',1),
('soep_template','Botox','Behandeling goed verdragen, geen complicaties opgetreden.',2),
('soep_template','Botox','Gebied ontsmet en gemarkeerd volgens protocol.',3)
ON CONFLICT DO NOTHING;

INSERT INTO public.option_lists(list_key,value,label_nl,sort) VALUES
('gp_letter_template','standaard','Geachte collega,

Uw patiënt {patient} was op {datum} bij ons voor {behandeling}.

Diagnose: {diagnose}
Behandeling: {behandeling}
Medicatie: {medicatie}

Met vriendelijke groet,
{arts}',0)
ON CONFLICT DO NOTHING;

INSERT INTO public.address_book(tenant_id,kind,name,city,send_channel,phone)
SELECT t.id, x.kind, x.name, x.city, x.send_channel, x.phone FROM public.tenants t
CROSS JOIN (VALUES
  ('apotheek','De Regio Apotheek','Utrecht','apotheekroute','030-1234567'),
  ('huisarts','Huisartsenpraktijk Centrum','Utrecht','zorgmail','030-7654321')
) AS x(kind,name,city,send_channel,phone)
WHERE t.slug='tbc-nl';

UPDATE public.treatments SET price_cents=9500, price_per='consult', btw_rate='0', vat_exemption_possible=true, online_booking='bookable'
  WHERE slug='consult-medisch-afvallen';
UPDATE public.treatments SET price_cents=14500, price_per='zone', btw_rate='21', material_brand='botox', material_unit='zones', lot_required=true, supplier='allergan', reminder_days=120
  WHERE slug='fronsrimpels';