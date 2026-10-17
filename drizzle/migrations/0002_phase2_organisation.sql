create table public.option_lists (
  list_key text not null, value text not null, label_nl text not null, label_en text,
  sort int not null default 0, primary key (list_key, value),
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.practitioner_roles (
  id uuid primary key default gen_random_uuid(), key text not null unique,
  name_nl text not null, name_en text, sort int not null default 0,
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.languages (
  code text primary key, name_nl text not null, name_en text, sort int not null default 0,
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.locations (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  kind text not null check (kind in ('online','clinic')), address text, postal_city text,
  status text not null default 'open', maps_url text, phone text, show_new_label boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.location_hours (
  location_id uuid not null references public.locations(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), opens time, closes time,
  closed boolean not null default false, primary key (location_id, weekday),
  check (closed or (opens is not null and closes is not null and opens < closes)),
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.location_exceptions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  date_from date not null, date_to date not null, closed boolean not null default true, opens time, closes time,
  note text, check (date_from <= date_to),
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null, sort int not null default 0,
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.equipment (
  id uuid primary key default gen_random_uuid(), name text not null, kind text not null,
  mobility text not null check (mobility in ('fixed_room','within_location','between_locations')),
  room_id uuid references public.rooms(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  recurrence text not null default 'weekly', sort int not null default 0,
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.equipment_day_locations (
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  location_id uuid references public.locations(id) on delete cascade,
  primary key (equipment_id, weekday),
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.equipment_exceptions (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  date_from date not null, date_to date not null, note text, check (date_from <= date_to),
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.treatment_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.treatment_categories(id) on delete cascade,
  name_nl text not null, name_en text, icon text, sort int not null default 0,
  cancel_until_hours int, no_show_fee_eur int,
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.treatments (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  name_nl text not null, name_en text, icon text,
  duration_min int not null check (duration_min > 0 and duration_min % 5 = 0),
  practitioner_choice text not null default 'optional',
  cancel_until_hours int, no_show_fee_eur int, status text not null default 'active',
  pre_questionnaire_key text, post_questionnaire_key text,
  description_nl text, description_en text, preparation_nl text, preparation_en text,
  aftercare_nl text, aftercare_en text,
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.treatment_category_links (
  treatment_id uuid not null references public.treatments(id) on delete cascade,
  category_id uuid not null references public.treatment_categories(id) on delete cascade,
  sort int not null default 0, primary key (treatment_id, category_id),
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.treatment_practitioner_roles (
  treatment_id uuid not null references public.treatments(id) on delete cascade,
  role_id uuid not null references public.practitioner_roles(id) on delete cascade,
  primary key (treatment_id, role_id),
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.treatment_locations (
  treatment_id uuid not null references public.treatments(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  primary key (treatment_id, location_id),
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.treatment_requirements (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.treatments(id) on delete cascade,
  kind text not null check (kind in ('room','equipment')), equipment_kind text,
  quantity int not null default 1 check (quantity > 0), duration text not null default 'whole',
  sort int not null default 0, check (kind = 'room' or equipment_kind is not null),
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.practitioners (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  first_name text not null, last_name text not null,
  role_id uuid not null references public.practitioner_roles(id),
  photo_path text, bio_nl text check (char_length(bio_nl) <= 80), bio_en text check (char_length(bio_en) <= 80),
  status text not null default 'active', user_id uuid, email text, sort int not null default 0,
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.practitioner_languages (
  practitioner_id uuid not null references public.practitioners(id) on delete cascade,
  language_code text not null references public.languages(code), primary key (practitioner_id, language_code),
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.practitioner_locations (
  practitioner_id uuid not null references public.practitioners(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade, primary key (practitioner_id, location_id),
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.practitioner_treatments (
  practitioner_id uuid not null references public.practitioners(id) on delete cascade,
  treatment_id uuid not null references public.treatments(id) on delete cascade,
  excluded_location_ids uuid[] not null default '{}', primary key (practitioner_id, treatment_id),
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  location_id uuid not null references public.locations(id),
  starts time not null, ends time not null,
  recurrence text not null default 'weekly', valid_from date not null, valid_until date,
  treatment_ids uuid[], check (starts < ends), check (valid_until is null or valid_from <= valid_until),
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners(id) on delete cascade,
  kind text not null, date_from date not null, date_to date not null, starts time, ends time,
  location_id uuid references public.locations(id),
  existing_action text, new_bookings_action text, note text,
  check (date_from <= date_to), check (starts is null or ends is null or starts < ends),
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(), updated_by uuid
);
do $$
declare r record;
begin
for r in select * from (values ('option_lists','settings.edit'),('practitioner_roles','settings.edit'),('languages','settings.edit'),('locations','settings.edit'),('location_hours','settings.edit'),('location_exceptions','settings.edit'),('rooms','settings.edit'),('equipment','settings.edit'),('equipment_day_locations','settings.edit'),('equipment_exceptions','settings.edit'),('treatment_categories','settings.edit'),('treatments','settings.edit'),('treatment_category_links','settings.edit'),('treatment_practitioner_roles','settings.edit'),('treatment_locations','settings.edit'),('treatment_requirements','settings.edit'),('practitioners','settings.edit'),('practitioner_languages','settings.edit'),('practitioner_locations','settings.edit'),('practitioner_treatments','settings.edit'),('schedule_blocks','agenda.schedules'),('schedule_exceptions','agenda.schedules')) v(t,p) loop
  execute format('grant select, insert, update, delete on public.%I to authenticated', r.t);
  execute format('grant all on public.%I to service_role', r.t);
  execute format('alter table public.%I enable row level security', r.t);
  execute format('create policy %I on public.%I for select to authenticated using (public.is_aal2() and public.is_staff())', r.t||' read', r.t);
  execute format('create policy %I on public.%I for insert to authenticated with check (public.is_aal2() and public.has_permission(%L))', r.t||' insert', r.t, r.p);
  execute format('create policy %I on public.%I for update to authenticated using (public.is_aal2() and public.has_permission(%L)) with check (public.is_aal2() and public.has_permission(%L))', r.t||' update', r.t, r.p, r.p);
  execute format('create policy %I on public.%I for delete to authenticated using (public.is_aal2() and public.has_permission(%L))', r.t||' delete', r.t, r.p);
  execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated()', 't_'||r.t, r.t);
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', 'trg_audit_'||r.t, r.t);
end loop;
end $$;
create or replace function public.guard_online_location()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and old.kind = 'online' then raise exception 'Online location is fixed'; end if;
  if tg_op = 'UPDATE' and old.kind <> new.kind then raise exception 'Location kind is immutable'; end if;
  return coalesce(new, old);
end $$;
create trigger trg_guard_online before update or delete on public.locations for each row execute function public.guard_online_location();
create index on public.schedule_blocks (practitioner_id);
create index on public.schedule_exceptions (practitioner_id, date_from);
create index on public.treatment_category_links (category_id);
create index on public.practitioner_treatments (treatment_id);
create policy "practitioner photos read" on storage.objects for select to authenticated
  using (bucket_id = 'practitioner-photos' and public.is_aal2() and public.is_staff());
create policy "practitioner photos write" on storage.objects for insert to authenticated
  with check (bucket_id = 'practitioner-photos' and public.is_aal2() and public.has_permission('settings.edit'));
create policy "practitioner photos update" on storage.objects for update to authenticated
  using (bucket_id = 'practitioner-photos' and public.is_aal2() and public.has_permission('settings.edit'));
create policy "practitioner photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'practitioner-photos' and public.is_aal2() and public.has_permission('settings.edit'));