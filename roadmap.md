# Roadmap

## Mijn omgeving v0.1 — eigenaar 20-10
- [x] A: gedeeld mobiel/desktopkader, tokens, afzonderlijke patiëntlogin via tienminutenlink, landingsregel, navigatie en vier demopatiënten; ieder via echte link op 390px/1440px gecontroleerd. Patiëntisolatie, medewerkers-/patiëntgrenzen, herladen, onbekende mail en eenmalig gebruik gecontroleerd; 42 gerichte tests groen. Demo-mails in bestaande outbox. Stop voor go.
  - Afbakening: volledige cosmetische historie/afspraken, behandeltrajecten en programmeerschermen volgen B/D; fase A toont Start-identiteit met demo-aantallen en pakket/meetbronnen, nog geen gefactureerde historische afspraken. Mails blijven demo_only, geen externe bezorging. Geen extra Profiel-tabel; bestaand dossier hergebruikt. Screenshots staan in Files onder Mijn-omgeving-fase-A.
- [ ] B: cosmetische schermen en behandelinstellingen — wacht op go na A.
- [ ] C: inloggen vanuit boeking (B2-balk (teal #317689, witte tekst, witte Inloggen-pil); herstel na link per voortgang: niets gekozen→Start, behandeling→planner+welkom+eigen arts, tijd+open stap→eerste open stap (gegevens overgeslagen, Klopt alles?), alles rond/details→direct bevestigen+groene tegel; bevestigingsmail aparte tekst; geen "Liever bij"-regel "Eerder bij ons geweest? Log in, dan staan je gegevens klaar" op eerste scherm én planner, ook in de linkbuilder-preview; loginpagina met kaart "Je keuze blijft bewaard"; boekingsconcept server-side aan de inloglink gekoppeld zodat de link in elke browser de exacte staat herstelt; bij gekozen tijd 15 min vasthouden vanaf verzenden; Check-je-mail-scherm met opnieuw-sturen en spammap-notitie; mail "Ga verder met je afspraak"; terugkeer in dezelfde stap met Welkom-terugrij, nooit een keuze overschrijven, rustige regel "Liever bij {voornaam}?" bij Geen voorkeur; gegevensstap overgeslagen voor ingelogden, eindstap "Klopt alles?" met Bevestig-knop; automatisch bevestigen alleen bij login vanaf de gegevensstap; boekingslink-stap 5; Joyce in bel-footer) — GO gegeven 20-10.
- [ ] D: medisch-afvallenschermen met foto's en visuele regels — GO gegeven 20-10.
- [ ] E: bestellen, pakketkiezer-states en demo-afrekenen — GO gegeven 20-10.

## Uitvoervolgorde eigenaar 19-10 13:19 UTC
1. Gedeelde doorzoekbare picker
2. Boekingslinks met meerdere behandelingen en behandelaars
3. Gestructureerde UTM, kanalen/campagnes en hash
4. Startscherm per behandeling en link
5. Keuzekaarten patiëntflow
6. Gedeeld lijstpatroon beheer
7. E-mails en sjablonen herschikken

- [x] Keuzekaarten patiëntflow (eigenaar 19-10): aanbevolen "Online via Google Meet" zelfde zandkleur als andere kaarten (teal rand + Aanbevolen-label behouden); één gedeelde choice-card-stijl voor alle tikbare keuzes (categorieën, subcategorieën, behandelingen, locaties, behandelaars, datums, tijden, antwoorden, startschermknoppen): hover donkerder zand + teal rand + pijl 2px, focus teal ring, pressed licht teal, selected teal rand + licht teal; verifiëren met muis op locatiescherm en toetsenbord (Tab) op een vragenlijstpagina

- [x] E-mails en sjablonen herschikken (eigenaar 19-10): tabs Sjablonen / Per behandeling / Verzonden e-mails; zoeken over namen, onderwerpen en teksten; links momenten per fase met aantallen, rechts basissjabloon + tabel Afwijkingen (Geldt voor categorie › behandeling, Talen met waarschuwing, Status, Laatst gewijzigd, zoeken en filters), rij-klik opent editor, "+ Afwijking" met gedeelde picker; Per behandeling toont per moment welk sjabloon en waarom met voorbeeld; oude lange lijst en Per moment/Per behandeling-knoppen weg; als Rob verifiëren

- [x] Boekingslinks: meerdere behandelingen/categorieën en meerdere behandelaars (eigenaar 19-10, VERVANGT de taak "Keuze behandelaar begrijpelijk"): Behandelingen = alle of multi-select incl. hele (sub)categorie (dynamisch); Welke behandelaars = alle-die-dit-doen of alleen-deze (picker per rol, alleen wie gekozen behandeling op gekozen locatie doet, rest uitgegrijsd met reden); Keuze voor de patiënt met één regel uitleg per optie (Zoals de behandeling toont huidige instelling, Toegewezen, Optioneel, Verplicht), bij één behandelaar stap overslaan; modus "Vast (via boekingslink)" weg — bestaande vaste links worden "Alleen deze behandelaars" met die éne; patiëntflow via link beperkt tot selectie (één behandeling → startscherm/locatie, meerdere in één categorie → behandelkeuze, over categorieën → categorie Scherm beperkt); startscherm "Zoals de behandeling" alleen bij precies één behandeling; waarschuwing per behandeling zonder behandelaar/locatie, opslaan blokkeren als niets boekbaar; overzicht toont scope in woorden; als Rob verifiëren met link voor categorie Medisch afvallen en twee artsen

- [x] Gedeelde doorzoekbare picker (combobox) overal (eigenaar 19-10): locaties, behandelaars, behandelingen, categorieën, medewerkers, vragenlijsten; zoeken op naam/rol/categorie/adres met markering, pijltjestoetsen, groepen met structuur, single- en multi-select (chips, "Alles in deze groep", "Wis selectie"), niet-kiesbaar = verborgen of uitgegrijsd met reden; o.a. boekingslink-modal, Afspraak maken, agendafilters, rooster, behandelaar-/behandeling-pop-ups, apparatuur, vragenlijst Gekoppeld aan, e-mail Geldt voor, dossier Aanvraag/vervolgactie, gebruikers, lijstfilters; alle vervangen velden rapporteren

- [x] Eén lijstpatroon in beheer (eigenaar 19-10): gedeelde ListPage/DataTable (Behandelaars als referentie) voor Patiënten, Behandelingen (rechterlijst), Behandelaars, Locaties, Apparatuur, Boekingslinks, Kanalen en campagnes, Vragenlijsten, E-mails en sjablonen, Gebruikers en rollen, Logboek, Verzonden e-mails; hele rij klikbaar, "Wijzig"-links weg, één filterrij, één groeps-/leeg-/laadstijl; per pagina als Rob verifiëren

- [x] Patient flow fixes (owner end-to-end 19-10): 1) /boeken zonder ?merk= valt terug op tbc-nl als host geen boekingsdomein matcht; 2) één tik mag nooit meer dan één stap overslaan (400ms negeren na stapwissel); 3) flowoverzicht-regel afleiden van resterende secties; 4) taillemeting-illustratie (SVG) + builder kan afbeelding kiezen/uploaden; 5) één instelling "Duur medische vragenlijst (minuten)" per behandeling (default 8) overal; 6) pictograminstelling voor subcategorieën en behandelingen met categorie-icoon als fallback; 7) eKis-mock opnieuw genereren (alleen artsen met ook niet-medisch-afvallen-behandelingen, alleen kliniekdagen, 1–3 blokken/week, 60–180 min variërend).
- [x] Startscherm voor patiënten via boekingslink met vaste behandeling (owner decision 19-10): behandelinstelling "Startscherm in de boekingsflow" (aan/uit, titel, tekst max 300, vorm Geen/Opsomming/Stappen/Ervaring/Behandelaars, knoptekst default "Kies waar en wanneer", EN optioneel) hergebruikt Boodschap-forms + runner-rendering; linkmodal bij vaste behandeling: Zoals de behandeling (default) / Eigen tekst / Geen startscherm met kleine preview; patiëntflow toont startscherm alleen bij link met vaste behandeling als eerste scherm zonder terugpijl, daarna locatiestap; behandelaarsfoto's en "Een arts neemt X minuten" verhuizen naar startscherm als het getoond wordt; seed Consult medisch afvallen (titel/tekst/Stappen, geen medicijnnamen). Verify: link met vaste behandeling toont startscherm → locatiestap; normale /boeken niet.
- [x] Boekingslinks gestructureerde UTM (owner decision 19-10, vervangt "UTM uit linknaam"): tab Kanalen en campagnes (beheer) met kanalen+plekken en campagnes (seedlijst, codes lowercase gevalideerd, code in gebruik onveranderbaar, archiveren i.p.v. verwijderen); linkmodal stap 5 "Waar gebruik je deze link?" (kanaal→utm_source/medium, plek→utm_content, campagne→utm_campaign, extra kenmerk, voorgestelde naam, geen vrij bronveld meer); unieke 6-teken hash per link, /boeken?link=<hash> + utm_id, bestaande links behouden oud adres + krijgen hash en kanaal Overig; modal toont volledige link + onderdelen met kopieerknoppen; overzicht toont Kanaal/Campagne met filters; statistiek-API per kanaal/campagne/link; boeking bewaart kanaal, plek, campagne, extra en hash. Verify as Rob: twee identieke links krijgen verschillende hashes; boeking via link toont kanaal, campagne en hash op de afspraak.

