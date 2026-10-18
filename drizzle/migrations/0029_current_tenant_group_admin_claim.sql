-- Group admins have no membership in the active tenant; honour the server-written claim for them
-- so tenant-scoped reads return that brand's (empty) data instead of breaking every screen.
create or replace function public.current_tenant()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.tenant_id from public.tenant_memberships m
      join public.profiles p on p.id = m.user_id and not p.blocked
      where m.user_id = auth.uid()
        and m.tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'active_tenant')),
    case when public.is_group_admin()
      then nullif(auth.jwt() -> 'app_metadata' ->> 'active_tenant', '')::uuid end)
$$;