import { ListPage,DataTable,RowChevron } from "@/components/ListPage";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { SearchField } from "@/components/Field";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { UiIcon } from "@/components/UiIcon";
import { usersQuery } from "@/data/roles";
import { describeAudit, toCsv, type AuditRow } from "@/domain/audit";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  login: "Ingelogd", changed: "Gewijzigd", created: "Aangemaakt", viewed: "Bekeken", medical: "Medische gegevens",
  email: "E-mail", exported: "Geëxporteerd", integration: "Koppeling",
};
const PAGE = 50;
const TZ = "Europe/Amsterdam";
type Filter = { range: string; from: string; to: string; user: string; category: string; patient: string };

const dayKey = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: TZ });
/** Period as [from, to) ISO bounds in clinic time. */
function bounds(f: Filter): [string | null, string | null] {
  const start = (iso: string) => new Date(`${iso}T00:00:00+02:00`);
  const today = dayKey(new Date());
  const add = (iso: string, n: number) => { const d = start(iso); d.setUTCDate(d.getUTCDate() + n); return dayKey(new Date(d.getTime() + 3 * 3600_000)); };
  if (f.range === "today") return [start(today).toISOString(), start(add(today, 1)).toISOString()];
  if (f.range === "yesterday") return [start(add(today, -1)).toISOString(), start(today).toISOString()];
  if (f.range === "7") return [start(add(today, -6)).toISOString(), null];
  if (f.range === "30") return [start(add(today, -29)).toISOString(), null];
  if (f.range === "custom") return [f.from ? start(f.from).toISOString() : null, f.to ? start(add(f.to, 1)).toISOString() : null];
  return [null, null];
}

async function query(f: Filter, page: number | null) {
  let q = supabase.from("audit_log").select("id, at, user_id, action, category, record_type, record_id, details", { count: "exact" }).order("at", { ascending: false });
  const [from, to] = bounds(f);
  if (from) q = q.gte("at", from);
  if (to) q = q.lt("at", to);
  if (f.user !== "all") q = q.eq("user_id", f.user);
  if (f.category !== "all") q = q.eq("category", f.category);
  const num = f.patient.trim();
  if (num) {
    if (!/^\d+$/.test(num)) return { rows: [], count: 0 };
    const { data: p } = await supabase.from("patients").select("id").eq("patient_number", Number(num)).maybeSingle();
    q = p ? q.or(`record_id.eq.${p.id},details->>patient_number.eq.${num}`) : q.eq("details->>patient_number", num);
  }
  q = page === null ? q.limit(5000) : q.range(page * PAGE, page * PAGE + PAGE - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as Array<AuditRow & { id: number; at: string }>, count: count ?? 0 };
}

const logQuery = (f: Filter, page: number) => queryOptions({ queryKey: ["audit", f, page], queryFn: () => query(f, page), placeholderData: keepPreviousData });
const INITIAL: Filter = { range: "today", from: "", to: "", user: "all", category: "all", patient: "" };