- [x] Dossier Toevoegen: owner-approved Contactmoment/notitie and Aanvraag fields, configurable selects/texts, follow-up tasks with completion and assignee Mijn dag list, timeline create/edit and readable audit; both saved/reloaded as Rob, aanvraag changed to In behandeling, follow-up completed in Mijn dag; all four writes found in audit.

- [x] Verification sweep as Rob: booking links created/edited/reloaded with patient preview, integrations/dashboard opened, mixed day/week and toggle saved/reloaded, online staff booking at 16:00 inside Dilan's clinic block; whole overview row opens with Bekijk; compact agenda blocks show patient number and treatment. Fixed blank slug on new link, empty select options and obscured overlapping roster blocks.
- [x] Owner decision 19-10: version-owned questionnaire thresholds/settings, backfill current values into all versions without patient changes, change badges/counter/publish summaries and archive/import/export preservation; Rob verified concept BMI 29 saved/reloaded, live BMI remained 30, Dutch publish summary, concept discarded without publishing.
- [x] Owner decision 19-10: external eKis busy-time provider with four-week mock, non-identifying hatched blocks in day/week/Mijn dag, shared patient/staff slot exclusion and save refusal, eKis-agenda status/show switch; Rob viewed doctor day/week/Mijn dag, setting saved/reloaded; patient flow for Dilan on 21 October offers 12:30 then 15:00, no overlapping slots. Shared exclusion test and database trigger protect staff saves even when display is hidden.

