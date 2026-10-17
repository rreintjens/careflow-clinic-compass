
-- ===== Helpers =====
create or replace function public.touch_updated()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create or replace function public.is_aal2()
returns boolean language sql stable set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

-- ===== Roles & permissions (rows, not code) =====
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  landing_page text not null check (landing_page in ('dashboard','mijn-dag','agenda','patienten')),
  consult_mode text not null check (consult_mode in ('yes','yes_counter_panel','yes_no_medical_signals','no')),
  record_visibility text not null,
  patient_scope text not null default 'all' check (patient_scope in ('all','own')),
  sort int not null default 0,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.permissions (
  key text primary key,
  group_label text not null,
  label text not null,
  sublabel text,
  sort int not null default 0,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  primary key (role_id, permission_key)
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  blocked boolean not null default false,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

grant select on public.roles, public.permissions, public.role_permissions, public.user_roles, public.profiles to authenticated;
grant insert, update, delete on public.role_permissions to authenticated;
grant update on public.roles to authenticated;
grant insert, update, delete on public.user_roles to authenticated;
grant update on public.profiles to authenticated;
grant all on public.roles, public.permissions, public.role_permissions, public.user_roles, public.profiles to service_role;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;

create or replace function public.current_role_key()
returns text language sql stable security definer set search_path = public as $$
  select r.key from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.profiles p on p.id = ur.user_id and not p.blocked
  where ur.user_id = auth.uid()
$$;

create or replace function public.has_permission(_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id and not p.blocked
    left join public.role_permissions rp on rp.role_id = r.id and rp.permission_key = _perm
    where ur.user_id = auth.uid() and (r.key = 'superadmin' or rp.permission_key is not null)
  )
$$;

-- staff session: aal2 + active role
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_aal2() and public.current_role_key() is not null
$$;

create policy "staff read roles" on public.roles for select to authenticated using (public.is_staff());
create policy "manage roles" on public.roles for update to authenticated
  using (public.is_aal2() and public.has_permission('roles.manage')) with check (public.is_aal2() and public.has_permission('roles.manage'));
create policy "staff read permissions" on public.permissions for select to authenticated using (public.is_staff());
create policy "staff read role_permissions" on public.role_permissions for select to authenticated using (public.is_staff());
create policy "manage role_permissions ins" on public.role_permissions for insert to authenticated with check (public.is_aal2() and public.has_permission('roles.manage'));
create policy "manage role_permissions del" on public.role_permissions for delete to authenticated using (public.is_aal2() and public.has_permission('roles.manage'));
create policy "read own role" on public.user_roles for select to authenticated using (user_id = auth.uid() or (public.is_aal2() and public.has_permission('users.manage')));
create policy "manage user_roles ins" on public.user_roles for insert to authenticated with check (public.is_aal2() and public.has_permission('users.manage'));
create policy "manage user_roles upd" on public.user_roles for update to authenticated using (public.is_aal2() and public.has_permission('users.manage')) with check (public.is_aal2() and public.has_permission('users.manage'));
create policy "manage user_roles del" on public.user_roles for delete to authenticated using (public.is_aal2() and public.has_permission('users.manage'));
create policy "read own profile or managed" on public.profiles for select to authenticated
  using (id = auth.uid() or (public.is_aal2() and (public.has_permission('users.manage') or public.has_permission('logbook.view'))));
create policy "manage profiles" on public.profiles for update to authenticated
  using (public.is_aal2() and public.has_permission('users.manage')) with check (public.is_aal2() and public.has_permission('users.manage'));

-- at least one superadmin must always exist
create or replace function public.guard_last_superadmin()
returns trigger language plpgsql security definer set search_path = public as $$
declare su uuid;
begin
  select id into su from public.roles where key = 'superadmin';
  if (tg_op = 'DELETE' and old.role_id = su) or (tg_op = 'UPDATE' and old.role_id = su and new.role_id <> su) then
    if (select count(*) from public.user_roles where role_id = su and id <> old.id) = 0 then
      raise exception 'Er moet altijd minstens één superadmin zijn';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_guard_last_superadmin before update or delete on public.user_roles
  for each row execute function public.guard_last_superadmin();

-- ===== Settings =====
create table public.settings (
  key text primary key,
  section text not null,
  section_sort int not null default 0,
  label text not null,
  help text,
  input_type text not null default 'select' check (input_type in ('select','text','email','tel','hidden')),
  options jsonb not null default '[]'::jsonb,
  value jsonb not null,
  sort int not null default 0,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.setting_sections (
  key text primary key,
  title text not null,
  description text,
  sort int not null default 0,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dates date[] not null,
  applies_to text not null default 'all',
  deleted_at timestamptz, deleted_reason text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
grant select, update on public.settings to authenticated;
grant select on public.setting_sections to authenticated;
grant select, insert, update on public.holidays to authenticated;
grant all on public.settings, public.setting_sections, public.holidays to service_role;
alter table public.settings enable row level security;
alter table public.setting_sections enable row level security;
alter table public.holidays enable row level security;
create policy "view settings" on public.settings for select to authenticated using (public.is_aal2() and public.has_permission('settings.view'));
create policy "edit settings" on public.settings for update to authenticated using (public.is_aal2() and public.has_permission('settings.edit')) with check (public.is_aal2() and public.has_permission('settings.edit'));
create policy "view sections" on public.setting_sections for select to authenticated using (public.is_aal2() and public.has_permission('settings.view'));
create policy "view holidays" on public.holidays for select to authenticated using (public.is_aal2() and public.has_permission('settings.view'));
create policy "add holidays" on public.holidays for insert to authenticated with check (public.is_aal2() and public.has_permission('settings.edit'));
create policy "edit holidays" on public.holidays for update to authenticated using (public.is_aal2() and public.has_permission('settings.edit')) with check (public.is_aal2() and public.has_permission('settings.edit'));

-- only value may change through the app
create or replace function public.settings_value_only()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' then
    new.section := old.section; new.label := old.label; new.help := old.help;
    new.input_type := old.input_type; new.options := old.options; new.sort := old.sort; new.key := old.key;
    if new.input_type = 'select' and not exists (select 1 from jsonb_array_elements(old.options) o where o->'value' = new.value) then
      raise exception 'Ongeldige keuze voor %', old.key;
    end if;
  end if;
  return new;
end $$;
create trigger trg_settings_value_only before update on public.settings for each row execute function public.settings_value_only();

-- ===== Identity table (classified: identity) =====
create sequence public.patient_number_seq start with 1000001 minvalue 1000001;
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  patient_number bigint not null unique default nextval('public.patient_number_seq'),
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  email text not null,
  phone text,
  deleted_at timestamptz, deleted_reason text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
grant select, insert, update, delete on public.patients to authenticated;
grant all on public.patients to service_role;
grant usage on sequence public.patient_number_seq to authenticated, service_role;
alter table public.patients enable row level security;
create policy "patients view" on public.patients for select to authenticated using (public.is_aal2() and public.has_permission('patients.view'));
create policy "patients create" on public.patients for insert to authenticated with check (public.is_aal2() and public.has_permission('patients.create'));
create policy "patients edit" on public.patients for update to authenticated using (public.is_aal2() and public.has_permission('patients.edit')) with check (public.is_aal2() and public.has_permission('patients.edit'));
create policy "patients delete" on public.patients for delete to authenticated using (public.is_aal2() and public.has_permission('patients.delete'));

-- ===== Audit (append-only) =====
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  action text not null,
  category text not null,
  record_type text,
  record_id text,
  details jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  correlation_id uuid not null default gen_random_uuid()
);
create index audit_log_at_idx on public.audit_log (at desc);
grant select on public.audit_log to authenticated;
grant select, insert on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "logbook view" on public.audit_log for select to authenticated using (public.is_aal2() and public.has_permission('logbook.view'));

create or replace function public.audit_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;
create trigger trg_audit_append_only before update or delete on public.audit_log
  for each row execute function public.audit_append_only();
create trigger trg_audit_no_truncate before truncate on public.audit_log
  for each statement execute function public.audit_append_only();

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  hdr jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  act text; cat text; rid text;
begin
  rid := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key', to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'key',
                  to_jsonb(new) ->> 'role_id', to_jsonb(old) ->> 'role_id');
  if tg_table_name in ('settings','holidays') then act := 'settings_changed'; cat := 'changed';
  elsif tg_table_name in ('roles','role_permissions','user_roles') then act := 'role_changed'; cat := 'changed';
  elsif tg_table_name = 'patients' then
    act := case tg_op when 'INSERT' then 'patient_created' when 'UPDATE' then 'patient_updated' else 'patient_deleted' end;
    cat := case tg_op when 'INSERT' then 'created' else 'changed' end;
  else act := lower(tg_table_name) || '_' || lower(tg_op); cat := 'changed';
  end if;
  insert into public.audit_log (user_id, action, category, record_type, record_id, details, ip, user_agent)
  values (auth.uid(), act, cat, tg_table_name, rid,
    jsonb_build_object('op', tg_op,
      'before', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
      'after', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end),
    split_part(coalesce(hdr ->> 'x-forwarded-for', ''), ',', 1),
    hdr ->> 'user-agent');
  return coalesce(new, old);
end $$;

create trigger trg_audit_settings after update on public.settings for each row execute function public.audit_row_change();
create trigger trg_audit_holidays after insert or update on public.holidays for each row execute function public.audit_row_change();
create trigger trg_audit_roles after update on public.roles for each row execute function public.audit_row_change();
create trigger trg_audit_role_permissions after insert or delete on public.role_permissions for each row execute function public.audit_row_change();
create trigger trg_audit_user_roles after insert or update or delete on public.user_roles for each row execute function public.audit_row_change();
create trigger trg_audit_patients after insert or update or delete on public.patients for each row execute function public.audit_row_change();

-- updated_at triggers
create trigger t_roles before update on public.roles for each row execute function public.touch_updated();
create trigger t_user_roles before update on public.user_roles for each row execute function public.touch_updated();
create trigger t_profiles before update on public.profiles for each row execute function public.touch_updated();
create trigger t_settings before update on public.settings for each row execute function public.touch_updated();
create trigger t_holidays before update on public.holidays for each row execute function public.touch_updated();
create trigger t_patients before update on public.patients for each row execute function public.touch_updated();

-- ===== Login lockout (service role only; no policies) =====
create table public.login_attempts (
  email_hash text primary key,
  failed_count int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
grant all on public.login_attempts to service_role;
alter table public.login_attempts enable row level security;

-- ===== Current user info for landing =====
create or replace function public.my_staff_context()
returns table (role_key text, role_name text, landing_page text, consult_mode text, full_name text, email text, permissions text[])
language sql stable security definer set search_path = public as $$
  select r.key, r.name, r.landing_page, r.consult_mode, p.full_name, p.email,
    case when r.key = 'superadmin' then (select array_agg(key) from public.permissions)
         else coalesce((select array_agg(permission_key) from public.role_permissions where role_id = r.id), '{}') end
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.profiles p on p.id = ur.user_id and not p.blocked
  where ur.user_id = auth.uid()
$$;
revoke execute on function public.my_staff_context() from anon, public;
grant execute on function public.my_staff_context() to authenticated;

-- ===== Seed: roles =====
insert into public.roles (key, name, landing_page, consult_mode, record_visibility, patient_scope, sort) values
 ('superadmin','Superadmin','dashboard','yes','Alles','all',1),
 ('admin','Admin','dashboard','no','Alles behalve consultverslagen','all',2),
 ('arts','Arts','mijn-dag','yes_counter_panel','Alles; eigen patiënten of iedereen is open punt','own',3),
 ('therapeut','Huidtherapeut en laserspecialist','mijn-dag','yes_no_medical_signals','Eigen behandelgroep','own',4),
 ('customer_care','Customer care','agenda','no','Overzicht beperkt, tijdlijn, documenten; geen Medisch en Behandeling','all',5),
 ('assistent','Assistent','agenda','no','Zoals customer care','all',6);

insert into public.permissions (key, group_label, label, sublabel, sort) values
 ('patients.view','Patiënten','Bekijken',null,10),
 ('patients.create','Patiënten','Aanmaken',null,11),
 ('patients.edit','Patiënten','Wijzigen',null,12),
 ('patients.delete','Patiënten','Verwijderen',null,13),
 ('patients.export','Patiënten','Exporteren',null,14),
 ('patients.medical','Patiënten','Medische gegevens inzien','vragenlijstantwoorden en medische notities',15),
 ('agenda.view','Agenda','Bekijken',null,20),
 ('agenda.appointments','Agenda','Afspraken maken, verzetten en annuleren',null,21),
 ('agenda.schedules','Agenda','Roosters en beschikbaarheid beheren',null,22),
 ('booking_links.view','Boekingslinks','Bekijken',null,30),
 ('booking_links.manage','Boekingslinks','Aanmaken en wijzigen',null,31),
 ('questionnaires.view','Vragenlijsten','Bekijken',null,40),
 ('questionnaires.manage','Vragenlijsten','Aanmaken en wijzigen',null,41),
 ('emails.templates','E-mails','Sjablonen wijzigen',null,50),
 ('emails.send','E-mails','Handmatig versturen',null,51),
 ('settings.view','Instellingen','Bekijken',null,60),
 ('settings.edit','Instellingen','Wijzigen',null,61),
 ('dashboard.view','Dashboard','Bekijken',null,70),
 ('dashboard.export','Dashboard','Exporteren',null,71),
 ('users.manage','Gebruikers en rollen','Gebruikers beheren',null,80),
 ('roles.manage','Gebruikers en rollen','Rollen en rechten beheren',null,81),
 ('logbook.view','Logboek','Bekijken',null,90),
 ('logbook.export','Logboek','Exporteren',null,91);

insert into public.role_permissions (role_id, permission_key)
select r.id, p from public.roles r, unnest(case r.key
  when 'admin' then array['patients.view','patients.create','patients.edit','patients.export','patients.medical','agenda.view','agenda.appointments','agenda.schedules','booking_links.view','booking_links.manage','questionnaires.view','questionnaires.manage','emails.templates','emails.send','settings.view','settings.edit','dashboard.view','dashboard.export','users.manage','logbook.view']
  when 'customer_care' then array['patients.view','patients.create','patients.edit','agenda.view','agenda.appointments','booking_links.view','emails.send','dashboard.view']
  when 'arts' then array['patients.view','patients.edit','patients.medical','agenda.view','questionnaires.view']
  when 'therapeut' then array['patients.view','patients.edit','patients.medical','agenda.view','questionnaires.view']
  when 'assistent' then array['patients.view','patients.create','patients.edit','patients.medical','agenda.view','agenda.appointments','emails.send']
  else array[]::text[] end) as p;

-- ===== Seed: settings =====
insert into public.setting_sections (key, title, description, sort) values
 ('booking','Boeken en reserveren','Deze regels gelden voor alle behandelingen; per behandeling kun je ervan afwijken.',1),
 ('cancel','Annuleren en niet verschenen','Standaard voor alle behandelingen; per categorie of behandeling te overschrijven, bijvoorbeeld injectables 48 uur en €60.',2),
 ('languages','Talen',null,3),
 ('email','E-mail en bereikbaarheid',null,4),
 ('holidays','Feestdagen en sluitingsdagen','Op deze dagen is geen locatie boekbaar, tenzij een locatie het zelf anders instelt.',5),
 ('data','Gegevens en bewaren',null,6),
 ('system','Systeem',null,99);

insert into public.settings (key, section, label, help, input_type, options, value, sort) values
 ('slot_hold_minutes','booking','Plek vasthouden tijdens triage en gegevens','Keuze uit 5, 10, 15, 20 of 30 minuten. Daarna komt de plek vrij en ziet de patiënt “Je tijd is verlopen”.','select',
  '[{"value":5,"label":"5 minuten"},{"value":10,"label":"10 minuten"},{"value":15,"label":"15 minuten"},{"value":20,"label":"20 minuten"},{"value":30,"label":"30 minuten"}]','15',1),
 ('min_lead_minutes','booking','Minimaal van tevoren boeken','Keuze uit 1, 2, 4, 12 of 24 uur, of 2 dagen.','select',
  '[{"value":60,"label":"1 uur"},{"value":120,"label":"2 uur"},{"value":240,"label":"4 uur"},{"value":720,"label":"12 uur"},{"value":1440,"label":"24 uur"},{"value":2880,"label":"2 dagen"}]','120',2),
 ('max_ahead_weeks','booking','Maximaal vooruit boeken','Keuze uit 2, 4, 6, 8, 12 of 26 weken.','select',
  '[{"value":2,"label":"2 weken"},{"value":4,"label":"4 weken"},{"value":6,"label":"6 weken"},{"value":8,"label":"8 weken"},{"value":12,"label":"12 weken"},{"value":26,"label":"26 weken"}]','8',3),
 ('cancel_until_hours','booking','Verzetten en annuleren tot','Keuze uit 12, 24, 48 of 72 uur. Per categorie of behandeling te overschrijven; daarna alleen via customer care.','select',
  '[{"value":12,"label":"12 uur van tevoren"},{"value":24,"label":"24 uur van tevoren"},{"value":48,"label":"48 uur van tevoren"},{"value":72,"label":"72 uur van tevoren"}]','24',4),
 ('no_preference_assignment','booking','Toewijzing bij “geen voorkeur”','Open punt Djilly; dit is de voorlopige regel.','select',
  '[{"value":"fewest_appointments","label":"Behandelaar met de minste afspraken die dag"},{"value":"first_available","label":"Eerste vrije behandelaar"}]','"fewest_appointments"',5),
 ('double_booking','booking','Dubbele boeking',null,'select',
  '[{"value":"warn","label":"Waarschuwen bij zelfde e-mail en geboortedatum met een toekomstige afspraak"},{"value":"allow","label":"Toestaan"},{"value":"block","label":"Blokkeren"}]','"warn"',6),
 ('no_show_amount_cents','cancel','No-showbedrag',null,'select',
  '[{"value":0,"label":"Geen"},{"value":2500,"label":"€25"},{"value":5000,"label":"€50"},{"value":6000,"label":"€60"},{"value":7500,"label":"€75"},{"value":10000,"label":"€100"}]','0',1),
 ('late_cancel_applies','cancel','Geldt ook bij te laat annuleren',null,'select',
  '[{"value":true,"label":"Ja, binnen de termijn hierboven"},{"value":false,"label":"Nee"}]','true',2),
 ('payment_method','cancel','Betaling van het bedrag',null,'select',
  '[{"value":"invoice_email","label":"Factuur per e-mail"},{"value":"payment_request_email","label":"Betaalverzoek per e-mail"}]','"invoice_email"',3),
 ('illness_exception','cancel','Uitzondering bij ziekte',null,'select',
  '[{"value":"customer_care","label":"Customer care beslist"},{"value":"always_waive","label":"Altijd kwijtschelden"},{"value":"never_waive","label":"Nooit kwijtschelden"}]','"customer_care"',4),
 ('default_language','languages','Standaardtaal patiëntkant',null,'select',
  '[{"value":"nl","label":"Nederlands"},{"value":"en","label":"Engels"}]','"nl"',1),
 ('extra_languages','languages','Extra talen','Elke patiënttekst heeft in de bouwer een veld per taal; ontbreekt een vertaling, dan valt de patiënt terug op Nederlands.','select',
  '[{"value":"en","label":"Engels"},{"value":"none","label":"Geen"}]','"en"',2),
 ('sender_name','email','Afzendernaam',null,'text','[]','"The Body Clinic"',1),
 ('sender_address','email','Afzenderadres',null,'email','[]','"zorg@bodyclinic.nl"',2),
 ('mail_phone','email','Telefoonnummer in mails',null,'tel','[]','"085-7600035"',3),
 ('sms_enabled','email','Sms naast e-mail','Aan of uit; open punt Rob.','select',
  '[{"value":false,"label":"Uit"},{"value":true,"label":"Aan"}]','false',4),
 ('red_triage_answers','data','Rode triage-antwoorden',null,'select',
  '[{"value":"count_reason_only","label":"Niet opslaan; alleen de reden tellen"}]','"count_reason_only"',1),
 ('audit_pageview_retention_days','data','Logboek paginaweergaven bewaren','Keuze uit 30, 90, 180 of 365 dagen; open punt Rob.','select',
  '[{"value":30,"label":"30 dagen"},{"value":90,"label":"90 dagen"},{"value":180,"label":"180 dagen"},{"value":365,"label":"365 dagen"}]','90',2),
 ('audit_change_retention','data','Logboek wijzigingen bewaren',null,'select',
  '[{"value":"unlimited","label":"Onbeperkt"}]','"unlimited"',3),
 ('patient_number_mode','data','Patiëntnummer',null,'select',
  '[{"value":"sequential_1000001","label":"Doorlopend, begint bij 1000001"}]','"sequential_1000001"',4),
 ('test_mode','system','Testomgeving',null,'hidden','[]','true',1),
 ('test_mode_banner','system','Testbanner',null,'hidden','[]','"Testomgeving · geen echte patiëntgegevens"',2),
 ('idle_timeout_minutes_medical','system','Inactiviteit medische rollen',null,'hidden','[]','15',3),
 ('lockout_attempts','system','Mislukte pogingen',null,'hidden','[]','5',4),
 ('lockout_minutes','system','Blokkeerduur',null,'hidden','[]','15',5);

insert into public.holidays (name, dates) values
 ('Kerst', array['2026-12-25','2026-12-26']::date[]),
 ('Nieuwjaarsdag', array['2027-01-01']::date[]),
 ('Pasen', array['2027-04-04','2027-04-05']::date[]),
 ('Koningsdag', array['2027-04-27']::date[]),
 ('Hemelvaart', array['2027-05-13']::date[]),
 ('Pinksteren', array['2027-05-23','2027-05-24']::date[]);
