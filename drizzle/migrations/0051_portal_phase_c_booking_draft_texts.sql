INSERT INTO public.option_lists (list_key, value, label_nl, label_en, sort) VALUES
('booking_ui','choice_kept_title','Je keuze blijft bewaard','Your choice is saved',917),
('booking_ui','hold_note','We houden je moment nog {n} minuten vast.','We keep your slot for another {n} minutes.',918),
('booking_ui','resend','Geen mail ontvangen? Stuur opnieuw','No mail? Send again',919),
('booking_ui','other_email','Ander e-mailadres gebruiken','Use a different email address',920),
('booking_ui','spam_note','Kijk ook even in je map met ongewenste mail.','Also check your spam folder.',921),
('booking_ui','check_title','Klopt alles?','Is everything right?',922),
('booking_ui','check_confirm','Bevestig je afspraak','Confirm your appointment',923),
('booking_ui','check_details','Je gegevens','Your details',924),
('booking_ui','rather_own','Liever bij {voornaam}? Bekijk de tijden','Rather see {voornaam}? View the times',925),
('booking_ui','unknown_email','We kennen dit e-mailadres niet. Ga verder als nieuwe patiÃ«nt.','We do not know this email address. Continue as a new patient.',926),
('booking_ui','quick_login_title','Sneller klaar? Log in','Done faster? Log in',927),
('booking_ui','quick_login_body','We mailen je een inloglink. Daarna staan je gegevens al klaar en zie je ook je eerdere behandelingen.','We mail you a login link. Then your details are ready and you also see your earlier treatments.',928),
('booking_ui','quick_login_send','Stuur link','Send link',929),
('booking_ui','quick_login_sent','We hebben een inloglink gestuurd naar {email}. Klik op de link in de mail: dan ben je ingelogd en staat je afspraak meteen vast.','We sent a login link to {email}. Click the link in the mail: you are logged in and your appointment is confirmed right away.',930),
('booking_ui','no_login','Liever niet inloggen? Vul je gegevens hieronder in zoals wij ze kennen.','Rather not log in? Fill in your details below as we know them.',931)
ON CONFLICT (list_key, value) DO UPDATE SET label_nl = EXCLUDED.label_nl, label_en = EXCLUDED.label_en, sort = EXCLUDED.sort;
UPDATE public.option_lists SET label_nl='We hebben een link gestuurd naar {email}. Klik op de link in de mail, dan ga je verder waar je was.', label_en='We sent a link to {email}. Click the link in the mail and you continue where you were.' WHERE list_key='booking_ui' AND value='login_sent_body';
UPDATE public.option_lists SET label_nl='Je keuze en je gegevens staan klaar', label_en='Your choice and details are ready' WHERE list_key='booking_ui' AND value='welcome_ready';
UPDATE public.portal_config SET content = content || '{"bookingSubject":"Ga verder met je afspraak","bookingText":"Met de knop hieronder log je in en ga je verder waar je was: {behandeling} op {dag} om {tijd} in {locatie}. Je gegevens staan al klaar.","bookingButton":"Inloggen en verder boeken","bookingFootnote":"De link werkt Ã©Ã©n keer en is 10 minuten geldig. We houden je moment 15 minuten vast.","confirmedLabel":"Je afspraak is bevestigd","confirmedAdjust":"Afspraak aanpassen? Klik hier"}'::jsonb, updated_at = now() WHERE tenant_id = '75f25a40-9ec2-4c90-b829-b91918cf14df';