- [x] Questionnaire builder part 2: add chooser, Boodschap modal + runner forms, icon picker, publish modal, builder previews, condition value lines + short modal titles; verified as Rob (chooser, Boodschap add/edit/delete, icon picker, publish window, previews, value lines); 346 tests pass.
- [x] Consult mode app-wide: active draft consult of the signed-in user shows sticky bar + floating notes on every staff page until Consult afronden; position/size/collapsed/content persist across navigation and reload; last-saved time; bar with patient, time window, progress, clock, next patient, Meet, link to record; one active consult per user (finish or park); clear patient label on other records. Verify as Rob. — done, verified as Rob
- [x] Users, roles, logbook in Instellingen: new user (test mode: generated password shown once, else invite), edit role/deactivate/block/reset password, last-superadmin guard; roles create/edit/delete with landing page, consult mode, record visibility, permissions; logbook viewed rows for every staff route + record view, readable Dutch lines with links, filters (date, user, action, patient number), server pagination 50, CSV export. Verify as Rob.
- [x] Record/agenda fixes: patient URLs by patient number (/patienten/1000123/...), old UUID links redirect, every record link uses the number; Afspraak maken → Nieuwe patiënt in the same modal (first/last name, segmented DOB, e-mail, phone; duplicate check name+DOB and e-mail offering existing patient) and continue booking. Verify as Rob.
- [x] Demo e-mails: every mail moment renders via existing renderer/resolution into an outbox (recipient, subject, html, moment, appointment, created_at, sent_at, status); tab Verzonden e-mails with filters (date, moment, status, patient number) and exact preview; real delivery only to allowlist in Instellingen (default rob@bodyclinic.nl), others status 'alleen demo'; reminder timing from settings on existing schedule. Verify: patient booking → confirmation in outbox, as Rob.
- [x] Questionnaire versions flow (19-10, six screenshots): live read-only default, Aanpassen → concept with sticky bar and Gewijzigd/Nieuw labels, autosave, Opslaan en sluiten card, discard confirm, publish dialog with diff and running count, Versies dialog (view archive, use as concept, export/import), compact add list, right preview of selected row, overview Live/Concept pills. Starts after the queued tasks above.

- [x] Owner decision 19-10: no second factor in test-mode tenants (no enrollment step), real passwordless “Inloggen als Rob” (test mode only, server-checked); verified: button → dashboard → Vragen medisch afvallen → vraag 7 opened.

Owner asked to continue through all phases without pausing for confirmation.

- [x] Demo sign-in shortcut “Inloggen als Rob” sits above the login form, prefills the requested email and focuses password; existing password, lockout and MFA flow unchanged. Shortcut only shown in development preview.
- [x] Questionnaire review implementation: effective page/item Tonen and correct save target; flow-stored editable names; Dutch situation sentences; source-answer examples and resolved thresholds; unclipped language labels. 122 targeted tests passed; build OK. Passwordless/MFA-free demo superadmin excluded by mandatory staff security.
- [x] Questionnaire preview verification of questions 7, 8, 9 and question 8 signal: all three opened as Rob with readable conditions and patient previews; question 8 signal name changed in concept and read back in its modal after reload, then concept discarded. Threshold changes also saved/reloaded/discarded. Test-mode sign-in no longer blocked by MFA.
- [x] Owner follow-up investigated: existing sessions already persist; no proven update-triggered logout. No automatic login as Rob added because it would bypass required password/MFA authentication.

- [x] Repair MFA enrollment recovery: identity-only preview sessions lacked session_id and cannot enroll factors; now return to password sign-in, with restart action for other failures. Browser confirmed /auth without enrollment alert; 17 tests passed; build OK.
- [ ] Verify full password + TOTP sign-in after recovery: requires owner signing in normally; managed identity-only session cannot enroll MFA, and no current password is available to the test runner.

- [x] Online consult during clinic time: default-on block switch and roster video icon, mixed availability shared by patient/staff booking, practitioner-wide conflicts, online labels/icons and existing Meet actions; 49 tests passed. Patient flow booked Dilan Aydin on 19 October at 15:30 with Meet link; stored booking confirmed inside 09:00–17:00 clinic block.
- [x] Mixed-consult staff verification: as Rob, doctor day/week opened, Online consulten tussendoor saved off/reloaded/restored, online 16:00 staff booking read back in week agenda inside clinic time alongside 15:30 appointment.

