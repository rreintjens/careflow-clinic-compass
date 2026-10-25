<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules (The Body Clinic)
- `src/features/questionnaire/` (also library questions, dossier templates) and `src/features/mail/` have their own `AGENTS.md`; read them first.
- Read the design package first; its security rules override defaults. Build phases in order without confirmation pauses.
- TanStack Start (not React Router); app-internal server logic in `createServerFn`, never new Edge Functions — platform stack.
- Tested logic in `src/domain/`, queries in `src/data/`, shared UI in `src/components/`; extend props, never duplicate.
- Mobile staff navigation uses the same Sidebar contents in an accessible Radix drawer; shared headers/modals reflow; wide table/tab regions scroll locally, but the agenda grid never scrolls vertically on its own (owner rejected scroll-in-scroll): it grows with the page, its header row is a page-sticky strip synced to the grid's horizontal-only scroll.
- Agenda shares AgendaToolbar; booking shares slots with online-location IDs/block flags to prevent mixed-consult conflicts.
- Agenda filter pills reuse SearchablePicker's below-selection rendering for single and multiple selection; selectionOptions excludes all-options so clearing a pill restores the unfiltered state.
- Organisation reference reads use one authenticated server function with at most six concurrent RLS reads; agenda reuses that query cache, warms references after staff sign-in, and shares week appointment ranges across day/week navigation to avoid duplicate requests. Schedule edits invalidate agenda references.
- Reference SELECT policies evaluate stable caller-only checks through statement InitPlans, preserving every existing staff/patient and tenant predicate; never cache authorization between database requests.
- Agenda day/week practitioner filters use URL-backed multiple selections and shared SearchablePicker; week tracks retain practitioner identity so schedules and busy blocks cannot mix between people.
- Agenda picker and tracks derive visibility from location-filtered daySegments or existing appointments; resource tracks require a visible practitioner work segment so unscheduled days stay empty. Shared picker selectionOptions preserve removable selections independently of current eligibility.
- Patient directory reads identity rows under existing RLS, independently of appointment dates; its URL search filters the loaded identities, with stable ranged reads to avoid silently truncated lists.
- Configuration (settings, option lists, texts, roles, permissions, landing pages) lives in DB rows; code never contains those values.
- Staff area: session + aal2 when `mfa_required()` + active role; RLS/server use `is_aal2()` + `has_permission()`. `mfa_required()` is false in test mode (demo) — one switch, so layers can't diverge.
- UI navigation checks may reuse a verified result for 30 seconds per session/tenant; identity/MFA changes clear it. RLS/server authorization is never cached or skipped. Query data uses short freshness and mutation invalidation; reference catalogs stay fresh longer to avoid repeated full reloads.
- Password sign-in enforces lockout server-side. Server functions log auth events; audit_log stays append-only.
- `signInDemo`: passwordless for group setting `demo_login_email`, refused server-side unless its tenant is in test mode.
- Identity columns only in `patients`; medical data goes in separate tables without identity columns.
- Security headers are set in `src/start.ts` middleware (`src/lib/security-headers.ts`); `TBC_LIVE=true` switches framing to 'none'.
- RLS tests use isolated test-runner magic links, not passwords or MFA changes.
- Multi-tenant (docs/03_MULTI_TENANT.md is binding): every tenant table has non-null `tenant_id` defaulting to `current_tenant()`; every policy ANDs `tenant_id = current_tenant()` — isolation lives in the database.
- Active tenant is the server-written JWT claim `app_metadata.active_tenant`; roles use `tenant_memberships` (`user_roles` deprecated). Group admins need no membership: `my_tenants` lists all; `current_role_key`/`has_permission`/`my_staff_context` supply superadmin fallbacks.
- Shared group data (permissions, option_lists, languages, group_settings) is editable only by `group_admins`; storage buckets are per tenant (`<name>-<slug>`).
- Vitest files run serially: integration checks share accounts and change tenant claims.
- Equipment kinds derive from types; names from domain rules, availability only via tested `roomsForKind`.
- Standalone consultations share modal, validation and authenticated save; options configure choices and medical RLS governs access.
- Measurements: one shared query; BMI derived in domain from weight + last known height; shared write validation.
- Dossier add actions reuse the shared appointment/consult/measurement/document modals; a fixed patient is locked in the appointment modal.
- Public booking (`/boeken`) reads via `src/data/booking.functions.ts` server functions with the admin client after resolving the brand from the host (`?merk=` only for brands in test mode); they return display data only. Step order lives in `src/domain/booking.ts`, free times in `src/domain/slots.ts` — both tested.
- Shared statuses drive agenda/reception/slots; PatientCard owns actions. Triggers protect resources/eKis; audited double books bypass practitioner overlap only. One modal/save creates, reschedules and places waitlist entries with self-exclusion, compare-and-set and preserved preferences.
- Contact/request entries use shared validated authenticated saves and tenant RLS with patient view/edit permissions; follow-ups, timeline and modal editing read the same stored rows.
- Select/MultiSelect use SearchablePicker and shared eligibility rules for consistent keyboard/group selection.
- Booking attribution uses tenant-scoped channel/place/campaign rows and immutable in-use codes; appointments snapshot the resolved link attribution at hold creation so later configuration changes cannot rewrite history.
- The treatment menu is one free tree: groups are treatment_categories, placements are treatment_category_links plus treatment_menu_root (top level) sharing one sort per parent; tree rules live in src/domain/menu.ts and depth is enforced by a DB trigger from the menu_max_depth setting, so admin, preview and /boeken cannot disagree.
- Uploaded SVG icons pass svgIconError on upload and render, and are only drawn as CSS masks, so a tenant upload can never run script.

- Patient choices use semantic states; DataTable owns grouped tracks/row actions; Field rows and Modal focus share editing.
- Preparation gates reminder mail by missing data/validity; fee tokens expose amount/status, with test-mode payment and compare-and-set.
- Portal uses patient gates, hashed links and RLS; profile edits derive owner from them. Clinical detail is an audited final/shared projection, never raw notes. Copy is DB config.
- DemoPatientLogins uses configured profile labels and server-gated portal links; no parallel auth flow.
- ActiveConsultMode owns shared SOEP state and a coalesced serial autosave queue for both editors; flush before parking/closing to prevent cross-editor cancellation and stale overwrites. Legacy consult URLs redirect to the dossier.
- Consult closing and the notes-panel checklist both reuse closeChecklist with the resolved frozen template; finalization validates persisted requirements in an authenticated server function and compares updated_at, never copying stale editor text. Medical-only requirements must not leak into cosmetic consults.
- Consent shares SignaturePad; forms publish atomically via permission-checked RPC; consults freeze text/version snapshots and refuse missing text.
- Billing uses catalog prices and bounded till discounts; invoices stay immutable; reception sees no medical answers.
- Treatment settings share one validated modal; public availability never restricts staff booking.
- Stats keys are header-only. Photos share a demo resolver; frozen reminders use the mail job.
