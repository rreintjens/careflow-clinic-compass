import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PillButton } from "@/components/PillButton";
import { hasRegisteredAuthSession, landingPath } from "@/domain/auth";
import { staffContextQuery } from "@/data/staff";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { logAuthEvent } from "@/features/auth/auth.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/2fa")({
  ssr: false,
  head: () => ({ meta: [{ title: "Tweestapsverificatie · The Body Clinic" }, { name: "description", content: "Veilig aanmelden met je authenticator bij The Body Clinic." }, { property: "og:title", content: "Tweestapsverificatie · The Body Clinic" }, { property: "og:description", content: "Veilig aanmelden met je authenticator bij The Body Clinic." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const claims = await supabase.auth.getClaims();
    if (claims.error || !hasRegisteredAuthSession(claims.data?.claims)) {
      // Preview identity tokens have no registered session for factor enrollment.
      await supabase.auth.signOut({ scope: "local" });
      throw redirect({ to: "/auth" });
    }
    // A patient session (Mijn omgeving) is not a staff login: drop it so the staff sign-in shows.
    const { data: patientId } = await supabase.rpc("portal_patient_id");
    if (patientId) {
      await supabase.auth.signOut({ scope: "local" });
      throw redirect({ to: "/auth" });
    }
  },
  component: TwoFactorPage,
});

type Enroll = { factorId: string; qr: string; secret: string };

function TwoFactorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<Enroll | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const started = useRef(false);

  const goLanding = async () => {
    queryClient.removeQueries({ queryKey: staffContextQuery.queryKey });
    const staff = await queryClient.fetchQuery(staffContextQuery);
    navigate({ to: landingPath(staff?.landing_page), replace: true });
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal.data?.currentLevel === "aal2") return goLanding();
        const { data: required } = await supabase.rpc("mfa_required");
        if (required === false) return goLanding();
        const { data, error: factorError } = await supabase.auth.mfa.listFactors();
        if (factorError) throw factorError;
        const verified = data?.totp.find((f) => f.status === "verified");
        if (verified) return setFactorId(verified.id);
        for (const f of data?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
        const res = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator" });
        if (res.error) return setError("Tweestapsverificatie instellen is niet gelukt. Ververs de pagina en probeer het opnieuw.");
        setFactorId(res.data.id);
        setEnroll({ factorId: res.data.id, qr: res.data.totp.qr_code, secret: res.data.totp.secret });
      } catch {
        setError("De tweestapsverificatie kon niet worden geladen. Ververs de pagina en probeer het opnieuw.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      const next = clean.slice(0, 6).split("");
      setDigits([...next, ...Array(6 - next.length).fill("")]);
      refs.current[Math.min(next.length, 5)]?.focus();
      return;
    }
    setDigits((d) => d.map((x, j) => (j === i ? clean : x)));
    if (clean && i < 5) refs.current[i + 1]?.focus();
  };

  // The factor lookup can fail silently (dropped connection right after sign-in); recover lazily
  // so the button never stays dead with a full code.
  const ensureFactor = async (): Promise<string | null> => {
    if (factorId) return factorId;
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp.find((f) => f.status === "verified");
    if (verified) {
      setFactorId(verified.id);
      return verified.id;
    }
    return null;
  };

  const verify = async () => {
    const code = digits.join("");
    if (code.length !== 6) return setError("Vul de code van 6 cijfers in.");
    setBusy(true);
    setError(null);
    try {
    const fid = await ensureFactor().catch(() => null);
    if (!fid) {
      setBusy(false);
      return setError("De verbinding met de tweestapsverificatie is weggevallen. Ververs de pagina en probeer het opnieuw.");
    }
    const { error: e } = await supabase.auth.mfa.challengeAndVerify({ factorId: fid, code });
    if (e) {
      setBusy(false);
      setDigits(Array(6).fill(""));
      refs.current[0]?.focus();
      return setError("Deze code klopt niet. Probeer het opnieuw.");
    }
    await logAuthEvent({ data: { action: "mfa_verified" } });
    await goLanding();
    } catch {
      setError("Aanmelden kon niet worden afgerond. Probeer opnieuw.");
    } finally {
      setBusy(false);
    }
  };

  const notInTest = () => toast("Niet beschikbaar in de testomgeving");

  return (
    <AuthLayout>
      <div className="flex flex-col gap-5">
        <h2 className="text-[26px] font-semibold tracking-tight">Nog één stap</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Open je authenticator-app en vul de code van 6 cijfers in.
        </p>
        {enroll && (
          <div className="flex items-center gap-4 rounded-[14px] bg-sand p-4">
            <img src={enroll.qr} alt="QR-code voor je authenticator-app" className="size-32 rounded-lg bg-background p-1" />
            <div className="min-w-0 text-xs text-muted-foreground">
              Eerste keer: scan deze code met je authenticator-app.
              <code className="mt-2 block break-all text-foreground">{enroll.secret}</code>
            </div>
          </div>
        )}
        <div className="flex gap-2" role="group" aria-label="Code van 6 cijfers">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Cijfer ${i + 1}`}
              maxLength={6}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus();
                if (e.key === "Enter") verify();
              }}
              className="h-[60px] w-full rounded-[14px] bg-sand text-center text-xl font-semibold outline-none focus:border focus:border-primary focus:bg-background"
            />
          ))}
        </div>
        {error && <p role="alert" className="rounded-[14px] bg-warning-bg px-4 py-3 text-sm text-warning">{error}</p>}
        {error && <PillButton variant="outline" disabled={busy} onClick={async () => {
          await supabase.auth.signOut({ scope: "local" });
          queryClient.clear();
          await navigate({ to: "/auth", replace: true });
        }}>Opnieuw aanmelden</PillButton>}
        <PillButton size="lg" block onClick={verify} disabled={busy || digits.join("").length !== 6}>Inloggen</PillButton>
        <div className="flex justify-between text-[13px]">
          <button type="button" onClick={notInTest} className="text-primary underline underline-offset-2">Stuur een sms-code</button>
          <button type="button" onClick={notInTest} className="text-primary underline underline-offset-2">Herstelcode gebruiken</button>
        </div>
        <p className="rounded-[14px] bg-sand px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          Verplicht voor iedereen die patiëntgegevens ziet. Na het inloggen land je op je startpagina: artsen in Mijn dag, customer care in de agenda, beheerders op het dashboard.
        </p>
      </div>
    </AuthLayout>
  );
}
