create index on public.audit_log(tenant_id, at desc);
alter table public.audit_log add constraint audit_log_tenant_required check (tenant_id is not null or category = 'login');

alter table public.roles drop constraint roles_key_key, add constraint roles_tenant_key unique (tenant_id, key);
alter table public.settings drop constraint settings_pkey, add constraint settings_pkey primary key (tenant_id, key);
alter table public.patients drop constraint patients_patient_number_key, add constraint patients_tenant_number unique (tenant_id, patient_number);
alter table public.patients alter column patient_number drop default;
alter table public.practitioner_roles drop constraint practitioner_roles_key_key, add constraint practitioner_roles_tenant_key unique (tenant_id, key);
alter table public.locations drop constraint locations_slug_key, add constraint locations_tenant_slug unique (tenant_id, slug);
alter table public.treatments drop constraint treatments_slug_key, add constraint treatments_tenant_slug unique (tenant_id, slug);
alter table public.practitioners drop constraint practitioners_slug_key, add constraint practitioners_tenant_slug unique (tenant_id, slug);
comment on sequence public.patient_number_seq is 'DEPRECATED: patient numbers are assigned per tenant by assign_patient_number()';

create or replace function public.assign_patient_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.patient_number is null then
    perform pg_advisory_xact_lock(hashtext('patient_number:' || new.tenant_id::text));
    select coalesce(max(patient_number), 1000000) + 1 into new.patient_number
    from public.patients where tenant_id = new.tenant_id;
  end if;
  return new;
end $$;
create trigger trg_assign_patient_number before insert on public.patients
  for each row execute function public.assign_patient_number();

create or replace function public.freeze_tenant()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.tenant_id is distinct from old.tenant_id then raise exception 'tenant_id kan niet wijzigen'; end if;
  return new;
end $$;
do $$ declare t text; begin foreach t in array array['roles','role_permissions','settings','holidays','patients','practitioner_roles','locations','location_hours','location_exceptions','rooms','equipment','equipment_day_locations','equipment_exceptions','treatment_categories','treatments','treatment_category_links','treatment_practitioner_roles','treatment_locations','treatment_requirements','practitioners','practitioner_languages','practitioner_locations','practitioner_treatments','schedule_blocks','schedule_exceptions'] loop
  execute format('alter table public.%I alter column tenant_id set not null', t);
  execute format('create index on public.%I (tenant_id)', t);
  execute format('create trigger trg_freeze_tenant before update on public.%I for each row execute function public.freeze_tenant()', t);
end loop; end $$;
create trigger trg_freeze_tenant before update on public.tenant_memberships for each row execute function public.freeze_tenant();

create or replace function public.membership_role_same_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.roles where id = new.role_id and tenant_id = new.tenant_id) then
    raise exception 'Rol hoort niet bij deze organisatie';
  end if;
  return new;
end $$;
create trigger trg_membership_role_tenant before insert or update on public.tenant_memberships
  for each row execute function public.membership_role_same_tenant();

create or replace function public.current_role_key()
returns text language sql stable security definer set search_path = public as $$
  select r.key from public.tenant_memberships m
  join public.roles r on r.id = m.role_id
  join public.profiles p on p.id = m.user_id and not p.blocked
  where m.user_id = auth.uid() and m.tenant_id = public.current_tenant()
$$;
create or replace function public.has_permission(_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tenant_memberships m
    join public.roles r on r.id = m.role_id
    join public.profiles p on p.id = m.user_id and not p.blocked
    left join public.role_permissions rp on rp.role_id = r.id and rp.permission_key = _perm
    where m.user_id = auth.uid() and m.tenant_id = public.current_tenant()
      and (r.key = 'superadmin' or rp.permission_key is not null)
  )
$$;
create or replace function public.my_staff_context()
returns table (role_key text, role_name text, landing_page text, consult_mode text, full_name text, email text, permissions text[])
language sql stable security definer set search_path = public as $$
  select r.key, r.name, r.landing_page, r.consult_mode, p.full_name, p.email,
    case when r.key = 'superadmin' then (select array_agg(key) from public.permissions)
         else coalesce((select array_agg(permission_key) from public.role_permissions where role_id = r.id), '{}') end
  from public.tenant_memberships m
  join public.roles r on r.id = m.role_id
  join public.profiles p on p.id = m.user_id and not p.blocked
  where m.user_id = auth.uid() and m.tenant_id = public.current_tenant()
