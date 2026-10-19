import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ActiveConsultMode } from "@/features/dossier/ConsultMode";
import { Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

import { Sidebar } from "@/components/Sidebar";
import { landingPath, needsShortIdleTimeout } from "@/domain/auth";
import { myTenantsQuery, resetTenantCaches } from "@/data/tenant";
import { appFlagsQuery, staffContextQuery } from "@/data/staff";
import { logAuthEvent, switchTenant } from "@/features/auth/auth.functions";
import { supabase } from "@/integrations/supabase/client";

// Staff area: valid session + verified second factor (aal2) + an active role.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal.data?.currentLevel !== "aal2") {
      // The per-tenant setting decides whether the second step is required (also enforced in RLS via is_aal2).
      const { data: required } = await supabase.rpc("mfa_required");
      if (required !== false) throw redirect({ to: "/auth/2fa" });
    }
    const staff = await context.queryClient.ensureQueryData(staffContextQuery);
    await context.queryClient.ensureQueryData(myTenantsQuery);
    if (!staff) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
  },
  component: StaffLayout,
});

function StaffLayout() {
  const { data: staff } = useSuspenseQuery(staffContextQuery);
  const { data: flags } = useSuspenseQuery(appFlagsQuery);
  const { data: tenants } = useSuspenseQuery(myTenantsQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const signOut = useCallback(async () => {
    try {
      await logAuthEvent({ data: { action: "logout" } });
    } catch {
      /* session may already be gone */
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    resetTenantCaches();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }, [navigate, queryClient]);

  // Switching tenant: claim is rewritten server-side, then the token is refreshed and every client cache is dropped.
  const onSwitchTenant = useCallback(
    async (tenantId: string) => {
      if (tenants.find((t) => t.active)?.tenant_id === tenantId) return;
      await switchTenant({ data: { tenantId } });
      await supabase.auth.refreshSession();
      await queryClient.cancelQueries();
      queryClient.clear();
      resetTenantCaches();
      const next = await queryClient.fetchQuery(staffContextQuery);
      navigate({ to: landingPath(next?.landing_page), replace: true });
    },
    [navigate, queryClient, tenants],
  );

  // Idle timeout for roles that see medical data.
  const idleMinutes = flags?.idle_timeout_minutes ?? 15;
  const short = staff ? needsShortIdleTimeout(staff.permissions) : false;
  useEffect(() => {
    if (!short) return;
    let timer = window.setTimeout(signOut, idleMinutes * 60_000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(signOut, idleMinutes * 60_000);
    };
    const events = ["mousemove", "keydown", "pointerdown", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [short, idleMinutes, signOut]);

  if (!staff) return null;
  return (
    <div className="flex min-h-screen">
      <Sidebar fullName={staff.full_name} email={staff.email} roleName={staff.role_name} onSignOut={signOut} tenants={tenants} onSwitchTenant={onSwitchTenant} />
      <main className="min-w-0 flex-1 px-10 pb-12 pt-8">
        <ActiveConsultMode />
        <Outlet />
      </main>
    </div>
  );
}