- [x] Agenda: clickable practitioner headers open their personal day; shared fixed-position Dag/Week/Mijn dag controls verified after signing in as Rob, all four transitions keep x=1068/y=100; 18 relevant tests passed.
- [x] Changed password for rob@bodyclinic.nl to the privately supplied value; verified through the normal sign-in screen.

- [x] Phase 1 – Foundation
- [ ] Phase 2 – Organisatie (treatments, practitioners, locations, equipment, schedules)
- [x] Link uploaded team photos to practitioners; add remaining practitioners
- [x] Phase 2b – multi-tenancy retrofit (URL prefix /t/<slug>/ still open)
- [x] Equipment prompt (per location/room, generated names, kinds, maintenance)
- [x] Practitioners page shows the full list (owner request)
- [x] Practitioners list sorted alphabetically (owner request)
- [x] Practitioners: removed "x van y getoond · Toon alles" line
- [x] Phase 3 – Questionnaire builder, engine, versions, test mode, JSON import/export (seed imported)
- [x] Builder: active version clearly explained; rows open even when read-only
- [ ] Phase 4 – Patient booking flow
  - [x] 4a appointments + slot holds (15 min) schema, slot calculation rule with tests
  - [x] 4b booking entry (/boeken), category/subcategory/treatment, location (Online first), date/time, practitioner modes — booking-link table still to add
  - [x] 4c hold timer + expiry screen, triage + rejection variants (no answers stored, anonymous reason count)
  - [x] 4d details form (PDOK address lookup), confirmation, calendar file
  - [x] 4e medical questionnaire after booking (autosave, already completed, 24h edit window); resume screen per design (per-page progress, continue at first incomplete page), verified as patient in browser; missing screen texts (mq_*) added to questionnaire_ui
  - [ ] 4f manage appointment via mail link (calendar file, reschedule, cancel with reason)
- [x] 4f manage appointment (view, reschedule, cancel + reason)
- [x] Phase 5 – Agenda, Mijn dag, patient card, record, consult mode — done, verified as Rob
  - [x] 5a day agenda + appointment side card
  - [x] 5b week view, practitioner/category filter, "Afspraak maken" modal (new-patient creation from modal still open)
  - [x] 5c Mijn dag; removed test-environment banner (owner request);
  - [ ] 5d patient list + five-tab record; 5e consult mode; 5f schedule editing
  - [x] Standalone telephone/interim consult: design fields, secure save, Consulten and timeline; verified with test doctor, reload and timeline
  - [x] Dossier Toevoegen: shared appointment/consult/measurement/document modals; appointment and measurement saved from dossier and read back after reload; role permissions checked
  - [x] Contactmoment/notitie and aanvraag: owner-approved fields implemented and verified as Rob; see completed dossier task above.
  - [x] Owner report: BMI from saved weight/height in Medisch and Overzicht; measurements visible in timeline; verified signed in, saved and reloaded
  - [x] Owner report: dossier tabs showed old placeholder — code and served modules verified current; stale preview tab (needs hard reload)
- [ ] Phase 6 – Mails and integrations
  - [x] Medical-weight-loss category confirmation: supplied Dutch copy, shared introduction/signature/questionnaire/details surface and online/clinic variants; saved/reloaded as MFA admin, address and phone overflow verified; base template unchanged
  - [x] Shared escaped table-based mail document and preview: supplied mail palette, local Open Sans, four dots and detail cards; authenticated online/clinic and phone previews verified without overflow; 34 mail tests passed
  - [x] Private image upload/library, practitioner signature preview and phone-format toggle; upload, save/reload and library selection verified as admin with MFA; 31 domain tests passed
  - [x] Template management foundation: moment and treatment views, category/treatment overrides, ordered conditional blocks, Dutch/English fallback; authenticated save and reload verified; 22 domain tests passed
  - [x] Injectables mail mechanics: base confirmation now has the nine blocks from the supplied designs (category image with template fallback, clinic/online intro and details variants, preparation, Vragen with omschrijving, Verhinderd with {annuleringstermijn} and conditional no-show sentence); cancel policy resolves treatment > category > Algemeen and also drives the manage window; injectables categories set to 48h/EUR60; category mail image editable on the category; 31 domain tests green. Standalone hero/logo assets remain absent from the package
  - [ ] Test and automatic mails: blocked on verified sender setup; no outbound mail wired yet
  - [x] Google Meet interface/mock, eKis export stub, statistics API, booking links with sources
    - [x] Booking links: list with usage, five-step create/edit modal (treatment, locations, practitioner choice, language, name/source), preview of what the patient sees, short link + copy; `?merk=` only for test brands
    - [x] eKis: daily 06:00 export per brand behind an interface with a mock file (new patients, patient number, answers, since last run), manual "Nu exporteren", download of the made file, cron endpoint refuses callers without the schedule token
    - [x] Statistics API: totals only (arrivals, appointments, no-shows, occupancy, triage reasons, per source), own key per brand, every pull logged, refuses unknown keys with "ongeldige sleutel"
    - [x] Google Meet: provider interface + mock (link kept when moving, same link on repeat), account shown and editable on Koppelingen, link visible in agenda, Mijn dag and the record
    - [x] Koppelingen and Dashboard screens built from the design reference; fixed texts read from option lists `koppelingen_ui` / `dashboard_ui`
    - [x] Links verified from the patient side: a link with a fixed treatment opens straight at the time choice (practitioner "Geen voorkeur"), a link without one starts at the category choice narrowed to what the link's location offers, an unknown link falls back to the normal entry; the statistics and export endpoints refuse callers without a key or token
    - [x] Staff screens (Boekingslinks, Koppelingen, Dashboard) opened as Rob; create/edit and patient preview checked; fixed new-link save.
