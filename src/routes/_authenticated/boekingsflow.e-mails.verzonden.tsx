import { SentMailList } from "@/features/mail/SentMailList";
import { ListPage,DataTable,RowChevron } from "@/components/ListPage";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { SearchField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const TZ = "Europe/Amsterdam";
export const OUTBOX_STATUS: Record<string, string> = { demo_only: "Alleen demo", waiting_domain: "Wacht op afzenderdomein", queued: "In de wachtrij", sent: "Verzonden", failed: "Mislukt" };
type F = { range: string; moment: string; status: string; patient: string };
const PAGE = 50;

const outboxQuery = (f: F, page: number) => queryOptions({
  queryKey: ["outbox", f, page], placeholderData: keepPreviousData,
  queryFn: async () => {
    let q = supabase.from("mail_outbox").select("id, created_at, sent_at, recipient, subject, moment, status, error, patient:patients(patient_number, first_name, last_name)", { count: "exact" }).order("created_at", { ascending: false });
    const days = f.range === "today" ? 0 : f.range === "7" ? 6 : f.range === "30" ? 29 : null;
    if (days !== null) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - days); q = q.gte("created_at", d.toISOString()); }
    if (f.moment !== "all") q = q.eq("moment", f.moment);
    if (f.status !== "all") q = q.eq("status", f.status);
    if (f.patient) {
      const { data: p } = await supabase.from("patients").select("id").eq("patient_number", Number(f.patient)).maybeSingle();
      q = q.eq("patient_id", p?.id ?? "00000000-0000-0000-0000-000000000000");
    }
    const { data, error, count } = await q.range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    return { rows: data ?? [], count: count ?? 0 };
  },
});
const momentsQuery = queryOptions({ queryKey: ["mail-moments"], queryFn: async () => (await supabase.from("option_lists").select("value, label_nl").eq("list_key", "mail_moment").order("sort")).data ?? [] });

export const Route = createFileRoute("/_authenticated/boekingsflow/e-mails/verzonden")({
  head: () => ({ meta: [{ title: "Verzonden e-mails · The Body Clinic" }, { name: "description", content: "Alle mails die het systeem heeft gemaakt, precies zoals de patiënt ze krijgt." }, { property: "og:title", content: "Verzonden e-mails · The Body Clinic" }, { property: "og:description", content: "Alle mails die het systeem heeft gemaakt." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page(){return <SentMailList/>;}
