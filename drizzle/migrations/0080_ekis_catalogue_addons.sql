ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'behandeling',
  ADD COLUMN IF NOT EXISTS price_is_from boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS online_payment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_link jsonb,
  ADD COLUMN IF NOT EXISTS addon jsonb;
ALTER TABLE public.treatments ADD CONSTRAINT treatments_kind_check CHECK (kind IN ('consult','controle','behandeling'));
ALTER TABLE public.treatments ADD CONSTRAINT treatments_deposit_check CHECK (deposit_cents >= 0);
ALTER TABLE public.treatment_categories ADD COLUMN IF NOT EXISTS addon jsonb;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS addon jsonb;
COMMENT ON COLUMN public.treatments.addon IS 'Toevoeging override: null = like the group; {type:none}|{type:consult,minutes}|{type:pakket,label,price_eur,question}';
COMMENT ON COLUMN public.treatment_categories.addon IS 'Toevoeging for kind=behandeling below this group: null = like the parent group';
COMMENT ON COLUMN public.appointments.addon IS 'Chosen toevoeging snapshot: {type:consult,minutes}|{type:pakket,label,price_eur}';