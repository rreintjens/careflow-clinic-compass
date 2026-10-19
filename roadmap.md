# Roadmap

- [ ] Questionnaire builder part 2: add chooser, Boodschap modal + runner forms, icon picker, publish modal, builder previews, condition value lines + short modal titles; verify each screen as Rob.
- [ ] Consult mode app-wide: active draft consult of the signed-in user shows sticky bar + floating notes on every staff page until Consult afronden; position/size/collapsed/content persist across navigation and reload; last-saved time; bar with patient, time window, progress, clock, next patient, Meet, link to record; one active consult per user (finish or park); clear patient label on other records. Verify as Rob.
- [ ] Users, roles, logbook in Instellingen: new user (test mode: generated password shown once, else invite), edit role/deactivate/block/reset password, last-superadmin guard; roles create/edit/delete with landing page, consult mode, record visibility, permissions; logbook viewed rows for every staff route + record view, readable Dutch lines with links, filters (date, user, action, patient number), server pagination 50, CSV export. Verify as Rob.
- [ ] Record/agenda fixes: patient URLs by patient number (/patienten/1000123/...), old UUID links redirect, every record link uses the number; Afspraak maken → Nieuwe patiënt in the same modal (first/last name, segmented DOB, e-mail, phone; duplicate check name+DOB and e-mail offering existing patient) and continue booking. Verify as Rob.
- [ ] Demo e-mails: every mail moment renders via existing renderer/resolution into an outbox (recipient, subject, html, moment, appointment, created_at, sent_at, status); tab Verzonden e-mails with filters (date, moment, status, patient number) and exact preview; real delivery only to allowlist in Instellingen (default rob@bodyclinic.nl), others status 'alleen demo'; reminder timing from settings on existing schedule. Verify: patient booking → confirmation in outbox, as Rob.

- [x] Owner decision 19-10: no second factor in test-mode tenants (no enrollment step), real passwordless “Inloggen als Rob” (test mode only, server-checked); verified: button → dashboard → Vragen medisch afvallen → vraag 7 opened.

Owner asked to continue through all phases without pausing for confirmation.

- [x] Demo sign-in shortcut “Inloggen als Rob” sits above the login form, prefills the requested email and focuses password; existing password, lockout and MFA flow unchanged. Shortcut only shown in development preview.
- [x] Questionnaire review implementation: effective page/item Tonen and correct save target; flow-stored editable names; Dutch situation sentences; source-answer examples and resolved thresholds; unclipped language labels. 122 targeted tests passed; build OK. Passwordless/MFA-free demo superadmin excluded by mandatory staff security.
- [ ] Questionnaire preview verification of questions 7, 8, 9 and question 8 signal: blocked because restored managed session reaches /auth/2fa; normal MFA-verified owner sign-in required. UI save targeting tested, authenticated save/reload and visual comparison remain unverified.
- [x] Owner follow-up investigated: existing sessions already persist; no proven update-triggered logout. No automatic login as Rob added because it would bypass required password/MFA authentication.

- [x] Repair MFA enrollment recovery: identity-only preview sessions lacked session_id and cannot enroll factors; now return to password sign-in, with restart action for other failures. Browser confirmed /auth without enrollment alert; 17 tests passed; build OK.
- [ ] Verify full password + TOTP sign-in after recovery: requires owner signing in normally; managed identity-only session cannot enroll MFA, and no current password is available to the test runner.

- [x] Online consult during clinic time: default-on block switch and roster video icon, mixed availability shared by patient/staff booking, practitioner-wide conflicts, online labels/icons and existing Meet actions; 49 tests passed. Patient flow booked Dilan Aydin on 19 October at 15:30 with Meet link; stored booking confirmed inside 09:00–17:00 clinic block.
- [ ] Mixed-consult staff verification: blocked by authenticator enrollment rejecting the fresh managed session. Doctor day/week, switch save/reload and staff booking cannot be verified in the browser until normal staff MFA succeeds; no clinic appointments currently surround the chosen test doctor's booking.

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
- [ ] Phase 5 – Agenda, Mijn dag, patient card, record, consult mode
  - [x] 5a day agenda + appointment side card
  - [x] 5b week view, practitioner/category filter, "Afspraak maken" modal (new-patient creation from modal still open)
  - [x] 5c Mijn dag; removed test-environment banner (owner request);
  - [ ] 5d patient list + five-tab record; 5e consult mode; 5f schedule editing
  - [x] Standalone telephone/interim consult: design fields, secure save, Consulten and timeline; verified with test doctor, reload and timeline
  - [x] Dossier Toevoegen: shared appointment/consult/measurement/document modals; appointment and measurement saved from dossier and read back after reload; role permissions checked
  - [ ] Contactmoment/notitie and aanvraag: blocked on missing exact fields/layout in supplied design package; no invented forms
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
    - [ ] Staff screens (Boekingslinks, Koppelingen, Dashboard) not yet opened in a browser: they need a second-factor session and the test staff password is not available in this environment
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
