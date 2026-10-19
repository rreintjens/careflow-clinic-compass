-- A consult can be parked (paused) so the doctor can start another; only one active draft per user.
ALTER TABLE public.consult_notes DROP CONSTRAINT consult_notes_status_check;
ALTER TABLE public.consult_notes ADD CONSTRAINT consult_notes_status_check CHECK (status = ANY (ARRAY['draft'::text, 'parked'::text, 'final'::text]));
CREATE UNIQUE INDEX consult_notes_one_active_per_user ON public.consult_notes (created_by) WHERE status = 'draft' AND appointment_id IS NOT NULL;