INSERT INTO public.option_lists (list_key, value, label_nl, label_en, sort) VALUES
('koppelingen_ui','stats_last','Laatste ophaalmoment','Last pull',66),
('koppelingen_ui','state_niet_verifieerd','nog niet geverifieerd','not verified yet',67)
ON CONFLICT (list_key, value) DO UPDATE SET label_nl = EXCLUDED.label_nl, label_en = EXCLUDED.label_en, sort = EXCLUDED.sort;