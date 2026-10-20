ALTER TABLE public.appointments ADD COLUMN equipment_ids uuid[] NOT NULL DEFAULT '{}', ADD COLUMN notification_plan jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.appointment_status_history ADD COLUMN reason text, ADD COLUMN note text;
DROP POLICY IF EXISTS status_history_insert ON public.appointment_status_history;
CREATE OR REPLACE FUNCTION public.log_appointment_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status THEN
 INSERT INTO public.appointment_status_history(tenant_id,appointment_id,from_status,to_status,changed_by,reason,note) VALUES(NEW.tenant_id,NEW.id,OLD.status,NEW.status,auth.uid(),NEW.cancel_reason,NEW.reception_note);
 END IF; RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.refuse_external_busy_overlap() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IN ('held','booked','tentatief','gearriveerd','in_behandeling','klaar_voor_betaling','afgerond') AND EXISTS(SELECT 1 FROM public.external_busy_periods b WHERE b.tenant_id=NEW.tenant_id AND b.practitioner_id=NEW.practitioner_id AND b.starts_at<NEW.ends_at AND NEW.starts_at<b.ends_at) AND (TG_OP='INSERT' OR NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at OR NEW.practitioner_id IS DISTINCT FROM OLD.practitioner_id OR OLD.status IN ('cancelled','no_show','expired','released')) THEN RAISE EXCEPTION 'Deze behandelaar is op dit moment bezet in eKis. Kies een ander moment.'; END IF; RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.protect_appointment_resources() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status NOT IN ('held','booked','tentatief','gearriveerd','in_behandeling','klaar_voor_betaling','afgerond') OR (NEW.status='held' AND NEW.hold_expires_at<=now()) THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.starts_at=OLD.starts_at AND NEW.ends_at=OLD.ends_at AND NEW.practitioner_id=OLD.practitioner_id AND NEW.room_id IS NOT DISTINCT FROM OLD.room_id AND NEW.equipment_ids=OLD.equipment_ids AND OLD.status IN ('held','booked','tentatief','gearriveerd','in_behandeling','klaar_voor_betaling','afgerond') THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text,0));
 IF NEW.room_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.rooms r WHERE r.id=NEW.room_id AND r.tenant_id=NEW.tenant_id AND r.location_id=NEW.location_id) THEN RAISE EXCEPTION 'De kamer hoort niet bij deze locatie.'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(NEW.equipment_ids) eid WHERE NOT EXISTS(SELECT 1 FROM public.equipment e WHERE e.id=eid AND e.tenant_id=NEW.tenant_id)) THEN RAISE EXCEPTION 'Ongeldig apparaat.'; END IF;
 IF EXISTS(SELECT 1 FROM public.appointments a WHERE a.tenant_id=NEW.tenant_id AND a.id<>NEW.id AND a.starts_at<NEW.ends_at AND NEW.starts_at<a.ends_at AND (a.status IN ('booked','tentatief','gearriveerd','in_behandeling','klaar_voor_betaling','afgerond') OR (a.status='held' AND a.hold_expires_at>now())) AND (a.practitioner_id=NEW.practitioner_id OR (NEW.room_id IS NOT NULL AND a.room_id=NEW.room_id) OR a.equipment_ids&&NEW.equipment_ids)) THEN RAISE EXCEPTION 'Behandelaar, kamer of apparaat is al bezet. Kies een ander moment.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER appointments_resource_protection BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.protect_appointment_resources();
CREATE OR REPLACE FUNCTION public.consult_updates_appointment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.appointment_id IS NOT NULL AND NEW.status='draft' THEN UPDATE public.appointments SET status='in_behandeling' WHERE id=NEW.appointment_id AND tenant_id=NEW.tenant_id AND status IN ('booked','gearriveerd'); END IF; RETURN NEW;
END $$;
CREATE TRIGGER consult_appointment_status AFTER INSERT OR UPDATE OF status ON public.consult_notes FOR EACH ROW EXECUTE FUNCTION public.consult_updates_appointment();
CREATE OR REPLACE FUNCTION public.appointment_status_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status THEN INSERT INTO public.audit_log(tenant_id,user_id,action,category,record_type,record_id,details) VALUES(NEW.tenant_id,auth.uid(),'appointment_status_changed','appointment','appointment',NEW.id,jsonb_build_object('omschrijving','Afspraakstatus gewijzigd van '||OLD.status||' naar '||NEW.status,'van',OLD.status,'naar',NEW.status)); END IF; RETURN NEW;
END $$;
CREATE TRIGGER appointment_readable_status_audit AFTER UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.appointment_status_audit();