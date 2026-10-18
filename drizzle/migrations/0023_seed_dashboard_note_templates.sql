INSERT INTO public.option_lists (list_key, value, label_nl, label_en, sort) VALUES
('dashboard_ui','note_avg_more','{verschil} meer dan het gemiddelde van de laatste 30 dagen ({gemiddeld} per dag).','{verschil} more than the average of the last 30 days ({gemiddeld} per day).',25),
('dashboard_ui','note_avg_less','{verschil} minder dan het gemiddelde van de laatste 30 dagen ({gemiddeld} per dag).','{verschil} less than the average of the last 30 days ({gemiddeld} per day).',26),
('dashboard_ui','note_occupancy','Bezetting {percent}% van de ingeroosterde tijd.','Occupancy {percent}% of the scheduled time.',27),
('dashboard_ui','note_open','Van de {afspraken} afspraken van vandaag; {later} daarvan zijn voor morgen of later.','Of the {afspraken} appointments today; {later} of them are tomorrow or later.',28),
('dashboard_ui','note_noshow','Dat is {percent}% van de afspraken van de laatste 7 dagen.','That is {percent}% of the appointments of the last 7 days.',29),
('dashboard_ui','stats_key_missing','Nog geen sleutel gemaakt; maak er één bij Koppelingen.','No key made yet; make one at Connections.',30)
ON CONFLICT (list_key, value) DO UPDATE SET label_nl = EXCLUDED.label_nl, label_en = EXCLUDED.label_en, sort = EXCLUDED.sort;