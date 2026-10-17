create or replace function public.assign_patient_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.patient_number is null or new.patient_number = 0 then
    perform pg_advisory_xact_lock(hashtext('patient_number:' || new.tenant_id::text));
    select coalesce(max(patient_number), 1000000) + 1 into new.patient_number
    from public.patients where tenant_id = new.tenant_id;
  end if;
  return new;
end $$;
alter table public.patients alter column patient_number set default 0;
comment on column public.patients.patient_number is '0 = assign next number for this tenant (assign_patient_number trigger)';