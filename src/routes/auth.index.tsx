import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PillButton } from "@/components/PillButton";
import { landingPath, signInSchema, type SignInInput } from "@/domain/auth";
import { staffContextQuery } from "@/data/staff";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { demoLoginAvailable, signInDemo, signInStaff } from "@/features/auth/auth.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Inloggen · Beheer · The Body Clinic" },
      { name: "description", content: "Inloggen voor medewerkers van The Body Clinic." },
      { property: "og:title", content: "Inloggen · The Body Clinic" },
      { property: "og:description", content: "Inloggen voor medewerkers van The Body Clinic." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/auth/2fa" });
  },
  component: LoginPage,
});

const inputCls = "h-12 w-full rounded-[14px] bg-sand px-4 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring";

function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [demoBusy, setDemoBusy] = useState(false);
  const { register, handleSubmit, formState } = useForm<SignInInput>({ resolver: zodResolver(signInSchema) });
  const { data: demo } = useQuery({ queryKey: ["demo-login-available"], queryFn: () => demoLoginAvailable(), staleTime: 60_000 });

  // Without a required second factor (test mode) the user goes straight to their landing page.
  const finish = async (res: { ok: false; error: string } | { ok: true; accessToken: string; refreshToken: string }) => {
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const { error: e } = await supabase.auth.setSession({ access_token: res.accessToken, refresh_token: res.refreshToken });
    if (e) {
      setError("Inloggen is niet gelukt. Probeer het opnieuw.");
      return;
    }
    const { data: required } = await supabase.rpc("mfa_required");
    if (required !== false) {
      navigate({ to: "/auth/2fa" });
      return;
    }
    queryClient.removeQueries({ queryKey: staffContextQuery.queryKey });
    const staff = await queryClient.fetchQuery(staffContextQuery);
    navigate({ to: landingPath(staff?.landing_page), replace: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    await finish(await signInStaff({ data: values }));
  });

  const onDemo = async () => {
    setError(null);
    setDemoBusy(true);
    try {
      await finish(await signInDemo());
    } finally {
      setDemoBusy(false);
    }
  };

  const notInTest = () => toast("Niet beschikbaar in de testomgeving");

  return (
    <AuthLayout>
        {demo?.available && (
          <PillButton
            variant="outline"
            size="lg"
            block
            className="mb-6"
            disabled={formState.isSubmitting || demoBusy}
            onClick={onDemo}
          >
            Inloggen als Rob
          </PillButton>
        )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <h2 className="text-[26px] font-semibold tracking-tight">Inloggen</h2>
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-[13px] font-medium">E-mailadres</label>
          <input id="email" type="email" autoComplete="username" className={inputCls} {...register("email")} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-[13px] font-medium">Wachtwoord</label>
          <input id="password" type="password" autoComplete="current-password" className={inputCls} {...register("password")} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2.5">
            <input type="checkbox" className="size-[18px] accent-primary" />
            Onthoud dit apparaat 30 dagen
          </label>
          <button type="button" onClick={notInTest} className="text-primary underline underline-offset-2">Wachtwoord vergeten</button>
        </div>
        {error && <p role="alert" className="rounded-[14px] bg-warning-bg px-4 py-3 text-sm text-warning">{error}</p>}
        <PillButton type="submit" size="lg" block disabled={formState.isSubmitting}>Verder</PillButton>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-line" />of<span className="h-px flex-1 bg-line" />
        </div>
        <PillButton variant="outline" size="lg" block onClick={notInTest} className="border-mist text-foreground">
          Inloggen met je Google-account van The Body Clinic
        </PillButton>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Na 5 mislukte pogingen wordt het account 15 minuten geblokkeerd. Beheerders kunnen een gebruiker direct blokkeren bij Gebruikers en rollen.
        </p>
        <p className="text-xs text-muted-foreground">
          Patiënt afspaken?{" "}
          <Link to="/boeken" className="text-primary underline underline-offset-2">Naar de boekingskalender</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
