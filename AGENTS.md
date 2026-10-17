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
- Read the design package rules first: binding engineering/security directive overrides defaults; build phases in order; the owner asked not to pause for confirmation between phases.
- TanStack Start (not React Router); app-internal server logic in `createServerFn`, never new Edge Functions — platform stack.
- Pure business logic in `src/domain/` with table-driven tests; typed queries in `src/data/`; shared UI in `src/components/` (one PillButton, Card, Select, SegmentedControl, Modal, Sidebar…) — no duplicates, add a prop instead.
- Configuration (settings, option lists, texts, roles, permissions, landing pages) lives in DB rows; code never contains those values.
- Staff area = `_authenticated` layout: session + aal2 + active role; RLS on every table requires `is_aal2()` + `has_permission()` — MFA enforced server-side, never bypassed.
- Password step runs in a server function so lockout cannot be skipped; auth events are written by server functions, row changes by the `audit_row_change` trigger; `audit_log` is append-only by trigger.
- Identity columns only in `patients`; medical data goes in separate tables without identity columns.
- Security headers are set in `src/start.ts` middleware (`src/lib/security-headers.ts`); `TBC_LIVE=true` switches framing to 'none'.
- RLS proof: `TEST_STAFF_PASSWORD=… bunx vitest run src/test/rls-patients.integration.test.ts` (enrolls and removes a temporary TOTP factor per role).
- Multi-tenant (docs/03_MULTI_TENANT.md is binding): every tenant table has non-null `tenant_id` defaulting to `current_tenant()`; every policy ANDs `tenant_id = current_tenant()` — isolation lives in the database.
- Active tenant = `app_metadata.active_tenant` in the JWT, written only by server functions (`signInStaff`, `switchTenant`) and honoured only with a membership; roles come from `tenant_memberships` (`user_roles` is deprecated).
- Shared group data (permissions, option_lists, languages, group_settings) is editable only by `group_admins`; storage buckets are per tenant (`<name>-<slug>`).
- Tenancy/RLS proof: `TEST_STAFF_PASSWORD=… bunx vitest run src/test/tenancy.integration.test.ts` (run files one at a time; they share test accounts).
- Equipment: device kind comes from `equipment_types` → `equipment_kinds`; names are generated (`src/domain/equipment.ts`), never stored as truth; availability per room/day only via `roomsForKind` — one tested rule.
- Questionnaires: definitions are jsonb per version (`questionnaire_versions`, draft/published/archived; published frozen by trigger); flow-level settings/computed fields in `questionnaire_flows.document`; all routing/red/signal logic only in `src/domain/questionnaire/engine.ts` (tested against `src/seed/*.json`) so export stays equal to import.
- Patient questionnaire UI is one component (`src/features/questionnaire/QuestionnaireRunner.tsx`); fixed screen texts come from option list `questionnaire_ui`.