- [x] Medical questionnaire: 'Val je af of kom je nog aan?' had no answers in the seed; v2 adds them from the design HTML
- [x] Questionnaire runner: pressing the button with missing/invalid answers highlights them and scrolls to the first (owner request)
- [x] Vragenlijst: volgende pagina begint bovenaan
- [x] Vragenlijstbouwer: vragenpagina (groep) verslepen en inklappen
- [x] Behandelingen afvinken in behandelaar-modal
- [x] UTM bij boekingslinks (owner bevestigd: automatisch vullen uit linkgegevens, geen aparte velden): kopieerbare link met utm_source (rapportagebron, anders linknaam) en utm_campaign (linknaam); boekingsflow bewaart utm_source als bron zonder link; 12 domaintests groen
- [x] Instellingen > Algemeen: kaart Merk met tenantgegevens (naam, land, tijdzone, boekingsdomeinen, testmodus); bewerken alleen voor groepsbeheerders (RLS), overigen alleen-lezen. Talen/e-mail waren al tenant-scoped instellingen. Browsercheck open: aal2 nodig

- [x] Login boven de organisaties (groepsbeheerder zonder lidmaatschap, alle merken in wisselaar, superadmin-rechten overall).
- [x] BUG: na wisselen naar merk zonder lidmaatschap laadt de site niet meer — current_tenant() gaf null voor groepsbeheerder zonder lidmaatschap (0029 honoureert de claim voor groepsbeheerders); geverifieerd met gesimuleerdeJWT-claims (tenant/rol/permissies kloppen, my_tenants markeert actief merk).
- [x] Testdata gebruikerslijst opgeruimd: echte teamnamen uit team.csv; superadmin@example.test heet nu Rob Reintjens en is alleen superadmin van tbc-nl (groepsbeheer en tbc-de-lidmaatschap verwijderd; Djilly Ybema is superadmin van tbc-de); groepsbeheer blijft op group-admin@example.test.
- [x] 2FA-knop bleef inactief als de factor-lookup na inloggen wegviel: knop nu actief bij 6 cijfers, factor wordt luie opgehaald, laadfouten tonen een melding i.p.v. een dood scherm.
- [x] Desktop-kader voor patiëntschermen (Salonized-stijl): gedeelde PatientFrame (gecentreerde witte kaart, rounded 24, mist-border, zachte schaduw op sand) rond boeken, vragenlijst (incl. runner) en afspraak-beheer; mobiel ongewijzigd. Desktop + mobiel geverifieerd in browser, tsgo clean.
- [x] Desktop-kader: bollen verder vergroot (16px)
- [x] Uitzoeken: "lege bolletje" in bovenbalk (Rob vraagt waar het voor dient) — was het checkbox-vinkvakje zonder zichtbaar label.
- [x] Leeg bolletje in Pagina wijzigen = checkbox met onzichtbaar label: Checkbox toont nu het label; dubbel label in consultchecklist weggehaald.
- [x] Uitslagpagina-verfraaiing builder-gestuurd houden: icoon-badge in de runner stijlt alleen het icoon dat de pagina-config kiest, geen hardcoded icoon.
- [x] Triage-uitslagpagina: icoon-badge gecentreerd en groter (72px cirkel met 34px teken) zoals het ontwerp ma-10-goed-nieuws.dc.html; alleen die icoonpagina in de flow heeft een icoon.
- [x] Opsomming van antwoorden op de reviewpagina tonen of verbergen: kan al door de vraag "Klopt alles?" van de pagina te halen (owner: "ow, dat kan al"); de extra editor-switch die ik daarvoor bouwde is weer weggehaald.

Pickercontrole 19-10: als Rob locatie zoeken op Amsterdam, adres zichtbaar, ArrowDown/Enter, Online als chip in nieuwe behandelaar; bestaande Select/MultiSelect-velden delen de picker. Meervoudige link: Medisch afvallen met Caroline Albers en Dilan Aydin opgeslagen en herladen; patiëntvoorbeeld beperkt tot Consulten/Programma.

UTMcontrole 19-10 als Rob: campagne opgeslagen; twee identieke Instagram/story-links kregen 3zcovr en 4ncg66. Vervolgconsult via ojwtfo geboekt, afspraakkaart toont Instagram · story · Najaar 2026 roadmap · ojwtfo.

