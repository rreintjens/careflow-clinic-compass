
-- Artsentitel voor patiëntgerichte weergave ("Drs. Hugo Ammerlaan")
ALTER TABLE public.practitioners ADD COLUMN title text;
UPDATE public.practitioners SET title='Drs.' WHERE id='8a40943c-adb2-4ab6-8521-d6bac733df82';

-- Programmafeiten per patiënt (leefstijl, hartrisico, check-in, tips) — demo geseed, later berekend
ALTER TABLE public.portal_patient_access ADD COLUMN program_facts jsonb NOT NULL DEFAULT '{}';

-- Bestellingen: pakket kan de status 'ordered' krijgen (arts kijkt na, demo-betaling)
ALTER TABLE public.ma_packages DROP CONSTRAINT ma_packages_status_check;
ALTER TABLE public.ma_packages ADD CONSTRAINT ma_packages_status_check CHECK (status = ANY (ARRAY['active','completed','cancelled','ordered']));

-- Taillemetingen voor Mark (Voortgang › Gewicht)
UPDATE public.measurements SET waist_cm=110 WHERE patient_id='a0000000-0000-4000-8000-000000000002' AND measured_on='2026-08-01';
UPDATE public.measurements SET waist_cm=107 WHERE patient_id='a0000000-0000-4000-8000-000000000002' AND measured_on='2026-09-01';
UPDATE public.measurements SET waist_cm=104 WHERE patient_id='a0000000-0000-4000-8000-000000000002' AND measured_on='2026-10-01';

-- Programmafeiten Mark (demo)
UPDATE public.portal_patient_access SET program_facts='{
 "weeksWeighed":4,
 "checkin":{"label":"Check-in maand 2","daysLeft":5},
 "weekTip":{"title":"Tip van de week","text":"Plan je weegmoment vast op maandagochtend, voor het ontbijt. Zo vergelijk je elke week eerlijk."},
 "lifestyle":{"score":6.8,"deltaStart":"+0,5","subs":[
  {"key":"bewegen","label":"Bewegen","line":"80 min per week","status":"soon"},
  {"key":"stress","label":"Stress","line":"Regelmatig gespannen","status":"soon"},
  {"key":"eten","label":"Eten","line":"Grotendeels gezond, bijna elke dag","status":"good"},
  {"key":"slapen","label":"Slaap","line":"Meestal 7 uur","status":"good"},
  {"key":"alcohol","label":"Alcohol","line":"2 glazen per week","status":"good"},
  {"key":"roken","label":"Roken","line":"Rookt niet","status":"good"}],
 "advice":{"title":"Meer bewegen","text":"3 keer per week 20 minuten extra wandelen"}},
 "heart":{"percent":30,"level":"hoog","age":41,"factors":[
  {"key":"gewicht","label":"Gewicht","line":"BMI 31,3","status":"action"},
  {"key":"bewegen","label":"Bewegen","line":"80 min per week","status":"soon"},
  {"key":"bloeddruk","label":"Bloeddruk","line":"Hoog, eigen opgave","status":"action"},
  {"key":"cholesterol","label":"Cholesterol","line":"Verhoogd, eigen opgave","status":"action"},
  {"key":"roken","label":"Roken","line":"Nooit","status":"good"},
  {"key":"diabetes","label":"Diabetes","line":"Nee","status":"good"}],
 "help":{"title":"Gewicht en bewegen","text":"die twee kun je het meest verbeteren"}},
 "programma":{"monthText":"Veel mensen zijn nu gewend aan de medicatie, en het afvallen gaat voor velen rustig door. Blijf regelmatig eten en bewegen; ook als de weegschaal een week stilstaat.","strengthSince":"5 mg, sinds 30 september","nextStep":"7,5 mg, als je arts akkoord geeft","injectLink":"Uitleg over je injecteren","tipCategories":[{"icon":"eten","label":"Eten","n":4},{"icon":"bewegen","label":"Bewegen","n":3},{"icon":"slapen","label":"Slapen","n":2},{"icon":"ontspannen","label":"Ontspannen","n":2}]}
}' WHERE patient_id='a0000000-0000-4000-8000-000000000002';

