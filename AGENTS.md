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
- Agenda shares AgendaToolbar; booking shares slots with online-location IDs/block flags to prevent mixed-consult conflicts.
- Configuration (settings, option lists, texts, roles, permissions, landing pages) lives in DB rows; code never contains those values.
- Staff area: session + aal2 when `mfa_required()` + active role; RLS/server use `is_aal2()` + `has_permission()`. `mfa_required()` is false in test mode (demo) — one switch, so layers can't diverge.
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

- Patient choices use semantic states; DataTable owns grouped tracks/row actions; Field rows and Modal focus share editing.
- Preparation gates reminder mail by missing data/validity; fee tokens expose amount/status, with test-mode payment and compare-and-set.
- Portal uses patient gates/access, atomic hashed links and RLS, never staff memberships; profile edits derive owner from this gate with shared validation/audit. Copy is tenant DB configuration.
- DemoPatientLogins uses configured profile labels and server-gated portal links; no parallel auth flow.
- ActiveConsultMode owns the template workflow beside its unchanged bar and notes panel; legacy consult URLs redirect to the dossier rather than render a second workflow.
- Consent shares SignaturePad; forms publish atomically via permission-checked RPC; consults freeze text/version snapshots and refuse missing text.
- Billing settles atomically with immutable invoices; reception sees amounts, never medical answers.
- Treatment settings share one validated modal; public availability never restricts staff booking.
- Stats keys are header-only; URL credentials are rejected to prevent log leakage.
