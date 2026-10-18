-- Screen texts for the medical questionnaire resume and already-completed screens (from the supplied designs).
insert into public.option_lists (list_key, value, label_nl, label_en, sort) values
  ('questionnaire_ui','mq_label','Medische vragenlijst','Medical questionnaire',50),
  ('questionnaire_ui','mq_done_title','Je hebt deze al ingevuld','You already completed this one',51),
  ('questionnaire_ui','mq_done_body','Op {dag} om {tijd}. {behandelaar_voornaam} heeft je antwoorden; je hoeft niets meer te doen.','On {dag} at {tijd}. {behandelaar_voornaam} has your answers; there is nothing left to do.',52),
  ('questionnaire_ui','mq_changed','Is er iets veranderd?','Has anything changed?',53),
  ('questionnaire_ui','mq_changed_body','Tot 24 uur voor je consult kun je je antwoorden aanpassen. Daarna bespreek je het met de arts.','You can change your answers until 24 hours before your consult. After that you discuss them with the doctor.',54),
  ('questionnaire_ui','mq_edit','Antwoorden bekijken en aanpassen','Review and change your answers',55),
  ('questionnaire_ui','mq_not_found','Deze vragenlijst is niet (meer) beschikbaar.','This questionnaire is no longer available.',56),
  ('questionnaire_ui','mq_resume_title','Welkom terug, {voornaam}','Welcome back, {voornaam}',57),
  ('questionnaire_ui','mq_resume_body','Je was op pagina {pagina} van {paginas}. We gaan verder waar je was; wat je al invulde staat er nog.','You were on page {pagina} of {paginas}. We continue where you were; what you already entered is still there.',58),
  ('questionnaire_ui','mq_resume_consult','Je consult is {dag} om {tijd}. Lukt het niet meer op tijd, dan neemt {behandelaar_voornaam} de rest met je door.','Your consult is {dag} at {tijd}. If you do not finish in time, {behandelaar_voornaam} goes through the rest with you.',59),
  ('questionnaire_ui','mq_resume_button','Verder met {pagina_titel}','Continue with {pagina_titel}',60),
  ('questionnaire_ui','mq_resume_of','{k} van {m}','{k} of {m}',61)
on conflict (list_key, value) do nothing;