-- Portalteksten en bestelconfiguratie (placeholders, prijzen volgens ontwerp)
UPDATE public.portal_config SET content=content||'{
 "edit":"Bewerken","account":"Account","profileRows":["Persoonsgegevens","Adres","Facturen","Toestemmingen","Meldingen","Privacy"],
 "orderTile":"Volgende bestelling {medicijn}","orderIn":"Over {n} dagen","orderNow":"Nu te bestellen","orderWindow":"Bestellen tussen {d1} en {d2}","preorder":"Voorbestellen",
 "checkIn":"Check-in maand {n}","daysLeft":"{n} dagen","checkInSub":"nog om in te vullen","doctorReview":"Controle door arts",
 "weightLost":"kwijt sinds de start","goalChip":"{p}% van je doel","update":"Bijwerken",
 "lifestyleLabel":"Leefstijl","lifestyleSub":"{d} sinds de start","heartLabel":"Hartrisico","weeksWeighed":"{n} weken","weeksWeighedSub":"op rij gewogen",
 "progressTitle":"Voortgang","tabWeight":"Gewicht","tabLifestyle":"Leefstijl","tabHeart":"Hartrisico","yourWeight":"Je gewicht nu","bmiLabel":"BMI","waistLabel":"Buikomvang","was":"was {v}","goalLabel":"Je doel: {g} kg","goalLeft":"Nog {x} kg","goalAvg":"gemiddeld {a} kg per week","lastMeasurements":"Laatste metingen","scoreOf":"van de 10","sinceStart":"sinds de start","adviceForYou":"Advies voor jou","heartIntro":"kans op een hart- of vaatziekte in de komende 10 jaar","heartNow":"als alles blijft zoals nu","heartHealthy":"gezond voor je leeftijd","whatHelps":"Wat helpt",
 "programTitle":"Programma","monthOf":"van de {m}","weekLabel":"week {w}","thisMonth":"Deze maand","medTitle":"{medicijn}, 1× per week","strengthNow":"Sterkte nu","nextStep":"Volgende stap","sideEffect":"Last van een bijwerking?","reportIt":"Meld het","tipsLabel":"Tips per thema",
 "apptsTitle":"Afspraken","inDays":"over {n} dagen","today":"vandaag","videoVia":"Videogesprek via Google Meet","join":"Deelnemen","joinNote":"Deelnemen kan vanaf 10 minuten voor de afspraak","planExtra":"Extra afspraak plannen","earlier":"Eerder",
 "orderTitle":"Bestellen","yourMedication":"Je medicatie","strengthSince":"Sterkte nu: {s} mg, sinds {datum}","checkinNote":"Je check-in bepaalt of je op {s} mg blijft of naar {n} mg gaat.","nextOrder":"Volgende bestelling {medicijn}","packageUntil":"Je pakket loopt tot {datum}","choosePackage":"Kies je pakket","choosePackageSub":"Hoe langer je pakket, hoe lager de prijs per maand.","monthsOne":"1 maand","monthsN":"{n} maanden","fromPerMonth":"vanaf € {p} p/m","monthN":"Maand {n}","legendSelected":"Gekozen","legendAllowed":"Beschikbaar","legendReview":"Arts kijkt mee","legendBlocked":"Niet beschikbaar","reviewNote":"Je arts kijkt mee bij twee stappen omhoog.","total":"Totaal","youSave":"Je bespaart € {x} ten opzichte van losse maanden","orderBtn":"Bestellen","perMonth":"p/m",
 "checkoutTitle":"Afrekenen","stepOf":"Stap {n} van {m}","packageReady":"Je pakket staat klaar","packageReadySub":"Kies je begeleiding, extra\u2019s, bezorging en betaling.","startOrder":"Start bestelling","chooseSupport":"Kies je begeleiding","supportSub":"Wat past het beste bij jou?","perMonthSuffix":"per maand","extrasTitle":"Iets extra\u2019s nodig?","extrasSub":"Optioneel. Voeg toe wat je nodig hebt.","noExtras":"Niets toevoegen","remarkTitle":"Wil je nog iets doorgeven?","remarkSub":"Aan de apotheker of je arts.","remarkPlaceholder":"Bijvoorbeeld over je sterkte, je medicijngebruik of iets anders","deliveryTitle":"Bezorgen of afhalen?","deliver":"Bezorgen","pickup":"Afhalen","deliveryHow":"Hoe wil je het ontvangen?","pickupAt":"Afhalen in kliniek {kliniek}","checkTitle":"Controleer je bestelling","supportLabel":"Begeleiding","extrasLabel":"Extra\u2019s","deliveryLabel":"Bezorging","remarkLabel":"Opmerking","totalLabel":"Totaal","toPayment":"Naar betalen","cancelOrder":"Bestelling annuleren","payTitle":"Hoe wil je betalen?","payNote":"Je betaalt nu. Je bestelling gaat naar de apotheker zodra je arts akkoord geeft.","pay":"Betaal","payDemo":"Demo: er wordt niet echt afgerekend.","orderDone":"Je bestelling is ontvangen","orderDoneSub":"Je arts kijkt je bestelling na. Je hoort het zodra de apotheker je pakket verstuurt.","backToStart":"Naar Start","continueBtn":"Volgende","confirmBtn":"Bevestigen","back":"Terug","medicationLabel":"Medicatie","packageLabel":"Pakket","free":"Gratis",
 "maConfig":{"strengths":[2.5,5,7.5,10,12.5,15],"basePrices":[219,239,259,279,299,319],"discounts":{"1":0,"2":10,"3":20,"6":30},"packages":[1,2,3,6],
  "support":[{"key":"care","name":"Care","price":29,"lines":["Je coach volgt je voortgang en stuurt bij","Toegang tot de Voedingsapp","Online masterclasses"],"tag":"Meest gekozen"},{"key":"independent","name":"Independent","price":0,"lines":["Programma van 1, 2, 3 of 6 maanden","Online bazorg van je arts","Thuisbezorgd door de apotheker"]},{"key":"careplus","name":"Care+","price":59,"lines":["Inclusief Care, plus nog intensiever"]}],
  "extras":[{"key":"naalden","name":"Reservenaaldenset","price":2.50,"line":"20 naalden, max 1 per bestelling"},{"key":"naaldencontainer","name":"Naaldencontainer","price":2.50,"line":"Lila, zonder naalden"},{"key":"maagbeschermer","name":"Maagbeschermer","price":2.50,"line":"Voor 4 weken"},{"key":"multivitamine","name":"Multivitamine","price":14.95,"line":"1 per maand, 6 maanden"},{"key":"proteineshake","name":"Proteïneshake","price":6.95,"line":"Chocolade of vanille"}],
  "delivery":[{"key":"amp","name":"AMP","price":6.95,"line":"Gekeurd bezorgd aan huis"},{"key":"dhl","name":"DHL","price":6.95,"line":"Bezorgd aan huis"},{"key":"postnl","name":"PostNL","price":6.95,"line":"Bezorgd aan huis"}],
  "payment":[{"key":"ideal","name":"iDEAL | Wero","line":"Via je eigen bank"},{"key":"bancontact","name":"Bancontact","line":"Belgische rekening"}]}
}'::jsonb WHERE tenant_id='75f25a40-9ec2-4c90-b829-b91918cf14df';
