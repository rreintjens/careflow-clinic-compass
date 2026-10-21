import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { portalTreatmentSchema } from '@/domain/portal-treatment';

export const readPortalTreatment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ appointmentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc('portal_treatment_detail', { _appointment: data.appointmentId });
    if (result.error) throw new Error('Je behandeling kon niet worden geladen.');
    return portalTreatmentSchema.parse(result.data);
  });