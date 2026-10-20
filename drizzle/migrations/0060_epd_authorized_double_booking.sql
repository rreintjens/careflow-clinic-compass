ALTER TABLE public.appointments ADD COLUMN double_book_reason text;
CREATE OR REPLACE FUNCTION public.protect_appointment_resources() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE allow_double boolean;
BEGIN
 IF NEW.status NOT IN ('held','booked','tentatief','gearriveerd','in_behandeling','klaar_voor_betaling','afgerond') OR (NEW.status='held' AND NEW.hold_expires_at<=now()) THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.starts_at=OLD.starts_at AND NEW.ends_at=OLD.ends_at AND NEW.practitioner_id=OLD.practitioner_id AND NEW.room_id IS NOT DISTINCT FROM OLD.room_id AND NEW.equipment_ids=OLD.equipment_ids AND OLD.status IN ('held','booked','tentatief','gearriveerd','in_behandeling','klaar_voor_betaling','afgerond') THEN RETURN NEW; END IF;
 allow_double := auth.uid() IS NOT NULL AND public.is_aal2() AND public.has_permission('agenda.double_book') AND length(trim(coalesce(NEW.double_book_reason,'')))>0;
 IF NEW.double_book_reason IS NOT NULL AND NOT allow_double THEN RAISE EXCEPTION 'Dubbel boeken vereist toestemming en een reden.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text,0));
 IF NEW.room_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.rooms r WHERE r.id=NEW.room_id AND r.tenant_id=NEW.tenant_id AND r.location_id=NEW.location_id) THEN RAISE EXCEPTION 'De kamer hoort niet bij deze locatie.'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(NEW.equipment_ids) eid WHERE NOT EXISTS(SELECT 1 FROM public.equipment e WHERE e.id=eid AND e.tenant_id=NEW.tenant_id)) THEN RAISE EXCEPTION 'Ongeldig apparaat.'; END IF;
 IF EXISTS(SELECT 1 FROM public.appointments a WHERE a.tenant_id=NEW.tenant_id AND a.id<>NEW.id AND a.starts_at<NEW.ends_at AND NEW.starts_at<a.ends_at AND (a.status IN ('booked','tentatief','gearriveerd','in_behandeling','klaar_voor_betaling','afgerond') OR (a.status='held' AND a.hold_expires_at>now())) AND ((a.practitioner_id=NEW.practitioner_id AND NOT allow_double) OR (NEW.room_id IS NOT NULL AND a.room_id=NEW.room_id) OR a.equipment_ids&&NEW.equipment_ids)) THEN RAISE EXCEPTION 'Behandelaar, kamer of apparaat is al bezet. Kies een ander moment.'; END IF;
 IF allow_double THEN INSERT INTO public.audit_log(tenant_id,user_id,role_key,action,category,record_type,record_id,details) VALUES(NEW.tenant_id,auth.uid(),public.current_role_key(),'appointment_double_booked','changed','appointments',NEW.id,jsonb_build_object('reason',NEW.double_book_reason,'omschrijving','Dubbel geboekt met toestemming')); END IF;
 RETURN NEW;
END $$;