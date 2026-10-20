import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { getBookingCatalog } from "@/data/booking.functions";
import { sendPortalLink } from "@/data/portal.functions";
import { PillButton } from "@/components/PillButton";
import { TextField } from "@/components/Field";
import { CallFooter, Shell, Title } from "./boeken";

const searchSchema = z.object({ merk: z.string().optional(), lang: z.enum(["nl", "en"]).optional(), link: z.string().optional(), vanaf: z.enum(["start", "planner"]).optional(), ret: z.string().max(600).optional() });
const catalogQuery = (merk: string | undefined) => queryOptions({ queryKey: ["booking-catalog", merk ?? ""], queryFn: () => getBookingCatalog({ data: { merk } }), staleTime: 60_000 });

/** Booking-flow login: always by mail link, never a code. The ret param carries the booking draft. */
export const Route = createFileRoute("/boeken_/inloggen")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ merk: search.merk }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(catalogQuery(deps.merk)),
  head: () => ({ meta: [
    { title: "Inloggen · The Body Clinic" },
    { name: "description", content: "Log in met je e-mailadres en ga verder met je afspraak bij The Body Clinic." },
    { property: "og:title", content: "Inloggen · The Body Clinic" },
    { property: "og:description", content: "Log in met je e-mailadres en ga verder met je afspraak." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: LoginPage,
});

function LoginPage() {
  const s = Route.useSearch();
  const { data } = useSuspenseQuery(catalogQuery(s.merk));
  const lang = s.lang ?? "nl";
  const tx = (key: string, vars: Record<string, string | number> = {}) => {
    const r = "ui" in data ? data.ui.find((u) => u.list_key === "booking_ui" && u.value === key) : undefined;
    const base = (lang === "en" && r?.label_en) || r?.label_nl || "";
    return base.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
  };
  const ret = new URLSearchParams(s.ret ?? "");
  const keptT = ret.get("t"), keptL = ret.get("l"), keptD = ret.get("d"), keptTijd = ret.get("tijd");
  const treatment = "treatments" in data && keptT ? data.treatments.find((t) => t.id === keptT) : undefined;
  const location = "locations" in data && keptL ? data.locations.find((l) => l.id === keptL) : undefined;
  const day = keptD ? new Date(`${keptD}T12:00:00Z`).toLocaleDateString(lang === "en" ? "en-GB" : "nl-NL", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "") : "";
  const hasChoice = !!(keptT || keptL || keptD);
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [held, setHeld] = useState(false); const [demo, setDemo] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const back = () => { if (s.ret) window.location.assign(`/boeken?${s.ret}`); else window.history.back(); };
  const phone = "tenant" in data ? data.tenant?.phone : undefined;
  const send = async () => {
    if (!ok || busy) return; setBusy(true);
    try {
      const r = await sendPortalLink({ data: { email: email.trim(), merk: s.merk, draft: s.ret ? { params: s.ret, treatmentId: keptT ?? undefined, locationId: keptL ?? undefined, practitionerId: ret.get("p") ?? undefined, date: keptD ?? undefined, time: keptTijd ?? undefined } : undefined } });
      setHeld(r.held); setDemo(r.demoLink); setSent(true);
    } finally { setBusy(false); }
  };
  const choiceCard = hasChoice ? (
    <div className="rounded-[18px] bg-sand p-4">
      <p className="text-[12px] font-medium text-muted-foreground">{tx("choice_kept_title")}</p>
      {treatment && <p className="mt-1.5 text-[15px] font-semibold">{(lang === "en" && treatment.name_en) || treatment.name_nl}</p>}
      <p className="text-[14px] text-muted-foreground">{[location ? (location.kind === "online" ? tx("online_title") : location.name) : "", day && keptTijd ? `${day}, ${keptTijd}` : day].filter(Boolean).join(" · ")}</p>
    </div>
  ) : null;
  return (
    <Shell lang={lang} onBack={back} onClose={() => window.location.assign(`/boeken${s.ret ? `?${s.ret}` : ""}`)}
      footer={sent
        ? (phone ? <CallFooter phone={phone} tx={tx} /> : undefined)
        : <div className="flex flex-col gap-5"><PillButton size="lg" className="patient-choice choice-primary w-full" disabled={!ok || busy} onClick={() => void send()}>{tx("login_send")}</PillButton>{phone ? <CallFooter phone={phone} tx={tx} /> : null}</div>}>
      <button type="button" onClick={back} className="mb-4 self-start text-[14px] font-medium text-primary">‹ {tx("back") || "Terug"}</button>
      {sent ? (
        <>
          <span className="mb-6 flex size-[52px] items-center justify-center rounded-full bg-teal-light"><Mail className="size-5 text-primary" strokeWidth={1.7} /></span>
          <Title>{tx("login_sent_title")}</Title>
          <p className="text-[15px] leading-[1.6]">{tx("login_sent_body", { email: email.trim() })}</p>
          {held && <p className="booking-note-amber mt-4">{tx("hold_note", { n: 15 })}</p>}
          {choiceCard && <div className="mt-4">{choiceCard}</div>}
          <div className="mt-6 flex flex-col items-center gap-3">
            <button type="button" onClick={() => void send()} className="text-[14px] text-primary underline">{tx("resend")}</button>
            <button type="button" onClick={() => setSent(false)} className="text-[14px] text-primary underline">{tx("other_email")}</button>
          </div>
          <p className="mt-6 text-center text-[13px] text-muted-foreground">{tx("spam_note")}</p>
          {demo && <a href={demo} className="portal-demo-link mt-4 block text-center text-[13px] text-primary underline">Demo: open de inloglink</a>}
        </>
      ) : (
        <>
          <Title sub={tx("login_body")}>{tx("login_title")}</Title>
          {choiceCard && <div className="mb-5">{choiceCard}</div>}
          <TextField label={tx("d_email")} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="mt-6 text-center text-[14px]"><a href={`/boeken${s.ret ? `?${s.ret}` : ""}`} className="text-primary underline">{tx("login_new")}</a></p>
        </>
      )}
    </Shell>
  );
}
