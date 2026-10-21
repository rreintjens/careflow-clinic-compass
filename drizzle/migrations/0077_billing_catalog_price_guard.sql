DO $$ DECLARE d text; BEGIN
SELECT pg_get_functiondef('public.settle_appointment(uuid,jsonb,jsonb,boolean,text)'::regprocedure) INTO d;
IF strpos(d,'Behandeling of product niet gevonden.')=0 THEN RAISE EXCEPTION 'Prijscontrole niet gevonden'; END IF;
d:=replace(d,'IF NOT FOUND THEN RAISE EXCEPTION ''Behandeling of product niet gevonden.''; END IF;', 'IF NOT FOUND THEN RAISE EXCEPTION ''Behandeling of product niet gevonden.''; END IF; IF (l->>''priceCents'')::numeric IS DISTINCT FROM coalesce(t.price_cents,0)::numeric THEN RAISE EXCEPTION ''De prijs is gewijzigd. Open afrekenen opnieuw.''; END IF;');
d:=replace(d,'IF _without_invoice THEN','IF length(coalesce(_reason,''''))>2000 THEN RAISE EXCEPTION ''De reden mag maximaal 2000 tekens bevatten.''; END IF; IF _without_invoice THEN');
EXECUTE d;
END $$;
COMMENT ON FUNCTION public.settle_appointment(uuid,jsonb,jsonb,boolean,text) IS 'Atomic settlement: tenant authorization, authoritative catalog price, bounded explicit discounts for billing.till, and bounded no-invoice reason; never trust caller unit prices.';