-- Comparison wording of the condition modal design, plus the image library for measure questions.
update public.option_lists set label_nl = 'is minimaal', label_en = 'is at least' where list_key = 'questionnaire_op' and value = 'gte';
update public.option_lists set label_nl = 'is kleiner dan', label_en = 'is less than' where list_key = 'questionnaire_op' and value = 'lt';
insert into public.option_lists (list_key, value, label_nl, label_en, sort) values
  ('questionnaire_op','between','ligt tussen','is between',7),
  ('questionnaire_op','contains','bevat','contains',8),
  ('questionnaire_image','buikomvang-meten','Buikomvang meten','Measuring waist',1)
on conflict (list_key, value) do nothing;