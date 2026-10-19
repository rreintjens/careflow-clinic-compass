import { ListPage,DataTable,RowChevron } from "@/components/ListPage";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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

export function SentMailList({embedded=false}:{embedded?:boolean}) {
  const [f, setF] = useState<F>({ range: "7", moment: "all", status: "all", patient: "" });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const set = (p: Partial<F>) => { setF((x) => ({ ...x, ...p })); setPage(0); };
  const { data } = useQuery(outboxQuery(f, page));
  const { data: moments = [] } = useQuery(momentsQuery);
  const label = (m: string) => moments.find((x) => x.value === m)?.label_nl ?? m;
  const total = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE));
  return (
    <ListPage>
      {!embedded&&<div className="flex flex-wrap items-center justify-between gap-4">
        <div><Link to="/boekingsflow/e-mails" className="text-[13px] text-primary">E-mails en sjablonen</Link><h1 className="text-[28px] font-semibold">Verzonden e-mails</h1></div>
        <p className="max-w-[520px] text-sm text-muted-foreground">Demo: elke mail wordt gemaakt zoals de patiënt hem krijgt. Alleen adressen op de lijst in Instellingen &gt; Algemeen krijgen hem echt; de rest blijft hier als “alleen demo”.</p>
      </div>}
      <div className="flex flex-wrap items-end gap-3">
        <Select inline label="Periode" value={f.range} onChange={(range) => set({ range })} options={[{ value: "today", label: "Vandaag" }, { value: "7", label: "Laatste 7 dagen" }, { value: "30", label: "Laatste 30 dagen" }, { value: "all", label: "Alles" }]} />
        <Select inline label="Moment" value={f.moment} onChange={(moment) => set({ moment })} options={[{ value: "all", label: "Alle momenten" }, ...moments.map((m) => ({ value: m.value, label: m.label_nl }))]} />
        <Select inline label="Status" value={f.status} onChange={(status) => set({ status })} options={[{ value: "all", label: "Alle statussen" }, ...Object.entries(OUTBOX_STATUS).map(([value, l]) => ({ value, label: l }))]} />
        <SearchField aria-label="Patiëntnummer" placeholder="Patiëntnummer" inputMode="numeric" value={f.patient} onChange={(e) => set({ patient: e.target.value.replace(/\D/g, "") })} className="w-[240px]" />
      </div>
      <DataTable count={data?.count??0} label="e-mails" loading={!data}>
        {!data?.rows.length && <p className="py-8 text-sm text-muted-foreground">Nog geen mails in deze selectie.</p>}
        {data?.rows.map((r) => {
          const p = r.patient as { patient_number: number; first_name: string; last_name: string } | null;
          return (
            <button key={r.id} type="button" onClick={() => setOpen(r.id)} className="list-item grid w-full grid-cols-[130px_190px_1fr_200px_170px] items-center gap-4 py-3.5 text-left text-sm hover:bg-sand">
              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ })}</span>
              <span className="truncate">{label(r.moment)}</span>
              <span className="truncate"><b className="font-semibold">{r.subject}</b><span className="block truncate text-xs text-muted-foreground">{r.recipient}</span></span>
              <span className="truncate text-muted-foreground">{p ? `${p.patient_number} · ${p.first_name} ${p.last_name}` : ""}</span>
              <span><span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-xs", r.status === "sent" ? "bg-teal-light text-primary-hover" : r.status === "failed" ? "bg-warning-bg text-warning" : "bg-sand")}>{OUTBOX_STATUS[r.status] ?? r.status}</span><RowChevron/></span>
            </button>
          );
        })}
      </DataTable>
      {total > 1 && <div className="flex justify-end gap-2"><PillButton variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Vorige</PillButton><span className="self-center text-sm">{page + 1} van {total}</span><PillButton variant="outline" size="sm" disabled={page >= total - 1} onClick={() => setPage(page + 1)}>Volgende</PillButton></div>}
      {open && <MailView id={open} label={label} onClose={() => setOpen(null)} />}
    </ListPage>
  );
}

function MailView({ id, label, onClose }: { id: string; label: (m: string) => string; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ["outbox-mail", id], queryFn: async () => (await supabase.from("mail_outbox").select("recipient, subject, html, moment, status, error, created_at").eq("id", id).single()).data });
  return (
    <Modal open width="lg" onOpenChange={(o) => !o && onClose()} title={data?.subject ?? "E-mail"} description={data ? `${label(data.moment)} · aan ${data.recipient} · ${OUTBOX_STATUS[data.status] ?? data.status}` : ""} footer={<PillButton onClick={onClose}>Sluiten</PillButton>}>
      {data?.error && <p className="mb-3 rounded-[12px] bg-signal px-3 py-2 text-[13px] ring-1 ring-signal-border">{data.error}</p>}
      {data && <iframe title="De e-mail zoals de patiënt hem krijgt" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={data.html} className="h-[70vh] w-full rounded-[14px] border-0 bg-background" />}
    </Modal>
  );
}
