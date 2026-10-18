-- Category mail image, cancel-policy placeholders and the nine-block base confirmation per the supplied mail designs.
alter table public.treatment_categories add column mail_image_path text;
comment on column public.treatment_categories.mail_image_path is 'Mail artwork: category image for the confirmation mail; the template image is the fallback when empty.';

insert into public.option_lists (list_key, value, label_nl, label_en, sort) values
  ('mail_block_type','category_image','Afbeelding van de categorie','Category image',0),
  ('mail_ui','no_show_zin','Bij een afspraak bereiden we ons voor op jouw komst en houden we een tijdsblok exclusief voor je vrij. Daarom brengen wij bij annuleringen binnen {annuleringstermijn} voor aanvang of wanneer je niet verschijnt op de afspraak {no_show_bedrag} in rekening.','If you cancel within {annuleringstermijn} before the start or do not show up, we charge {no_show_bedrag}.',1),
  ('mail_preview','telefoon','085-7600035','085-7600035',11),
  ('mail_preview','e_mail','info@bodyclinic.nl','info@bodyclinic.nl',12),
  ('mail_preview','meet_link','https://meet.google.com/abc-defg-hij','https://meet.google.com/abc-defg-hij',13)
on conflict (list_key, value) do nothing;

-- Injectables categories: 48 hours and 60 euro per the supplied mail design.
update public.treatment_categories set cancel_until_hours = 48, no_show_fee_eur = 60
 where parent_id is null and name_nl in ('Botox','Fillers','Skinboosters');

-- Base confirmation: the nine blocks from the supplied mail designs (clinic/online as conditions).
update public.mail_templates set blocks = '[
  {"id":"hero","type":"category_image","condition":"always","title_nl":"","title_en":"","text_nl":"","text_en":"","button_nl":"","button_en":"","url":"","image":""},
  {"id":"title","type":"text","condition":"always","title_nl":"{behandelaar_voornaam} verwacht je op {dag} om {tijd} uur","title_en":"","text_nl":"","text_en":"","button_nl":"","button_en":"","url":"","image":""},
  {"id":"intro_clinic","type":"text","condition":"clinic","title_nl":"","title_en":"","text_nl":"Beste {voornaam},\n\nOp {dag} om {tijd} uur ontvang ik je graag in onze kliniek in {locatie}. Ik heb deze tijd voor je gereserveerd en kijk uit naar je komst.\n\nHeb je vooraf nog vragen? Neem gerust contact op, we helpen je graag verder.","text_en":"","button_nl":"","button_en":"","url":"","image":""},
  {"id":"intro_online","type":"text","condition":"online","title_nl":"","title_en":"","text_nl":"Beste {voornaam},\n\nOp {dag} om {tijd} uur spreek ik je graag online via Google Meet. Log een paar minuten van tevoren in; de link staat hieronder. Ik heb deze tijd voor je gereserveerd en kijk uit naar ons gesprek.\n\nHeb je vooraf nog vragen? Neem gerust contact op, we helpen je graag verder.","text_en":"","button_nl":"","button_en":"","url":"","image":""},
  {"id":"signature","type":"signature","condition":"always","title_nl":"","title_en":"","text_nl":"Met vriendelijke groet,\n{behandelaar}","text_en":"","button_nl":"","button_en":"","url":"","image":""},
  {"id":"questionnaire","type":"card","condition":"questionnaire","title_nl":"Medische vragenlijst","title_en":"","text_nl":"Om het consult zo goed mogelijk voor te bereiden, vragen we je vooraf de medische vragenlijst in te vullen (ongeveer 8 minuten).","text_en":"","button_nl":"Vragenlijst invullen","button_en":"","url":"{link_vragenlijst}","image":""},
  {"id":"details_clinic","type":"details","condition":"clinic","title_nl":"Details afspraak","title_en":"","text_nl":"{locatie_naam}\n{adres}\n{telefoon}","text_en":"","button_nl":"Locatie op Google maps","button_en":"","url":"{maps_link}","image":""},
  {"id":"details_online","type":"details","condition":"online","title_nl":"Details afspraak","title_en":"","text_nl":"Online via Google Meet\nJe hoeft niets te installeren; open de link op je telefoon of computer.","text_en":"","button_nl":"Deelnemen via Google Meet","button_en":"","url":"{meet_link}","image":""},
  {"id":"preparation","type":"card","condition":"preparation","title_nl":"Goed om te weten","title_en":"","text_nl":"{voorbereiding}","text_en":"","button_nl":"","button_en":"","url":"","image":""},
  {"id":"questions","type":"card","condition":"always","title_nl":"Vragen?","title_en":"","text_nl":"{behandeling_omschrijving}\n\nHeb je vooraf vragen? Bel ons op {telefoon} of stuur een mail naar {e_mail}.","text_en":"","button_nl":"","button_en":"","url":"","image":""},
  {"id":"cancel","type":"card","condition":"always","title_nl":"Verhinderd?","title_en":"","text_nl":"Voor jouw afspraak heb ik speciaal tijd vrijgemaakt in mijn agenda. Kun je toch niet? Laat het ons dan uiterlijk {annuleringstermijn} van tevoren weten, dan kunnen we deze plek aanbieden aan iemand anders.\n\n{no_show_zin}\n\nWijzigen of annuleren kan direct via de knop hieronder, of via {telefoon}.","text_en":"","button_nl":"Afspraak wijzigen of annuleren","button_en":"","url":"{link_wijzigen}","image":""},
  {"id":"privacy","type":"text","condition":"always","title_nl":"Privacy","title_en":"","text_nl":"Je privacy is belangrijk voor ons. In onze privacyverklaring op de website lees je welke gegevens we verzamelen, waarom en hoe lang we ze bewaren. Je ontvangt deze mail als bevestiging van je afspraak. Wil je deze mails niet meer ontvangen? Stuur dan een mail naar {e_mail}.","text_en":"","button_nl":"","button_en":"","url":"","image":""}
]'::jsonb
 where scope = 'base' and moment = 'confirmation' and status <> 'archived';