import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface ExternalBusyProvider {
  read(db: SupabaseClient<Database>, tenantId: string, from: string, to: string): Promise<Database["public"]["Tables"]["external_busy_periods"]["Row"][]>;
}
/** Replace this provider with Calendar sync later; persisted periods remain the booking authority. */
export const mockExternalBusyProvider: ExternalBusyProvider = {
  async read(db, tenantId, from, to) {
    const r = await db.from("external_busy_periods").select("*").eq("tenant_id", tenantId).lt("starts_at", to).gt("ends_at", from).order("starts_at");
    if (r.error) throw r.error;
    return r.data;
  },
};