Startschermcontrole 19-10 als Rob: behandelstartscherm opgeslagen/herladen; 3zcovr toont titel, drie stappen en artsduur zonder terugknop, knop opent locatiekeuze; normale /boeken toont categorieën zonder startscherm.

Keuzekaartcontrole als Rob: aanbevolen online kaart zandkleur; muis verandert naar donkerder zand, teal rand; vragenlijst Starten → Tab toont 2px teal focusring.

- Taak 6 geverifieerd als Rob: alle twaalf overzichten geopend; patiënt-, behandelaar-, locatie-, behandeling-, vragenlijstrij opent detail, apparatuur/boekingslink/rol/mail opent pop-up, logboeklink opent doelpagina. E-mails delen ListPage en DataTable; geen Wijzig-links op de overzichten.

- Taak 7 geverifieerd als Rob: drie tabs, globale zoekterm verzet vindt Afspraak verzet, rij opent editor, basissjabloon opgeslagen/herladen, afwijkingspicker kiest behandeling, Per behandeling toont Categorie Medisch afvallen als winnaar met voorbeeld, verzonden bevestiging opent patiëntvoorbeeld. 70 gerichte tests groen en actuele build OK.
- Pickervervanging: gedeelde Select/MultiSelect omvat boekingslink-behandelingen/categorieën/locaties/behandelaars, Afspraak maken, agenda/roosterfilters, behandelaar- en behandeling-koppelingen, apparatuur, vragenlijst Gekoppeld aan, e-mail Geldt voor en behandeling/categorie, dossier Aanvraag arts en vervolgactie Voor wie, gekoppelde behandelaar bij gebruikers, lijstfilters.

## Eigenaar-review lijstpatroon 19-10 14:57 UTC
- [x] Boekingslinks-overzicht als echte tabel (Naam+linkcode, Kanaal+campagne, Behandelingen, Locaties kort "Online en 12 klinieken", Behandelaars, Boekingen, Status); link "Kanalen en campagnes" uit filterrij; als Rob geverifieerd: rij-klik opent de link-pop-up
- [x] Apparatuur op gedeeld ListPage: één tabel per locatie (groepskop met locatie, kamertal, "+ Kamer"), kolommen Apparaat/Soort/Kamer/Vast of verplaatsbaar/Onderhoud, reizende apparaten als eigen groep met weekschema; rij opent apparaat-pop-up; als Rob geverifieerd
- [x] Rij-klik ook op detailpagina's: rooster-uitzonderingen, kamers op locatie, behandelingen bij behandelaar, behandelaars bij behandeling, benodigdheden, berekende velden en bouwerrijen (chevron i.p.v. Wijzig); rowOpen gedeeld vanuit ListPage, hover/focus-stijl geldt nu overal; als Rob geverifieerd op zes pagina's, 0 Wijzig-links op de bouwer
- [x] Dubbele telling weg: DataTable toont geen telling meer; telling staat alleen in de filterrij (aangevuld op Patiënten, Logboek, Verzonden e-mails, Kanalen en campagnes, Boekingslinks); "55 behandelaars" nog één keer

## Dokterskant end-to-end-test 19-10 (patiënt 1000007 Eva Proefrun)
- [x] Dossier › Medisch: Eva's tien opgeslagen triagevelden in negen vragen in oorspronkelijke vraagvolgorde, lengte/gewicht samen en buikomvang gemarkeerd; als Rob gecontroleerd
- [x] Signaal: "Groen, met signaal: vergrote buikomvang (95 cm)" in Overzicht; pil in dossierkop, patiëntkaart agenda en Mijn dag; op Eva als Rob gecontroleerd. Ontbrekende historische versie-id hersteld op basis van publicatietijd; toekomstige boekingen bewaren versie-id; gedeelde berekening gebruikt uitsluitend die versie
- [x] Nederlandse tijd: Eva toont 19 oktober om 14:23 vanuit volledige afrondingstijd; datum-only metingen krijgen geen fictieve kloktijd; intake/metingen en bestaande tijdlijn/afspraakweergaven gecontroleerd, zomer/wintertijd getest
- [x] Consultpaneel: patiëntnummer normaliseren naar string; Eva's eigen dossier en tabs zonder waarschuwing, ander dossier met Eva-waarschuwing; als Rob gecontroleerd
- [x] Consultbalk: op Eva "Begint morgen om 11:00" gecontroleerd als Rob; minuten tot start binnen uur en resterende consulttijd pas vanaf start getest. Consult teruggeparkeerd, notities ongewijzigd

Verificatie 19-10: alle vijf punten op 1000007 als Rob doorlopen; 58 gerichte tests groen, build OK. Bestaande sign-in-queryannulering (CancelledError in auth.2fa goLanding) waargenomen bij login; geen fout in de vijf gecontroleerde dossier/agenda-resultaten.

