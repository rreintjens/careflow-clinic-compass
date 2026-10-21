CREATE TABLE public.billing_counters (tenant_id uuid PRIMARY KEY DEFAULT public.current_tenant() REFERENCES public.tenants(id), last_number bigint NOT NULL DEFAULT 0);
GRANT SELECT ON public.billing_counters TO authenticated; GRANT ALL ON public.billing_counters TO service_role;
ALTER TABLE public.billing_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_counters_read ON public.billing_counters FOR SELECT TO authenticated USING (tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('billing.till'));
CREATE TABLE public.billing_settlements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL DEFAULT public.current_tenant() REFERENCES public.tenants(id), patient_id uuid NOT NULL REFERENCES public.patients(id), appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id), invoice_number text, total_cents bigint NOT NULL CHECK(total_cents>=0), vat_cents bigint NOT NULL CHECK(vat_cents>=0), lines jsonb NOT NULL, payments jsonb NOT NULL, fiscal_snapshot jsonb NOT NULL, issuer_snapshot jsonb NOT NULL, without_invoice boolean NOT NULL DEFAULT false, reason text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid(), updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid DEFAULT auth.uid(), UNIQUE(tenant_id,invoice_number), CHECK ((without_invoice AND invoice_number IS NULL AND length(trim(reason))>0) OR (NOT without_invoice AND invoice_number IS NOT NULL)));
GRANT SELECT ON public.billing_settlements TO authenticated; GRANT ALL ON public.billing_settlements TO service_role;
ALTER TABLE public.billing_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_staff_read ON public.billing_settlements FOR SELECT TO authenticated USING (tenant_id=public.current_tenant() AND public.is_aal2() AND public.has_permission('billing.till'));
CREATE POLICY billing_patient_read ON public.billing_settlements FOR SELECT TO authenticated USING (tenant_id=public.current_tenant() AND patient_id=public.portal_patient_id() AND NOT without_invoice);
CREATE FUNCTION public.settle_appointment(_appointment uuid, _lines jsonb, _payments jsonb, _without_invoice boolean, _reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.appointments; t public.treatments; l jsonb; p jsonb; rows jsonb:='[]'; v jsonb; issuer jsonb; line_total bigint; line_vat bigint; total bigint:=0; vat bigint:=0; paid bigint:=0; rate numeric; seq bigint; number text; sid uuid; exempt boolean;
BEGIN
 IF NOT public.is_aal2() OR NOT public.has_permission('billing.till') THEN RAISE EXCEPTION 'Geen toegang.'; END IF;
 SELECT * INTO a FROM public.appointments WHERE id=_appointment AND tenant_id=public.current_tenant() FOR UPDATE;
 IF NOT FOUND OR a.status<>'klaar_voor_betaling' THEN RAISE EXCEPTION 'Deze afspraak is niet klaar voor betaling.'; END IF;
 IF EXISTS(SELECT 1 FROM public.billing_settlements WHERE appointment_id=a.id) THEN RAISE EXCEPTION 'Deze afspraak is al afgerekend.'; END IF;
 IF jsonb_typeof(_lines)<>'array' OR jsonb_array_length(_lines)=0 OR jsonb_array_length(_lines)>100 THEN RAISE EXCEPTION 'Voeg een betaalregel toe.'; END IF;
 SELECT step_data->'vat' INTO v FROM public.consult_notes WHERE appointment_id=a.id AND tenant_id=a.tenant_id ORDER BY created_at DESC LIMIT 1;
 FOR l IN SELECT value FROM jsonb_array_elements(_lines) LOOP
  SELECT * INTO t FROM public.treatments WHERE id=(l->>'treatmentId')::uuid AND tenant_id=a.tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Behandeling of product niet gevonden.'; END IF;
  IF (l->>'qty')::numeric<=0 OR (l->>'qty')::numeric>10000 OR (l->>'priceCents')::numeric<0 OR (l->>'priceCents')::numeric<>trunc((l->>'priceCents')::numeric) OR (l->>'discountCents')::numeric<0 OR (l->>'discountCents')::numeric<>trunc((l->>'discountCents')::numeric) THEN RAISE EXCEPTION 'Ongeldige betaalregel.'; END IF;
  exempt:=t.vat_exemption_possible AND coalesce((v->>'exempt')::boolean,false) AND coalesce(v->>'by','')<>'' AND coalesce(v->>'at','')<>'';
  rate:=CASE WHEN exempt THEN 0 ELSE t.btw_rate END;
  line_total:=round((l->>'qty')::numeric*(l->>'priceCents')::numeric)-(l->>'discountCents')::bigint;
  IF line_total<0 THEN RAISE EXCEPTION 'Korting is hoger dan het regelbedrag.'; END IF;
  line_vat:=round(line_total*rate/(100+rate)); total:=total+line_total; vat:=vat+line_vat;
  rows:=rows||jsonb_build_array(l||jsonb_build_object('name',t.name_nl,'vatRate',rate,'totalCents',line_total,'vatCents',line_vat));
 END LOOP;
 IF jsonb_typeof(_payments)<>'array' OR jsonb_array_length(_payments)>10 THEN RAISE EXCEPTION 'Ongeldige betaling.'; END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(_payments) LOOP
  IF (p->>'amountCents')::numeric<=0 OR (p->>'amountCents')::numeric<>trunc((p->>'amountCents')::numeric) OR NOT EXISTS(SELECT 1 FROM public.option_lists WHERE list_key='billing_payment_method' AND value=p->>'method') THEN RAISE EXCEPTION 'Ongeldige betaalwijze.'; END IF;
  paid:=paid+(p->>'amountCents')::bigint;
 END LOOP;
 IF _without_invoice THEN
  IF length(trim(coalesce(_reason,'')))=0 OR jsonb_array_length(_payments)>0 THEN RAISE EXCEPTION 'Een reden en geen betaling zijn vereist voor afsluiten zonder factuur.'; END IF;
 ELSE
  IF paid<>total THEN RAISE EXCEPTION 'De betalingen moeten samen het totaalbedrag zijn.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=a.tenant_id AND test_mode) THEN RAISE EXCEPTION 'Betalen is alleen beschikbaar in de demo.'; END IF;
  INSERT INTO public.billing_counters(tenant_id,last_number) VALUES(a.tenant_id,1) ON CONFLICT(tenant_id) DO UPDATE SET last_number=billing_counters.last_number+1 RETURNING last_number INTO seq;
  number:=to_char(now(),'YYYY')||'-'||lpad(seq::text,6,'0');
 END IF;
 SELECT jsonb_build_object('clinic',display_name,'legal',legal,'demo',test_mode) INTO issuer FROM public.tenants WHERE id=a.tenant_id;
 INSERT INTO public.billing_settlements(tenant_id,patient_id,appointment_id,invoice_number,total_cents,vat_cents,lines,payments,fiscal_snapshot,issuer_snapshot,without_invoice,reason) VALUES(a.tenant_id,a.patient_id,a.id,number,total,vat,rows,_payments,coalesce(v,'null'::jsonb),issuer,_without_invoice,coalesce(_reason,'')) RETURNING id INTO sid;
 UPDATE public.appointments SET status='afgerond' WHERE id=a.id AND tenant_id=a.tenant_id;
 INSERT INTO public.audit_log(tenant_id,user_id,role_key,action,category,record_type,record_id,details) VALUES(a.tenant_id,auth.uid(),public.current_role_key(),CASE WHEN _without_invoice THEN 'billing_closed_without_invoice' ELSE 'invoice_paid' END,'changed','billing_settlements',sid::text,jsonb_build_object('description',CASE WHEN _without_invoice THEN 'Afspraak afgesloten zonder factuur: '||_reason ELSE 'Demobetaling ontvangen en factuur '||number||' aangemaakt' END,'total_cents',total,'appointment_id',a.id));
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.settle_appointment(uuid,jsonb,jsonb,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_appointment(uuid,jsonb,jsonb,boolean,text) TO authenticated;
COMMENT ON TABLE public.billing_settlements IS 'Operational immutable settlement and invoice snapshots; patient identity remains in patients. Writes only through atomic settle_appointment.';