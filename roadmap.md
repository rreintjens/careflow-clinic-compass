# Roadmap

Owner asked to continue through all phases without pausing for confirmation.

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
  - [x] 4e medical questionnaire after booking (autosave, already completed, 24h edit window) — resume screen design still to match
  - [ ] 4f manage appointment via mail link (calendar file, reschedule, cancel with reason)
- [x] 4f manage appointment (view, reschedule, cancel + reason)
- [ ] Phase 5 – Agenda, Mijn dag, patient card, record, consult mode
  - [x] 5a day agenda + appointment side card
  - [x] 5b week view, practitioner/category filter, "Afspraak maken" modal (new-patient creation from modal still open)
  - [x] 5c Mijn dag; removed test-environment banner (owner request);
  - [ ] 5d patient list + five-tab record; 5e consult mode; 5f schedule editing
- [ ] Phase 6 – Mails and integrations
- [x] Medical questionnaire: 'Val je af of kom je nog aan?' had no answers in the seed; v2 adds them from the design HTML
- [x] Questionnaire runner: pressing the button with missing/invalid answers highlights them and scrolls to the first (owner request)
- [x] Vragenlijst: volgende pagina begint bovenaan
- [x] Vragenlijstbouwer: vragenpagina (groep) verslepen en inklappen
- [ ] Behandelingen afvinken in scherm uit screenshot 02.02.57