## Dossier en gegroepeerde tabellen 19-10 16:27–16:28 UTC
- [x] Anamnese en behandelplan: gedeelde aanklikbare veldrijen met chevron en focusring; alle 12 anamnesevelden en 6 behandelplanvelden op Eva 1000007 als Rob met Enter/Spatie geopend en juiste focus gecontroleerd. Beide bestaande opslagacties met wijziging/heropenen/terugzetten geverifieerd; vijf dossiertabs zonder Wijzig-knop of -link. Consultopslag ongewijzigd.
- [x] Apparatuur: gedeelde vaste kolomindeling; zeven gevulde locatiegroepen identiek uitgelijnd, inclusief Amsterdam Buitenveldert/Amsterdam-Zuid, als Rob gecontroleerd. Ook basissjablonen/afwijkingen dezelfde gedeelde indeling en echte rijen gecontroleerd; behandelingen gebruiken al vaste gedeelde grids, rollen één tabel. Build OK.

## Mijn omgeving v0.2 — eigenaar 20-10 11:15 UTC (alle fasen nu, zonder wachten)
- [x] B: cosmetische schermen — nieuwe Start (arts-kaart, behandeltraject, feedbackkaart, Opnieuw boeken, Bekijk deze behandelingen), feedbackscherm /mijn/feedback/$id + treatment_feedback + beheerweergave, behandelaarsfoto's overal (Hugo Ammerlaan, Sophie Verhagen, Simone Mulder), initialen zonder tussenvoegsels, Afspraak maken met foto's, behandelinstellingen + "Bekijk als patiënt"
- [x] C: inloggen vanuit boeking — B2-loginbalk (teal, "Eerder bij ons geweest? Log in, dan staan je gegevens klaar"), /boeken/inloggen met "Je keuze blijft bewaard", server-side concept aan de link, 15 min vasthouden, vier herstelscenario's, bevestigingsmail bij ronde boeking, stap 5 in linkbuilder met preview-balk, Joyce-footer

