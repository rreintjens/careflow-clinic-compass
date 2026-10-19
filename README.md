# Careflow Clinic Compass

# The Body Clinic – booking, agenda and patient record: master prompt for Lovable

You are building a web application for The Body Clinic (TBC), a Dutch chain of cosmetic and medical weight-loss clinics. It replaces the current online booking widget and agenda (eKis) and is the reference for a later production EPD. It runs on test data only; no real patient data is ever entered.

Everything in this prompt is a hard requirement unless it says "proposal". Build exactly the screens, fields and rules in the attached design package; do not invent screens, fields or copy, and do not simplify a flow because it seems complex.

## Attached package (read all of it before writing code)
0. `02_ENGINEERING_AND_SECURITY.md` – binding rules for how to build: simplicity, data classification, security architecture, GDPR, logging, test data and the go-live gate. Read it first; it overrides your defaults.
1. `tbc_flow_medisch_afvallen_v0.2.json` – the complete configuration of the first flow (treatment "Consult medisch afvallen"): settings, computed fields, the triage questionnaire before booking and the medical questionnaire after booking, with every page, question, option, condition and outcome, plus `treatment_fields`, `roles` and `ui_rules`. Import it as seed data on first run. Nothing in it may be hard-coded; all of it must be editable in the admin.
2. `screens_inventory.json` – every designed screen (103) with its canvas row, title, headings, field labels, select options, buttons, links, table headers and status pills. This is the field list you build; a field that is there must exist, a field that is not there must not be added.
3. `design_reference_html/` – the HTML of every designed screen plus `canvas.json` (positions and titles). Use it for layout, spacing, colours and component shapes. Images and photos reference assets that are not included; use placeholders.
4. `ui-icons/` (63 line icons with `icons.json` search tags) and `treatments-icons/` (66 treatment icons, 8 category icons). Use only these icons; never emoji or filled icon sets.
5. `screens_png/` – a PNG of every designed screen, in a folder per canvas row, plus one overview JPG per row. The PNG is the visual truth when HTML and PNG differ. Photos and treatment icons are placeholders in these renders.

## Language
- All patient-facing text is Dutch, in the informal "je" form, and must come from editable configuration with a Dutch and an English field per text (English falls back to Dutch when empty).
- Admin UI labels are Dutch as designed. Code, identifiers, comments and this prompt are English.

## Design system (from bodyclinic.nl)
- Font Poppins 300/400/500/600; one weight per heading.
- Colours: teal `#317689` (hover `#255664`), text `#39332E`, helper text `#6B645E`, sand `#F7F2F0`, mist `#E0E5E7`, teal light `#EAF1F3`, warning/terracotta `#A14A12` with `#FBEFE6`, signal yellow `#FFF8EC` with border `#E9D3A5`. Dark brown is text only, never a background.
- Pill buttons (radius 999px, height 44–54px), cards radius 14–20px, inputs on sand background without borders, 1.6–1.8px line icons.
- Patient screens are mobile-first at 390px; admin screens are desktop at 1440px with a 248px left menu.
- E-mails follow the attached mail designs exactly (hero image, title with four teal dots, sand card, dark teal detail card `#2A5666`, light teal buttons `#4D94AE`, Open Sans).

## Non-negotiable UI rules (also in `ui_rules` of the JSON)
- Any field with a finite set of values is a select with those values; never a free text field with an example value.
- Every edit or add in the admin happens in a modal above the page, never in fields appearing at the bottom.
- One identical patient card wherever a patient is clicked (agenda, Mijn dag, patient list): short, primary action "Open dossier", Meet button, signals, five facts.
- The patient record has exactly five tabs: Overzicht, Tijdlijn, Medisch (intake, anamnese, metingen), Behandeling (consult, behandelplan, afspraken), Documenten. Tabs are separate routes, not anchors.
- Consult mode: a sticky consult bar (patient, time window, remaining-time progress, clock, next patient, Meet, agenda) and a draggable floating notes panel (S/O/E/P fields and an eight-step checklist) that autosaves on every keystroke, shows the last-saved time, and persists across tabs, the agenda and other records until "Consult afronden".
- Menu and tab labels never wrap; rows scroll instead.
- Cards use their full width.
- Multi-choice questions can have an exclusive option ("Geen van deze") that clears the others and is cleared by them.
- Follow-up questions appear under their parent on the same page, without reload.
- Date of birth is a segmented field dd-mm-jjjj: digits only, auto-advance, validation after the year, age shown.

