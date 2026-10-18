ALTER TABLE public.consult_notes
  ADD COLUMN practitioner_id uuid REFERENCES public.practitioners(id),
  ADD COLUMN occurred_at timestamptz,
  ADD COLUMN time_and_duration text NOT NULL DEFAULT '',
  ADD COLUMN reason text NOT NULL DEFAULT '',
  ADD COLUMN follow_up text NOT NULL DEFAULT '',
  ADD COLUMN visibility text NOT NULL DEFAULT '';
COMMENT ON COLUMN public.consult_notes.reason IS 'Medical: reason for a standalone telephone or interim consultation.';
COMMENT ON COLUMN public.consult_notes.occurred_at IS 'Medical: consultation date; separate from creation time.';
COMMENT ON COLUMN public.consult_notes.visibility IS 'Display configuration only; never relaxes medical RLS permissions.';