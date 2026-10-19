ALTER TABLE public.treatments ADD COLUMN questionnaire_minutes integer NOT NULL DEFAULT 8;
ALTER TABLE public.treatments ADD CONSTRAINT treatments_questionnaire_minutes_check CHECK (questionnaire_minutes BETWEEN 1 AND 60);
COMMENT ON COLUMN public.treatments.questionnaire_minutes IS 'Duur medische vragenlijst (minuten): gebruikt in boekingsbevestiging, vragenlijst-intro en mails.';