## Architecture (details and binding rules in `02_ENGINEERING_AND_SECURITY.md`)
- Frontend: React + TypeScript, Tailwind with the tokens above, React Router; patient flow and admin are two route trees in one app.
- Backend: Supabase (Postgres, Auth with TOTP second factor, Row Level Security by role, Storage for documents, Edge Functions for mail, Meet and export). Hard: every read and write of patient data is logged to an audit table with user, time, record and action.
- Data model (hard): patients (unique patient number from 1000001), appointments, practitioners, locations with rooms and equipment, treatments with categories and subcategories (many-to-many), schedules (recurring blocks plus exceptions), booking links, questionnaires with versions, answer sets bound to a version, mail templates with scope (base/category/treatment) and conditional blocks, settings, roles with permissions and landing page, consult notes, treatment plans, measurements, timeline events, signals.
- Google Meet: one linked Google account creates a calendar event with a unique Meet link per online appointment and invites the practitioner; rescheduling keeps the link. Stub it behind an interface with a mock in test mode.
- eKis: a daily export file at 06:00 with new patients and answers; stub.
- Statistics API: aggregated counts only, no personal data, key per integration.

## Flow logic that must be exact
- Triage red outcomes: age outside 18–85; BMI below 18; middle BMI group (25–30, or 23–27.5 with reduced thresholds by origin) with no weight-related condition, no enlarged waist and no burden; low BMI group with no weight history and no medication; a hard condition; MEN 2; a mental situation. BMI 30 or more (27.5 reduced) skips the weight questions. On red: release the reserved slot, show the matching rejection variant, do not store answers, count the reason anonymously, no e-mail (an optional field lets the patient request the text by e-mail).
- A slot is held 15 minutes during triage and details (setting); after that the patient sees "Je tijd is verlopen" and keeps their answers.
- The medical questionnaire after booking never rejects; it stores answers and raises signals for the doctor (lithium, allergy to GLP-1 agents, pancreatitis, familial thyroid cancer, enlarged waist, burden, low BMI route).
- Nothing asked in the triage is asked again later; the details form reuses date of birth; the medical questionnaire prefills from triage.
- Mails: seven base templates by moment; variation through treatment fields (`{behandeling_omschrijving}`, `{voorbereiding}`, `{nazorg}`), conditional blocks (online/clinic, new/existing patient, has questionnaire) and overrides per category or treatment that win over the base.

## How to work
Build in the six phases in `01_PHASES.md`, one phase per conversation turn, and stop after each phase with the acceptance checklist filled in. Do not start the next phase before the owner confirms. When something in the package is ambiguous, pick the reading that matches the HTML and PNG designs and state your assumption in one line; never ask the owner to re-explain what is in the package.

Start with Phase 1 – Foundation as defined in `01_PHASES.md`:
- Design tokens and components (pill button, card, select, segmented control, modal, sidebar with the four menu groups: Dashboard/Agenda/Patiënten; Organisatie; Boekingsflow; Instellingen)
- Auth with e-mail+password and TOTP
- Roles with landing pages (`roles` in the JSON)
- Audit log
- Settings page "Algemeen" with every select from the design
- Acceptance criteria: login → 2FA → landing by role works; all menu items route; settings persist; audit rows written; RLS deny-by-default proven with one test per role on one classified table; security headers present; test-mode banner visible.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://careflow-clinic-compass.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/de5e08e0-eec7-4ea8-b7b8-379c14efba48).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
