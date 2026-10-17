# Multi-tenant directive (binding)

The application serves several brands of the same owner group from one codebase and one database, with complete data separation between brands. A brand is a tenant. Build tenancy in from the first migration; retrofitting it is not acceptable.

## 1. Tenants
- Known tenants at start: `tbc-nl` (The Body Clinic Nederland, bodyclinic.nl), `tbc-de` (The Body Clinic Deutschland, bodyclinic.de), `obesitas-apotheek` (Obesitas Apotheek), with room for more. The designs in this package are for `tbc-nl`; the other tenants get their own flows, treatments, texts and templates later and start empty except for the shared defaults listed in 4.
- A tenant has: id, slug, display name, country, default language and extra languages, time zone, currency, booking domain(s), mail sender and reply-to, theme tokens (logo, colours, fonts within the house-style constraints), legal texts (privacy statement version, consent texts), processors list, and feature flags (for example `online_consults`, `medical_questionnaire`, `no_show_fee`).
- Tenants are rows in `tenants`; nothing about a tenant lives in code. Adding a tenant is an admin action, not a deployment.

## 2. Data isolation (hard)
- Every table that holds tenant data has a non-null `tenant_id` with a foreign key to `tenants`. This includes patients, appointments, practitioners, locations, rooms, equipment, treatments, categories, schedules, booking links, questionnaires and their versions, answer sets, signals, consult notes, treatment plans, measurements, documents, timeline events, mail templates, settings, roles and permissions, audit rows, tokens, aggregate statistics.
- Row Level Security on every one of those tables checks `tenant_id = current_tenant()` in addition to the role policy. `current_tenant()` reads the active tenant from the JWT, never from a request parameter or a client header.
- Unique constraints are per tenant (patient number sequence per tenant, slugs per tenant). Patient numbers restart at 1000001 per tenant.
- No query, view, function or report joins across tenants, except the owner-level aggregate statistics in 6, which return counts only.
- Storage buckets are per tenant (`documents-tbc-nl`, …) with policies that mirror the tables.
- Backups are shared, restores can be filtered per tenant; the erasure function works per tenant.

## 3. Users, roles and switching
- A user account belongs to the group, not to a tenant. Memberships are rows in `tenant_memberships` (user, tenant, role). A user with memberships in two tenants (for example the owner, or a doctor who works for both TBC NL and TBC DE) sees a tenant switcher in the sidebar header; one tenant is active at a time and the choice is written into the session claims by a server function, logged, and reflected in the URL prefix (`/t/tbc-nl/...`).
- Switching tenant closes consult mode and clears all client caches. No screen ever shows data from two tenants at once.
- Roles and permissions are defined per tenant (a tenant admin can add a role in their tenant only). A `group_admin` role exists above tenants: it can create tenants, manage memberships and read aggregates, but has no access to patient data in any tenant unless it also holds a tenant role there, and that access is logged as such.
- MFA, lockout and session rules from `02_ENGINEERING_AND_SECURITY.md` apply per user across tenants.

## 4. What is shared and what is per tenant
Shared across tenants (group level, read-only for tenant admins): the UI component library, the questionnaire engine, the icon sets, the mail block types, the condition language, the base role set that new tenants start with, the audit event codes.
Per tenant (editable by that tenant's admins only): treatments with categories and subcategories, practitioners and schedules, locations, rooms and equipment, booking links, questionnaires and versions, mail templates and their overrides, settings (hold time, cancel window, no-show fee, languages, holidays, retention), consent and legal texts, theme and domain, integrations (Google account for Meet, mail sender, eKis export on or off, statistics keys).
Copying is explicit: a tenant admin may import a questionnaire or template JSON exported from another tenant; nothing is linked live between tenants.

## 5. Patient side
- The booking domain decides the tenant: `boek.bodyclinic.nl` resolves to `tbc-nl`, `termin.bodyclinic.de` to `tbc-de`. Unknown host: 404, never a default tenant.
- A booking link, token or questionnaire link is bound to one tenant; a token presented on another tenant's domain is invalid.
- Theme, language fallback, legal texts, sender and reply-to all come from the tenant row. The same patient flow code renders differently per tenant without branching in code.
- A person who is a patient at two tenants is two patient records; there is no cross-tenant matching by e-mail or date of birth.

## 6. Integrations and reporting
- Each tenant has its own Google account for Meet, its own mail sender domain (verified per tenant; the app refuses to send otherwise), its own eKis export switch, and its own statistics key. Mocks in test mode are per tenant too.
- The owner-level statistics API returns aggregated counts per tenant (bookings, red reasons, no-shows, questionnaire completion) with no personal data; it is the only cross-tenant read and it is served by a function with its own key.

## 7. Audit, GDPR and test data per tenant
- Every audit row carries `tenant_id` and the active role; the Logboek page shows one tenant.
- Retention settings, consent versions, processor lists and the data protection contact are per tenant; the erasure and export functions take a tenant and a patient.
- Test mode is per tenant; a tenant can be live while another is in test.
- Seed: `tbc-nl` is seeded from this package (questionnaires, treatments, team, templates, settings). `tbc-de` and `obesitas-apotheek` are created empty with the shared base roles and the group defaults; their content follows in separate packages.

## 8. Acceptance for tenancy (added to Phase 1)
- Two tenants exist; a user with membership in both switches and never sees the other's rows (automated test per table: insert in A, read as B returns nothing).
- The booking page on an unknown host returns 404; on each tenant host it shows that tenant's theme and texts.
- Patient numbers run independently per tenant.
- An audit row written in tenant A is invisible in tenant B's Logboek.
- A `group_admin` without a tenant role cannot read any patient row in any tenant.

## 9. Things you must not do
- No `tenant_id` nullable "for now"; no global tables that secretly hold tenant data; no tenant resolved from a cookie or query string; no admin page that lists patients of all tenants; no shared Google account or mail sender across tenants; no code branches on tenant slug (`if tenant === 'tbc-de'`): everything a tenant needs different is data.