export const Route = createFileRoute("/_authenticated/instellingen/logboek")({
  head: () => ({ meta: [{ title: "Logboek · The Body Clinic" }, { name: "description", content: "Alles wat in het systeem gebeurt." }, { property: "og:title", content: "Logboek · The Body Clinic" }, { property: "og:description", content: "Alles wat in het systeem gebeurt." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(logQuery(INITIAL, 0)),
  component: LogPage,
});

const timeFmt = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dayFmt = new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });

/** Page numbers as in the design: 1 2 3 … last. */
function pages(cur: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const set = new Set([0, 1, 2, cur - 1, cur, cur + 1, total - 1].filter((n) => n >= 0 && n < total));
  const out: Array<number | "…"> = [];
  [...set].sort((a, b) => a - b).forEach((n, i, a) => { if (i && n - (a[i - 1] as number) > 1) out.push("…"); out.push(n); });
  return out;
}

function LogPage() {
  const [f, setF] = useState<Filter>(INITIAL);
  const [page, setPage] = useState(0);
  const set = (p: Partial<Filter>) => { setF((x) => ({ ...x, ...p })); setPage(0); };
  const { data } = useQuery(logQuery(f, page));
  const users = useQuery(usersQuery);
  const name = (id: string | null) => (id ? (users.data?.find((u) => u.id === id)?.full_name ?? "Onbekende gebruiker") : null);
  const rows = data?.rows ?? [];
  const count = data?.count ?? 0;
  const total = Math.max(1, Math.ceil(count / PAGE));
  const today = dayKey(new Date());

  const exportCsv = async () => {
    const all = await query(f, null);
    const csv = toCsv([["Datum", "Tijd", "Wie", "Actie", "Wat", "Pagina"], ...all.rows.map((r) => {
      const l = describeAudit(r), d = new Date(r.at), who = name(l.actor);
      return [d.toLocaleDateString("nl-NL", { timeZone: TZ }), timeFmt.format(d), who ?? "Systeem", CATEGORY_LABELS[r.category] ?? r.category, who ? `${who} ${l.text}` : l.text, l.link ?? ""];
    })]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `logboek-${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  let lastDay = "";
  return (
    <ListPage>
      <PageHeader title="Logboek" description="Alles wat in het systeem gebeurt, ook welke pagina’s zijn bekeken. Niemand kan regels wijzigen of verwijderen." />
      <div className="flex flex-wrap items-end gap-3">
        <Select inline label="Periode" value={f.range} onChange={(range) => set({ range })} options={[{ value: "today", label: "Vandaag" }, { value: "yesterday", label: "Gisteren" }, { value: "7", label: "Laatste 7 dagen" }, { value: "30", label: "Laatste 30 dagen" }, { value: "custom", label: "Periode kiezen" }, { value: "all", label: "Alles" }]} />
        {f.range === "custom" && <>
          <label className="text-sm">Van <input type="date" aria-label="Van" value={f.from} onChange={(e) => set({ from: e.target.value })} className="ml-1 h-11 rounded-[14px] bg-sand px-3" /></label>
          <label className="text-sm">Tot en met <input type="date" aria-label="Tot en met" value={f.to} onChange={(e) => set({ to: e.target.value })} className="ml-1 h-11 rounded-[14px] bg-sand px-3" /></label>
        </>}
        <Select inline label="Gebruiker" value={f.user} onChange={(user) => set({ user })} options={[{ value: "all", label: "Alle gebruikers" }, ...(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name }))]} />
        <Select inline label="Actie" value={f.category} onChange={(category) => set({ category })} options={[{ value: "all", label: "Alle acties" }, ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))]} />
        <SearchField aria-label="Patiëntnummer" placeholder="Patiëntnummer" inputMode="numeric" value={f.patient} onChange={(e) => set({ patient: e.target.value.replace(/\D/g, "") })} className="w-[240px]" />
        <PillButton variant="outline" className="ml-auto" onClick={exportCsv}>Exporteren</PillButton>
      </div>
      <DataTable count={rows.length} label="regels">
        {rows.length === 0 && <p className="py-8 text-sm text-muted-foreground">Geen regels in deze selectie.</p>}
        {rows.map((r) => {
          const d = new Date(r.at), k = dayKey(d);
          const head = k !== lastDay ? (lastDay = k, <h2 key={`h${k}`} className="mb-1 mt-4 text-[15px] font-semibold first-letter:uppercase">{k === today ? `Vandaag, ${dayFmt.format(d)}` : dayFmt.format(d)}</h2>) : null;
          const l = describeAudit(r), who = name(l.actor) ?? (l.text.startsWith("heeft") ? "Systeem" : null);
          return (
            <div key={r.id}>
              {head}
              <div data-list-row className="grid grid-cols-[56px_170px_1fr_auto] items-start gap-4 border-b border-line py-3.5 text-sm">
                <span className="text-muted-foreground">{timeFmt.format(d)}</span>
                <span><span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-xs", r.category === "medical" ? "bg-teal-light text-primary-hover" : "bg-sand")}>{CATEGORY_LABELS[r.category] ?? r.category}</span></span>
                <span>{who ? <><b className="font-semibold">{who}</b> {l.text}</> : l.text}{l.sub && <span className="block text-xs text-muted-foreground">{l.sub}</span>}</span>
                {l.link ? <a href={l.link} className="max-w-[300px] truncate text-[13px] text-primary underline">{l.link}</a> : <span />}
              </div>
            </div>
          );
        })}
      </DataTable>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{count ? `Regel ${page * PAGE + 1} tot ${Math.min(count, page * PAGE + PAGE)} van ${count.toLocaleString("nl-NL")}` : ""}</span>
        <nav aria-label="Pagina's" className="flex items-center gap-1">
          <button type="button" aria-label="Vorige" disabled={page === 0} onClick={() => setPage(page - 1)} className="flex size-9 items-center justify-center rounded-full disabled:opacity-40"><UiIcon name="pijl-links" className="size-4" /></button>
          {pages(page, total).map((n, i) => n === "…" ? <span key={`e${i}`} className="px-2">…</span> : (
            <button key={n} type="button" aria-current={n === page} onClick={() => setPage(n)} className={cn("size-9 rounded-full text-sm", n === page ? "bg-primary text-primary-foreground" : "hover:bg-sand")}>{n + 1}</button>
          ))}
          <button type="button" aria-label="Volgende" disabled={page >= total - 1} onClick={() => setPage(page + 1)} className="flex size-9 items-center justify-center rounded-full bg-sand disabled:opacity-40"><UiIcon name="pijl-rechts" className="size-4" /></button>
        </nav>
      </div>
    </ListPage>
  );
}
