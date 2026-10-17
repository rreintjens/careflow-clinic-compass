create or replace function public.current_tenant_slug()
returns text language sql stable security definer set search_path = public as $$
  select slug from public.tenants where id = public.current_tenant()
$$;
revoke execute on function public.current_tenant_slug() from public, anon;
grant execute on function public.current_tenant_slug() to authenticated;

alter policy "practitioner photos read" on storage.objects
  using (bucket_id = 'practitioner-photos-' || public.current_tenant_slug() and public.is_aal2() and public.is_staff());
alter policy "practitioner photos write" on storage.objects
  with check (bucket_id = 'practitioner-photos-' || public.current_tenant_slug() and public.is_aal2() and public.has_permission('settings.edit'));
alter policy "practitioner photos update" on storage.objects
  using (bucket_id = 'practitioner-photos-' || public.current_tenant_slug() and public.is_aal2() and public.has_permission('settings.edit'));
alter policy "practitioner photos delete" on storage.objects
  using (bucket_id = 'practitioner-photos-' || public.current_tenant_slug() and public.is_aal2() and public.has_permission('settings.edit'));