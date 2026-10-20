ALTER TABLE public.portal_login_tokens ADD COLUMN return_context jsonb;
INSERT INTO public.option_lists (list_key, value, label_nl, label_en, sort) VALUES
('booking_ui','login_bar_title','Eerder bij ons geweest?','Been here before?',901),
('booking_ui','login_bar_sub','Log in, dan staan je gegevens klaar','Log in and your details are ready',902),
('booking_ui','login_bar_button','Inloggen','Log in',903),
('booking_ui','login_title','Welkom terug','Welcome back',904),
('booking_ui','login_body','Vul je e-mailadres in. We mailen je een link waarmee je direct inlogt; een wachtwoord heb je niet nodig.','Enter your email address. We mail you a link that logs you in straight away; you do not need a password.',905),
('booking_ui','login_send','Stuur inloglink','Send login link',906),
('booking_ui','login_new','Nog niet eerder bij ons geweest? Maak een afspraak','Not been here before? Book an appointment',907),
('booking_ui','login_sent_title','Check je mail','Check your email',908),
('booking_ui','login_sent_body','We hebben een inloglink gestuurd naar {email}. Klik op de link in de mail: dan ben je ingelogd en staan je gegevens klaar.','We sent a login link to {email}. Click the link in the mail: you are logged in and your details are ready.',909),
('booking_ui','login_back','Terug','Back',910),
('booking_ui','welcome_back','Welkom terug, {voornaam}','Welcome back, {voornaam}',911),
('booking_ui','welcome_ready','Je gegevens klaar','Your details are ready',912),
('booking_ui','welcome_portal','Mijn omgeving','My environment',913),
('booking_ui','your_doctor','Jouw {rol}','Your {rol}',914),
('booking_ui','change','Wijzig','Change',915),
('booking_ui','call_team','Joyce en haar team helpen je graag','Joyce and her team are happy to help',916)
ON CONFLICT (list_key, value) DO UPDATE SET label_nl = EXCLUDED.label_nl, label_en = EXCLUDED.label_en, sort = EXCLUDED.sort;