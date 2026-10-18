-- A group admin sits above the organisations: no membership needed to sign in,
-- every tenant appears in the switcher, and inside any tenant they act as superadmin.

create or replace function public.current_role_key()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select r.key from public.tenant_memberships m
      join public.roles r on r.id = m.role_id
      join public.profiles p on p.id = m.user_id and not p.blocked
      where m.user_id = auth.uid() and m.tenant_id = public.current_tenant()),
    case when public.is_group_admin() then 'superadmin' end)
$$;

create or replace function public.has_permission(_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_group_admin() or exists (
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
  union all
  select 'superadmin', 'Superadmin', 'dashboard', 'yes', p.full_name, p.email,
    (select array_agg(key) from public.permissions)
  from public.profiles p
  where p.id = auth.uid() and not p.blocked and public.is_group_admin()
    and not exists (select 1 from public.tenant_memberships m2 where m2.user_id = auth.uid() and m2.tenant_id = public.current_tenant())
$$;

create or replace function public.my_tenants()
returns table (tenant_id uuid, slug text, display_name text, role_name text, active boolean)
language sql stable security definer set search_path = public as $$
  select q.tenant_id, q.slug, q.display_name, q.role_name, q.active from (
    select t.id as tenant_id, t.slug, t.display_name, r.name as role_name,
           t.id = public.current_tenant() as active, t.sort
    from public.tenant_memberships m
    join public.tenants t on t.id = m.tenant_id
    join public.roles r on r.id = m.role_id
    join public.profiles p on p.id = m.user_id and not p.blocked
    where m.user_id = auth.uid()
    union all
    select t.id, t.slug, t.display_name, 'Superadmin', t.id = public.current_tenant(), t.sort
    from public.tenants t
    where public.is_group_admin()
      and not exists (select 1 from public.tenant_memberships m2 where m2.tenant_id = t.id and m2.user_id = auth.uid())
  ) q order by q.sort
$$;