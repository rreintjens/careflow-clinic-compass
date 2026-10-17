ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notify text NOT NULL DEFAULT 'as_usual';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS booking_reason text;