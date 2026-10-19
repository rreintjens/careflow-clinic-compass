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
- `src/features/questionnaire/` and `src/features/mail/` have their own `AGENTS.md`; read them before changing questionnaires or mails.
- Read the design package first; its security rules override defaults. Build phases in order without confirmation pauses.
- TanStack Start (not React Router); app-internal server logic in `createServerFn`, never new Edge Functions — platform stack.
- Pure business logic in `src/domain/` with table-driven tests; typed queries in `src/data/`; shared UI in `src/components/` (one PillButton, Card, Select, SegmentedControl, Modal, Sidebar…) — no duplicates, add a prop instead.
- Agenda routes share AgendaToolbar for stable controls; public and staff booking share slots domain with online-location IDs and block flags so mixed-consult conflicts cannot diverge.
- Configuration (settings, option lists, texts, roles, permissions, landing pages) lives in DB rows; code never contains those values.
- Staff area: session + aal2 when `mfa_required()` + active role; RLS/server use `is_aal2()` + `has_permission()`. `mfa_required()` is false in test mode (demo) — one switch, so layers can't diverge.
- Password sign-in enforces lockout server-side. Server functions log auth events; audit_log stays append-only.
- `signInDemo`: passwordless for group setting `demo_login_email`, refused server-side unless its tenant is in test mode.
- Identity columns only in `patients`; medical data goes in separate tables without identity columns.
- Security headers are set in `src/start.ts` middleware (`src/lib/security-headers.ts`); `TBC_LIVE=true` switches framing to 'none'.
- RLS proof: `TEST_STAFF_PASSWORD=… bunx vitest run src/test/rls-patients.integration.test.ts`.
- Multi-tenant (docs/03_MULTI_TENANT.md is binding): every tenant table has non-null `tenant_id` defaulting to `current_tenant()`; every policy ANDs `tenant_id = current_tenant()` — isolation lives in the database.
- Active tenant = `app_metadata.active_tenant` in the JWT, written only by server functions (`signInStaff`, `switchTenant`) and honoured only with a membership; roles come from `tenant_memberships` (`user_roles` is deprecated). Group admins are the exception: they sign in without a membership, see every tenant in `my_tenants`, and act as `superadmin` in any tenant via fallbacks in `current_role_key`/`has_permission`/`my_staff_context`.
- Shared group data (permissions, option_lists, languages, group_settings) is editable only by `group_admins`; storage buckets are per tenant (`<name>-<slug>`).
- Tenancy/RLS proof: `TEST_STAFF_PASSWORD=… bunx vitest run src/test/tenancy.integration.test.ts` (run files one at a time; they share test accounts).
- Equipment: device kind comes from `equipment_types` → `equipment_kinds`; names are generated (`src/domain/equipment.ts`), never stored as truth; availability per room/day only via `roomsForKind` — one tested rule.
- Standalone consultations use the shared dossier modal, shared Zod validation and authenticated server save; option rows configure selections, while existing medical RLS governs access.
- Measurements share one query across record views; BMI derives from source weight and previously known height through domain functions, and measurement writes use shared server/client validation.
- Dossier add actions reuse the agenda appointment modal and shared consultation, measurement and document modals; a fixed patient cannot be changed in the appointment modal to prevent cross-record mistakes.
- Public booking (`/boeken`) reads via `src/data/booking.functions.ts` server functions with the admin client after resolving the brand from the host (`?merk=` only for brands in test mode); they return display data only. Step order lives in `src/domain/booking.ts`, free times in `src/domain/slots.ts` — both tested.
- External busy providers read persisted tenant periods; shared slots and the appointment overlap trigger enforce exclusion independently of the agenda visibility setting.
- Contact/request entries use shared validated authenticated saves and tenant RLS with patient view/edit permissions; follow-ups, timeline and modal editing read the same stored rows.

- Select and MultiSelect delegate to SearchablePicker; option metadata and eligibility use shared pure picker rules so keyboard and group selection remain consistent throughout admin.

- Booking attribution uses tenant-scoped channel/place/campaign rows and immutable in-use codes; appointments snapshot the resolved link attribution at hold creation so later configuration changes cannot rewrite history.

- Questionnaire messages and booking start screens share MessageFields and Boodschap rendering; treatment/link configuration stays outside questionnaire versions and public booking loads link and catalogue together to avoid hydration divergence.

- Patient choices use semantic states; DataTable owns grouped tracks/row actions; Field rows and Modal focus share editing.
- Answer reads use frozen versions; consult domain owns timing/patient keys; date-only data has no time.