## Eigenaar-review B/C 20-10 12:07 UTC — fixes voor D/E
- [ ] 1. Profiel §5.5: avatar (initialen-helper "SV"), naam, e-mail, bewerkknop; Account-rijen (Persoonsgegevens, Adres, Facturen, Toestemmingen, Meldingen, Privacy) in witte kaart met grijze chevron; Uitloggen
- [ ] 2. Rol ontbreekt: portal leest practitioner_roles (niet roles); "Ook jouw huidtherapeut", "{naam}, {rol}"; artsentitel "Drs. Hugo Ammerlaan" (title-kolom)
- [ ] 3. Historie-filterpills: sitecategorieën (toplevel via parent_id), geen interne groepen
- [ ] 4. Behandeliconen: fallback op categorie-icoon bij leeg treatment.icoon (Historie, volgende afspraak, behandeltraject)
- [ ] 5. "Bekijk deze behandelingen eens": alleen categorieën zonder historie (toplevel-vergelijking)
- [ ] 6. Demo: Sanne's test-feedback weg zodat de feedbackkaart weer verschijnt
- [ ] 7. /boeken/inloggen: boekingsheader (terug, logo, sluiten), "Terug"-link, "Liever bellen?"-footer met Joyce
- [ ] 8. Desktop Start ≥1024px: links behandeltraject, rechts arts+feedback+opnieuw boeken, ontdekken volle breedte eronder
- [ ] D: medisch-afvallenschermen (Start, Voortgang, Programma, Afspraken) met foto's en visuele regels v0.2
- [ ] E: bestellen met pakketkiezer-states + afrekenflow (geen outlines; geselecteerd gevuld teal, toegestaan #EEF3F5, twee stappen amber, niet-toegestaan grijs; legenda; kaarten zonder randen)

## Portal review-fixes + fase D/E (20 okt, Rob)
- [x] Profiel-scherm (avatar SV, account-rijen, uitloggen)
- [x] Rollen en titels bij behandelaars (Drs. Hugo Ammerlaan, huidtherapeut)
- [x] Historie-filters op sitecategorieën
- [x] Iconen met categorie-fallback
- [x] Ontdek-kaarten alleen voor nog niet gehad
- [x] Feedbackkaart zichtbaar voor Sanne (testfeedback verwijderd)
- [x] Boeking-login: header, Terug, Joyce-footer
- [x] Desktop Start in twee kolommen
- [x] Fase D: Voortgang (3 tabs), Programma, Afspraken
- [x] Fase E: Bestellen met pakketkiezer + afrekenflow (demo-betaling)
- [x] Open: volledige Betaal-klik door de afrekenflow heen nog eind-tot-eind testen

## Booking flow review 20-10
- [x] Joyce + practitioner photos as local files
- [x] "Je keuze blijft bewaard" shows day + time
- [x] Planner selected slot/day filled teal, white text
- [x] Profiel "Bewerken" light-teal pill, no border

## EPD v0.1 — eigenaar 20-10
- [x] Fase 1: Vragenbibliotheek (codes, soorten/groepen uit keuzelijsten, voorwaarde, "Gebruikt in", wijziging maakt concepten van sjablonen en vragenlijsten), menu-groep Dossier, "Uit de bibliotheek" in de vragenlijstbouwer met link-icoon, Dossiersjablonen met versies (live alleen-lezen, Aanpassen → concept met autosave, publiceren, Versies, archief), seed Medisch afvallen › Consult en Injectables › Botox + 16 voorbeeldvragen, 9 nieuwe rechten
- [x] Fase 2: consultstappen in de consultmodus (stepper, medische status, anamnese met sjabloon/dicteer, diagnose/btw, recept, behandeling met lot/foto's/tekening, afronden, dossierkaarten); Mark en Sanne als Rob geverifieerd, zie reviews hieronder
- [ ] Fase 3: statussen + no_show-fix, Receptie, Dag per locatie, annuleren, Afspraak maken uitbreiden, Mijn dag, patiëntmails
- [ ] Fase 4: Afrekenen en factuur
- [ ] Fase 5: Beheer (behandeling-kaarten, Formulieren en nazorg, Adresboek, Koppelingen-kaarten, Data-API)
- [ ] Fase 6: Mijn omgeving-blokken + demodata; eindtest Sanne en Mark
- [x] Patiënt-loginpagina: gedeelde directe demo-loginknoppen op /auth, /boeken/inloggen en /mijn; Sanne cosmetisch, Mark actief afvallen, Eva gestopt en Sandra starter; alle vier aangeklikt en eigen Mijn omgeving/Profiel geverifieerd
- [x] Review 21:28: consultstappen binnen ActiveConsultMode direct onder de bestaande balk; geen Stappen-link/aparte pagina, dossier blijft staan. Als Rob op /patienten/1000009 getest.
- [x] Review 21:28: Sanne vandaag Fronsrimpels; twee zoneregels met DEMO-FRONS-2026, Laatst gebruikt hergebruikt; foto via ingelogde-loze QR-pagina ontvangen, vijf injectiepunten, 4/4 controles, klaar voor betaling met receptienotitie. Als Rob getest.
- [x] Review 21:28: eerste Consult medisch afvallen van Mark; twee fiscale vragen, artsbesluit en Vastgelegd door Rob Reintjens, 20 oktober om 23:37; ook na verversen geverifieerd.
- [x] Review 21:39: gemelde link was al gebruikt binnen één seconde na aanmaken; heropenen gereproduceerd. Met geldige geverifieerde patiëntsessie opent hergebruik nu Start; zonder sessie blijft eenmalig gebruik vereist. Nieuwe login en heropenen beide browser-getest.
- [x] Review 21:52, opnieuw als Rob: consultstappen op /patienten/1000009 bij de bestaande consultbalk, nul aparte Stappen-links. Bestaande balk en notitiepaneel behouden.
- [x] Review 21:52, Sanne: Fronsrimpels vandaag 20 oktober 16:00; twee zones, Laatst gebruikt DEMO-FRONS-2026, verse QR-upload zonder login op telefoonformaat, vijf presetpunten, vier controles, klaar voor betaling met receptienotitie. Dubbele testregels opgeruimd tot één regel met twee zones.
- [x] Review 21:52, Mark: eerste Consult medisch afvallen; twee fiscale vragen opnieuw ingevuld, vrijstellingsbesluit Vastgelegd door Rob Reintjens, 20 oktober om 23:58; na verversen behouden. 18 gerichte consulttests groen.
- [ ] Volgende ronde: fase 3 uitvoeren (statussen, Receptie, Dag per locatie, Afspraak maken), zonder bevestigingspauze; bestaande vormgeving behouden.
- [x] Fase 3 deelcontrole: als Rob Gearriveerd opgeslagen/heropend met auteur/tijd/notitie, Sanne bij Klaar voor betaling, online afspraak gemaakt en teruggelezen, toegestane dubbelboeking met reden opgeslagen en audit gecontroleerd; Utrecht-agenda heeft kamer/apparatuurkolommen. 448 tests groen, 22 integratietests overgeslagen, actuele build OK.
- [x] Fase 3 review 22:57 als Rob: bestaande afspraak verzet naar 09:30 en na verversen teruggelezen; berichtkeuzes behouden. Sms voor verzetten als demo geregistreerd en in afspraakgeschiedenis zichtbaar. Wachtlijstpatiënt tentatief om 10:00 ingepland; afspraak zichtbaar en wachtlijst leeg na verversen. Voorbereiding toont ontbrekende gegevens en verlopen/ontbrekende vragenlijst. Adresboek bewerkt en teruggelezen; audit gecontroleerd. Annulering met reden → €25 demo-betaalverzoek → betaald → receptie toont Betaald. Tijdelijke tarief- en plaatswijziging hersteld. 455 tests groen, 22 integratietests overgeslagen; build OK. Preview-routercache vernieuwd na gereproduceerde 404, daarna volledige betaalroute geslaagd zonder browserfouten.
- [ ] Fase 3 resterend: volledige toestemmingsgeldigheid/ondertekenroute en ontbrekende-gegevensmail, berichtmatrix voor publieke boekingen, arts/receptierolcontrole, gekoppelde agenda-highlighting/legenda en uiterlijkvergelijking. Daarna pas fase 4. Eigenaar 22:41: doorgaan zonder pauze.
