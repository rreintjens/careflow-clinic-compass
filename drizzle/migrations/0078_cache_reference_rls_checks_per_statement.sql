-- Preserve all existing read rules; stable caller-only predicates become statement InitPlans.
-- No privileges, roles, tenant isolation or write policies are changed.
DO $migration$
DECLARE p record; optimized text;
BEGIN
  FOR p IN SELECT tablename,policyname,qual FROM pg_policies
    WHERE schemaname='public' AND cmd='SELECT'
      AND tablename IN ('locations','rooms','equipment','equipment_schedule','equipment_kinds','equipment_types','treatment_categories','treatments','treatment_category_links','treatment_practitioner_roles','treatment_locations','treatment_requirements','practitioners','practitioner_languages','practitioner_locations','practitioner_treatments','schedule_blocks','schedule_exceptions','option_lists','practitioner_roles','languages','location_hours')
  LOOP
    optimized := replace(replace(replace(replace(p.qual,
      'is_aal2()', '(SELECT public.is_aal2())'),
      'is_staff()', '(SELECT public.is_staff())'),
      'current_tenant()', '(SELECT public.current_tenant())'),
      'portal_patient_id()', '(SELECT public.portal_patient_id())');
    EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', p.policyname,p.tablename,optimized);
  END LOOP;
END $migration$;