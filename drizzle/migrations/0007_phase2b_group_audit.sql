alter table public.audit_log drop constraint audit_log_tenant_required;
alter table public.audit_log add constraint audit_log_tenant_required check (tenant_id is not null or category in ('login','group'));

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  hdr jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  act text; cat text; rid text; tid uuid;
begin
  rid := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key', to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'key',
                  to_jsonb(new) ->> 'role_id', to_jsonb(old) ->> 'role_id', to_jsonb(new) ->> 'user_id', to_jsonb(old) ->> 'user_id');
  tid := coalesce((to_jsonb(new) ->> 'tenant_id')::uuid, (to_jsonb(old) ->> 'tenant_id')::uuid,
                  case when tg_table_name = 'tenants' then (coalesce(to_jsonb(new), to_jsonb(old)) ->> 'id')::uuid end, public.current_tenant());
  if tg_table_name in ('group_admins','group_settings') then act := tg_table_name || '_' || lower(tg_op); cat := 'group';
  elsif tg_table_name in ('settings','holidays') then act := 'settings_changed'; cat := 'changed';
  elsif tg_table_name in ('roles','role_permissions','tenant_memberships','user_roles') then act := 'role_changed'; cat := 'changed';
  elsif tg_table_name = 'patients' then
    act := case tg_op when 'INSERT' then 'patient_created' when 'UPDATE' then 'patient_updated' else 'patient_deleted' end;
    cat := case tg_op when 'INSERT' then 'created' else 'changed' end;
  else act := lower(tg_table_name) || '_' || lower(tg_op); cat := 'changed';
  end if;
  if tid is null and cat <> 'group' then cat := 'group'; end if;
  insert into public.audit_log (tenant_id, role_key, user_id, action, category, record_type, record_id, details, ip, user_agent)
  values (tid, public.current_role_key(), auth.uid(), act, cat, tg_table_name, rid,
    jsonb_build_object('op', tg_op,
      'before', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
      'after', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end),
    split_part(coalesce(hdr ->> 'x-forwarded-for', ''), ',', 1),
    hdr ->> 'user-agent');
  return coalesce(new, old);
end $$;