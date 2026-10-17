create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  country text not null,
  default_language text not null default 'nl',
  extra_languages text[] not null default '{}',
  time_zone text not null default 'Europe/Amsterdam',
  currency text not null default 'EUR',
  booking_domains text[] not null default '{}',
  mail_sender text,
  mail_reply_to text,
  mail_sender_verified boolean not null default false,
  google_meet_account text,
  ekis_export_enabled boolean not null default false,
  stats_key_hash text,
  theme jsonb not null default '{}'::jsonb,
  legal jsonb not null default '{}'::jsonb,
  processors jsonb not null default '[]'::jsonb,
  feature_flags jsonb not null default '{}'::jsonb,
  test_mode boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.group_admins (
  user_id uuid primary key,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.group_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  unique (user_id, tenant_id)
);
grant select on public.tenants to authenticated; grant all on public.tenants to service_role;
grant select, insert, update, delete on public.group_admins to authenticated; grant all on public.group_admins to service_role;
grant select on public.group_settings to authenticated; grant all on public.group_settings to service_role;
grant select, insert, update, delete on public.tenant_memberships to authenticated; grant all on public.tenant_memberships to service_role;
alter table public.tenants enable row level security;
alter table public.group_admins enable row level security;
alter table public.group_settings enable row level security;
alter table public.tenant_memberships enable row level security;

insert into public.tenants (slug, display_name, country, default_language, extra_languages, booking_domains, sort) values
 ('tbc-nl','The Body Clinic Nederland','NL','nl','{en}','{boek.bodyclinic.nl}',1),
 ('tbc-de','The Body Clinic Deutschland','DE','de','{en}','{termin.bodyclinic.de}',2),
 ('obesitas-apotheek','Obesitas Apotheek','NL','nl','{}','{}',3);
insert into public.group_settings(key,value) select key,value from public.settings where key in ('lockout_attempts','lockout_minutes');

create or replace function public.current_tenant()
returns uuid language sql stable security definer set search_path = public as $$
  select m.tenant_id from public.tenant_memberships m
  join public.profiles p on p.id = m.user_id and not p.blocked
  where m.user_id = auth.uid()
    and m.tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'active_tenant')
$$;
create or replace function public.is_group_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_aal2() and exists (select 1 from public.group_admins where user_id = auth.uid())
$$;

insert into public.tenant_memberships (user_id, tenant_id, role_id, created_at)
select ur.user_id, (select id from public.tenants where slug='tbc-nl'), ur.role_id, ur.created_at from public.user_roles ur;
comment on table public.user_roles is 'DEPRECATED: replaced by tenant_memberships';

alter table public.roles add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.roles set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.role_permissions add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.role_permissions set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.settings add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.settings set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.holidays add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.holidays set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.patients add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.patients set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.practitioner_roles add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.practitioner_roles set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.locations add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.locations set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.location_hours add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.location_hours set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.location_exceptions add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.location_exceptions set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.rooms add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.rooms set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.equipment add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.equipment set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.equipment_day_locations add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.equipment_day_locations set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.equipment_exceptions add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.equipment_exceptions set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.treatment_categories add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.treatment_categories set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.treatments add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.treatments set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.treatment_category_links add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.treatment_category_links set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.treatment_practitioner_roles add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.treatment_practitioner_roles set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.treatment_locations add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.treatment_locations set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.treatment_requirements add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.treatment_requirements set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.practitioners add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.practitioners set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.practitioner_languages add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.practitioner_languages set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.practitioner_locations add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.practitioner_locations set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.practitioner_treatments add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.practitioner_treatments set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.schedule_blocks add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.schedule_blocks set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.schedule_exceptions add column tenant_id uuid references public.tenants(id) default public.current_tenant();
update public.schedule_exceptions set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.audit_log disable trigger trg_audit_append_only;
alter table public.audit_log add column tenant_id uuid references public.tenants(id) default public.current_tenant();
alter table public.audit_log add column role_key text;
update public.audit_log set tenant_id = (select id from public.tenants where slug='tbc-nl') where tenant_id is null;
alter table public.audit_log enable trigger trg_audit_append_only;