$$;
create or replace function public.my_tenants()
returns table (tenant_id uuid, slug text, display_name text, role_name text, active boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.slug, t.display_name, r.name, t.id = public.current_tenant()
  from public.tenant_memberships m
  join public.tenants t on t.id = m.tenant_id
  join public.roles r on r.id = m.role_id
  join public.profiles p on p.id = m.user_id and not p.blocked
  where m.user_id = auth.uid()
  order by t.sort
$$;
revoke execute on function public.my_tenants() from public, anon;
grant execute on function public.my_tenants() to authenticated;

create or replace function public.public_app_flags()
returns table (test_mode boolean, banner text, idle_timeout_minutes int)
language sql stable security definer set search_path = public as $$
  with s as (
    select * from public.settings
    where (public.current_tenant() is not null and tenant_id = public.current_tenant())
       or (public.current_tenant() is null)
  )
  select coalesce(bool_or((value)::text::boolean) filter (where key = 'test_mode'), true),
         (array_agg(value #>> '{}' order by tenant_id) filter (where key = 'test_mode_banner'))[1],
         min((value)::text::int) filter (where key = 'idle_timeout_minutes_medical')
  from s
$$;

create or replace function public.guard_last_superadmin_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.roles where id = old.role_id and key = 'superadmin')
     and (tg_op = 'DELETE' or new.role_id <> old.role_id) then
    if (select count(*) from public.tenant_memberships m join public.roles r on r.id = m.role_id
        where m.tenant_id = old.tenant_id and r.key = 'superadmin' and m.id <> old.id) = 0
       and exists (select 1 from public.tenant_memberships where tenant_id = old.tenant_id and id <> old.id) then
      raise exception 'Er moet altijd minstens één superadmin zijn';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_guard_last_superadmin before update or delete on public.tenant_memberships
  for each row execute function public.guard_last_superadmin_membership();

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  hdr jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  act text; cat text; rid text; tid uuid;
begin
  rid := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key', to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'key',
                  to_jsonb(new) ->> 'role_id', to_jsonb(old) ->> 'role_id');
  tid := coalesce((to_jsonb(new) ->> 'tenant_id')::uuid, (to_jsonb(old) ->> 'tenant_id')::uuid,
                  case when tg_table_name = 'tenants' then (coalesce(to_jsonb(new), to_jsonb(old)) ->> 'id')::uuid end, public.current_tenant());
  if tg_table_name in ('settings','holidays') then act := 'settings_changed'; cat := 'changed';
  elsif tg_table_name in ('roles','role_permissions','tenant_memberships','user_roles') then act := 'role_changed'; cat := 'changed';
  elsif tg_table_name = 'patients' then
    act := case tg_op when 'INSERT' then 'patient_created' when 'UPDATE' then 'patient_updated' else 'patient_deleted' end;
    cat := case tg_op when 'INSERT' then 'created' else 'changed' end;
  else act := lower(tg_table_name) || '_' || lower(tg_op); cat := 'changed';
  end if;
  insert into public.audit_log (tenant_id, role_key, user_id, action, category, record_type, record_id, details, ip, user_agent)
  values (tid, public.current_role_key(), auth.uid(), act, cat, tg_table_name, rid,
    jsonb_build_object('op', tg_op,
      'before', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
      'after', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end),
    split_part(coalesce(hdr ->> 'x-forwarded-for', ''), ',', 1),
    hdr ->> 'user-agent');
  return coalesce(new, old);
end $$;
create trigger trg_audit_tenants after insert or update or delete on public.tenants for each row execute function public.audit_row_change();
create trigger trg_audit_tenant_memberships after insert or update or delete on public.tenant_memberships for each row execute function public.audit_row_change();
create trigger trg_audit_group_admins after insert or update or delete on public.group_admins for each row execute function public.audit_row_change();
create trigger trg_audit_profiles after update on public.profiles for each row execute function public.audit_row_change();
create trigger trg_touch_tenants before update on public.tenants for each row execute function public.touch_updated();
create trigger trg_touch_group_admins before update on public.group_admins for each row execute function public.touch_updated();
create trigger trg_touch_group_settings before update on public.group_settings for each row execute function public.touch_updated();
create trigger trg_touch_tenant_memberships before update on public.tenant_memberships for each row execute function public.touch_updated();

do $$
declare p record; q text; w text; tl text[] := array['roles','role_permissions','settings','holidays','patients','practitioner_roles','locations','location_hours','location_exceptions','rooms','equipment','equipment_day_locations','equipment_exceptions','treatment_categories','treatments','treatment_category_links','treatment_practitioner_roles','treatment_locations','treatment_requirements','practitioners','practitioner_languages','practitioner_locations','practitioner_treatments','schedule_blocks','schedule_exceptions','audit_log'];
begin
  for p in select * from pg_policies where schemaname = 'public' and tablename = any(tl) loop
    q := case when p.qual is not null then format('(%s) and tenant_id = public.current_tenant()', p.qual) end;
    w := case when p.with_check is not null then format('(%s) and tenant_id = public.current_tenant()', p.with_check) end;
    if q is not null and w is not null then
      execute format('alter policy %I on public.%I using (%s) with check (%s)', p.policyname, p.tablename, q, w);
    elsif q is not null then
      execute format('alter policy %I on public.%I using (%s)', p.policyname, p.tablename, q);
    elsif w is not null then
      execute format('alter policy %I on public.%I with check (%s)', p.policyname, p.tablename, w);
    end if;
  end loop;
end $$;

alter policy "read own profile or managed" on public.profiles using (
  id = auth.uid() or (public.is_aal2() and (public.has_permission('users.manage') or public.has_permission('logbook.view'))
    and exists (select 1 from public.tenant_memberships m where m.user_id = profiles.id and m.tenant_id = public.current_tenant())));
alter policy "manage profiles" on public.profiles
  using (public.is_aal2() and public.has_permission('users.manage') and exists (select 1 from public.tenant_memberships m where m.user_id = profiles.id and m.tenant_id = public.current_tenant()))
  with check (public.is_aal2() and public.has_permission('users.manage') and exists (select 1 from public.tenant_memberships m where m.user_id = profiles.id and m.tenant_id = public.current_tenant()));

alter policy "read own role" on public.user_roles using (user_id = auth.uid());
alter policy "manage user_roles ins" on public.user_roles with check (false);
alter policy "manage user_roles upd" on public.user_roles using (false) with check (false);
alter policy "manage user_roles del" on public.user_roles using (false);

create policy "memberships read" on public.tenant_memberships for select to authenticated using (
  user_id = auth.uid() or public.is_group_admin()
  or (public.is_aal2() and public.has_permission('users.manage') and tenant_id = public.current_tenant()));
create policy "memberships insert" on public.tenant_memberships for insert to authenticated with check (
  public.is_group_admin() or (public.is_aal2() and public.has_permission('users.manage') and tenant_id = public.current_tenant()));
create policy "memberships update" on public.tenant_memberships for update to authenticated
  using (public.is_group_admin() or (public.is_aal2() and public.has_permission('users.manage') and tenant_id = public.current_tenant()))
  with check (public.is_group_admin() or (public.is_aal2() and public.has_permission('users.manage') and tenant_id = public.current_tenant()));
create policy "memberships delete" on public.tenant_memberships for delete to authenticated using (
  public.is_group_admin() or (public.is_aal2() and public.has_permission('users.manage') and tenant_id = public.current_tenant()));

create policy "tenants read" on public.tenants for select to authenticated using (
  public.is_group_admin() or exists (select 1 from public.tenant_memberships m where m.tenant_id = tenants.id and m.user_id = auth.uid()));
create policy "tenants insert" on public.tenants for insert to authenticated with check (public.is_group_admin());
create policy "tenants update" on public.tenants for update to authenticated using (public.is_group_admin()) with check (public.is_group_admin());
grant insert, update on public.tenants to authenticated;

create policy "group admins read" on public.group_admins for select to authenticated using (user_id = auth.uid() or public.is_group_admin());
create policy "group admins insert" on public.group_admins for insert to authenticated with check (public.is_group_admin());
create policy "group admins delete" on public.group_admins for delete to authenticated using (public.is_group_admin());
create policy "group settings read" on public.group_settings for select to authenticated using (public.is_staff() or public.is_group_admin());

alter policy "option_lists insert" on public.option_lists with check (public.is_group_admin());
alter policy "option_lists update" on public.option_lists using (public.is_group_admin()) with check (public.is_group_admin());
alter policy "option_lists delete" on public.option_lists using (public.is_group_admin());
alter policy "languages insert" on public.languages with check (public.is_group_admin());
alter policy "languages update" on public.languages using (public.is_group_admin()) with check (public.is_group_admin());
alter policy "languages delete" on public.languages using (public.is_group_admin());

insert into public.roles (tenant_id, key, name, landing_page, consult_mode, record_visibility, patient_scope, sort)
select t.id, r.key, r.name, r.landing_page, r.consult_mode, r.record_visibility, r.patient_scope, r.sort
from public.roles r cross join public.tenants t
where r.tenant_id = (select id from public.tenants where slug = 'tbc-nl') and t.slug <> 'tbc-nl';
insert into public.role_permissions (tenant_id, role_id, permission_key)
select nr.tenant_id, nr.id, rp.permission_key
from public.role_permissions rp
join public.roles r on r.id = rp.role_id
join public.roles nr on nr.key = r.key and nr.tenant_id <> r.tenant_id
where r.tenant_id = (select id from public.tenants where slug = 'tbc-nl');
insert into public.settings (tenant_id, key, section, section_sort, label, help, input_type, options, value, sort)
select t.id, s.key, s.section, s.section_sort, s.label, s.help, s.input_type, s.options,
  case when s.key = 'test_mode' then 'true'::jsonb else s.value end, s.sort
from public.settings s cross join public.tenants t
where s.tenant_id = (select id from public.tenants where slug = 'tbc-nl') and t.slug <> 'tbc-nl';
comment on column public.tenants.test_mode is 'DEPRECATED: test mode is the per-tenant setting test_mode';

create or replace function public.resolve_tenant_by_host(_host text)
returns table (slug text, display_name text, default_language text, extra_languages text[], theme jsonb)
language sql stable security definer set search_path = public as $$
  select t.slug, t.display_name, t.default_language, t.extra_languages, t.theme
  from public.tenants t where lower(_host) = any(t.booking_domains)
$$;
revoke execute on function public.resolve_tenant_by_host(text) from public;
grant execute on function public.resolve_tenant_by_host(text) to anon, authenticated;
revoke execute on function public.current_tenant() from public, anon;
grant execute on function public.current_tenant() to authenticated;