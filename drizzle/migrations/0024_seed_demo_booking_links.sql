INSERT INTO public.booking_links (tenant_id, slug, name, source, treatment_id, location_ids, practitioner_mode, practitioner_id, language, status, sort)
SELECT v.tenant_id, v.slug, v.name, v.source, v.treatment_id, v.location_ids, v.practitioner_mode, NULL, v.language, 'active', v.sort
FROM (VALUES
  ('75f25a40-9ec2-4c90-b829-b91918cf14df'::uuid, 'instagram-oktober', 'Instagram oktober', 'Instagram oktober', '865257ba-2dd8-4f0b-839c-eba7c329228b'::uuid, ARRAY['190eca8a-2b25-413b-8d78-980504ae8382']::uuid[], 'optional', 'nl', 10),
  ('75f25a40-9ec2-4c90-b829-b91918cf14df'::uuid, 'google-search', 'Google search', 'Google search', NULL::uuid, ARRAY['190eca8a-2b25-413b-8d78-980504ae8382']::uuid[], 'optional', 'nl', 20)
) AS v(tenant_id, slug, name, source, treatment_id, location_ids, practitioner_mode, language, sort)
WHERE NOT EXISTS (
  SELECT 1 FROM public.booking_links b WHERE b.tenant_id = v.tenant_id AND b.slug = v.slug
);