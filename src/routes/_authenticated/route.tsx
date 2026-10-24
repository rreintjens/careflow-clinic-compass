import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ActiveConsultMode } from "@/features/dossier/ConsultMode";
import { logPageView } from "@/data/users.functions";
import { useRouterState } from "@tanstack/react-router";
import { Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";

import { Sidebar } from "@/components/Sidebar";
import { landingPath, needsShortIdleTimeout } from "@/domain/auth";
import { myTenantsQuery, resetTenantCaches } from "@/data/tenant";
import { appFlagsQuery, staffContextQuery } from "@/data/staff";
import { logAuthEvent, switchTenant } from "@/features/auth/auth.functions";
import { supabase } from "@/integrations/supabase/client";
import { agendaRefQuery } from "@/data/agenda";

// Staff area: valid session + verified second factor (aal2) + an active role.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    // Local session only identifies the UI cache; the cached check validates with getUser.
    // Data access always remains independently enforced by RLS/server middleware.
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw redirect({ to: '/auth' });
    await context.queryClient.fetchQuery({
      queryKey: ['staff-navigation-check', session.session.user.id, session.session.user.app_metadata['active_tenant'], session.session.expires_at],
      staleTime: 30_000,
      retry: false,
      queryFn: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal.data?.currentLevel !== "aal2") {
      // The per-tenant setting decides whether the second step is required (also enforced in RLS via is_aal2).
      const { data: required } = await supabase.rpc("mfa_required");
      if (required !== false) throw redirect({ to: "/auth/2fa" });
    }
    const [staff] = await Promise.all([context.queryClient.ensureQueryData(staffContextQuery), context.queryClient.ensureQueryData(myTenantsQuery), context.queryClient.ensureQueryData(appFlagsQuery)]);
    if (!staff) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    return true;
      },
    });
  },
  component: StaffLayout,
});

function StaffLayout() {
  const { data: staff } = useSuspenseQuery(staffContextQuery);
  const { data: flags } = useSuspenseQuery(appFlagsQuery);
  const { data: tenants } = useSuspenseQuery(myTenantsQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Warm only this signed-in tenant's reference cache before the first agenda visit.
  useEffect(() => {
    if (staff) void queryClient.prefetchQuery(agendaRefQuery);
  }, [staff, queryClient]);

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

  // Logbook: one 'viewed' row for every staff page and record tab.
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  const lastLogged = useRef("");
  useEffect(() => {
    if (!staff || lastLogged.current === pathname) return;
    lastLogged.current = pathname;
    void logPageView({ data: { route: pathname } }).catch(() => undefined);
  }, [pathname, staff]);

  if (!staff) return null;
  return (
    <div className="staff-shell flex min-h-dvh flex-col lg:flex-row">
      <Sidebar fullName={staff.full_name} email={staff.email} roleName={staff.role_name} onSignOut={signOut} tenants={tenants} onSwitchTenant={onSwitchTenant} />
      <main className="staff-content w-full min-w-0 flex-1 px-4 pb-8 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
        <ActiveConsultMode />
        <Outlet />
      </main>
    </div>
  );
}
