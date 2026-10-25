import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { CustomIconsProvider, MenuIcon } from "@/components/MenuIcon";
import { orgQuery, uploadCustomIcon } from "@/data/organisation";
import { IconPicker } from "@/features/organisation/IconPicker";
import { addHoliday, parseOptions, settingsQuery, updateSettings } from "@/data/settings";
import { currentTenantQuery, saveTenant } from "@/data/tenant";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/instellingen/algemeen")({
  head: () => ({ meta: [{ title: "Algemeen · Instellingen · The Body Clinic" }, { name: "description", content: "Algemeen bij The Body Clinic. Beheer en bekijk de bijbehorende gegevens." }, { property: "og:title", content: "Algemeen · Instellingen · The Body Clinic" }, { property: "og:description", content: "Algemeen bij The Body Clinic. Beheer en bekijk de bijbehorende gegevens." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  component: SettingsPage,
});

const enc = (v: Json) => JSON.stringify(v);
const inputCls = "h-12 w-full rounded-[14px] bg-sand px-4 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring";
const APPLIES_TO = [{ value: "all", label: "Alle locaties" }];
const dateFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function formatDates(dates: string[]): string {
  const ds = dates.map((d) => new Date(`${d}T00:00:00Z`));
  if (ds.length === 1) return dateFmt.format(ds[0]);
  const last = dateFmt.format(ds[ds.length - 1]);
  const firstDays = ds.slice(0, -1).map((d) => d.getUTCDate()).join(", ");
  return `${firstDays} en ${last}`;
}

function SettingsPage() {
  const { data } = useSuspenseQuery(settingsQuery);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [holidayOpen, setHolidayOpen] = useState(false);

  const current = (key: string, value: Json) => draft[key] ?? enc(value);
  const changes = useMemo(
    () => data.settings.filter((s) => draft[s.key] !== undefined && draft[s.key] !== enc(s.value)).map((s) => ({ key: s.key, value: JSON.parse(draft[s.key] ?? "null") as Json })),
    [data.settings, draft],
  );

  const save = useMutation({
    mutationFn: () => updateSettings(changes),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: settingsQuery.queryKey });
      setDraft({});
      toast.success("Opgeslagen");
    },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Algemeen"
        description="Regels die voor het hele systeem gelden. Alles wat hier staat, mag de bouw nooit hardcoderen."
        actions={<PillButton onClick={() => save.mutate()} disabled={changes.length === 0 || save.isPending}>Opslaan</PillButton>}
      />
      <TenantCard />
      {data.sections.map((sec) => {
        const items = data.settings.filter((s) => s.section === sec.key);
        return (
          <Card key={sec.key} title={sec.title} description={sec.description}>
            {sec.key === "holidays" ? (
              <HolidayTable rows={data.holidays} onAdd={() => setHolidayOpen(true)} />
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                {items.map((s) =>
                  s.input_type === "icon" ? (
                    <SettingIcon key={s.key} label={s.label} help={s.help} value={JSON.parse(current(s.key, s.value)) as string} onChange={(v) => setDraft((d) => ({ ...d, [s.key]: JSON.stringify(v) }))} />
                  ) : s.input_type === "select" ? (
                    <Select
                      key={s.key}
                      label={s.label}
                      help={s.help}
                      value={current(s.key, s.value)}
                      onChange={(v) => setDraft((d) => ({ ...d, [s.key]: v }))}
                      options={parseOptions(s.options).map((o) => ({ value: enc(o.value), label: o.label }))}
                    />
                  ) : (
                    <div key={s.key} className="flex min-w-0 flex-col gap-2">
                      <label htmlFor={`s-${s.key}`} className="text-[13px] font-medium">{s.label}</label>
                      <input
                        id={`s-${s.key}`}
                        type={s.input_type}
                        className={inputCls}
                        value={JSON.parse(current(s.key, s.value)) as string}
                        onChange={(e) => setDraft((d) => ({ ...d, [s.key]: JSON.stringify(e.target.value) }))}
                      />
                      {s.help && <span className="text-xs text-muted-foreground">{s.help}</span>}
                    </div>
                  ),
                )}
              </div>
            )}
          </Card>
        );
      })}
      <HolidayModal open={holidayOpen} onOpenChange={setHolidayOpen} />
    </div>
  );
}

/** An icon setting: opens the shared icon picker; the setting stores only the icon key. */
function SettingIcon({ label, help, value, onChange }: { label: string; help: string | null; value: string; onChange: (v: string) => void }) {
  const qc = useQueryClient();
  const org = useQuery(orgQuery);
  const [open, setOpen] = useState(false);
  return (
    <CustomIconsProvider icons={org.data?.customIcons ?? []}>
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-[13px] font-medium">{label}</span>
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-[14px] bg-sand"><MenuIcon icon={value} /></span>
          <PillButton variant="outline" onClick={() => setOpen(true)}>Icoon kiezen</PillButton>
        </div>
        {help && <span className="text-xs text-muted-foreground">{help}</span>}
        {open && <IconPicker value={value} fallback={value} custom={org.data?.customIcons ?? []}
          onUpload={async (f) => { const k = await uploadCustomIcon(f); await qc.invalidateQueries({ queryKey: orgQuery.queryKey }); return k; }}
          onPick={(v) => { if (v) onChange(v); setOpen(false); }} onClose={() => setOpen(false)} />}
      </div>
    </CustomIconsProvider>
  );
}

/** The active tenant's own details; editable for group admins, read-only for everyone else. */
function TenantCard() {
  const { data: tenant } = useSuspenseQuery(currentTenantQuery);
  const qc = useQueryClient();
  const [name, setName] = useState(tenant.display_name);
  const [country, setCountry] = useState(tenant.country);
  const [tz, setTz] = useState(tenant.time_zone);
  const [domains, setDomains] = useState(tenant.booking_domains.join(", "));
  const [testMode, setTestMode] = useState(tenant.test_mode ? "1" : "0");
  const dirty = name !== tenant.display_name || country !== tenant.country || tz !== tenant.time_zone
    || domains !== tenant.booking_domains.join(", ") || testMode !== (tenant.test_mode ? "1" : "0");
  const save = useMutation({
    mutationFn: () => saveTenant(tenant.id, {
      display_name: name.trim(), country, time_zone: tz,
      booking_domains: domains.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean),
      test_mode: testMode === "1",
    }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: currentTenantQuery.queryKey }); toast.success("Opgeslagen"); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const ro = !tenant.canEdit;
  return (
    <Card title="Merk" description={`Gegevens van deze omgeving (${tenant.slug}). Alleen een groepsbeheerder kan ze aanpassen.`}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="t-name" className="text-[13px] font-medium">Naam</label>
          <input id="t-name" type="text" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} readOnly={ro} maxLength={80} />
        </div>
        <Select label="Land" value={country} onChange={setCountry} disabled={ro} options={[{ value: "NL", label: "Nederland" }, { value: "DE", label: "Duitsland" }]} />
        <Select label="Tijdzone" value={tz} onChange={setTz} disabled={ro} options={[{ value: "Europe/Amsterdam", label: "Amsterdam" }, { value: "Europe/Berlin", label: "Berlijn" }]} />
        <Select label="Testmodus" value={testMode} onChange={setTestMode} disabled={ro} help="In testmodus werkt ?merk= in het webadres en gaan mails niet echt weg." options={[{ value: "1", label: "Aan" }, { value: "0", label: "Uit" }]} />
        <div className="col-span-2 flex min-w-0 flex-col gap-2">
          <label htmlFor="t-domains" className="text-[13px] font-medium">Boekingsdomeinen</label>
          <input id="t-domains" type="text" className={inputCls} value={domains} onChange={(e) => setDomains(e.target.value)} readOnly={ro} placeholder="bijv. bodyclinic.nl, www.bodyclinic.nl" />
          <span className="text-xs text-muted-foreground">Met komma's ertussen. De boekingspagina herkent het merk aan deze domeinen.</span>
        </div>
      </div>
      {tenant.canEdit && (
        <div className="mt-5 flex justify-end">
          <PillButton onClick={() => save.mutate()} disabled={!dirty || !name.trim() || save.isPending}>Merk opslaan</PillButton>
        </div>
      )}
    </Card>
  );
}

function HolidayTable({ rows, onAdd }: { rows: Array<{ id: string; name: string; dates: string[]; applies_to: string }>; onAdd: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted-foreground">
            <th className="px-2.5 py-2 font-normal">Dag</th>
            <th className="px-2.5 py-2 font-normal">Datum</th>
            <th className="px-2.5 py-2 font-normal">Geldt voor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line">
              <td className="px-2.5 py-3">{r.name}</td>
              <td className="px-2.5 py-3">{formatDates(r.dates)}</td>
              <td className="px-2.5 py-3">{APPLIES_TO.find((a) => a.value === r.applies_to)?.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <PillButton variant="outline" onClick={onAdd}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Dag toevoegen
        </PillButton>
      </div>
    </div>
  );
}

function HolidayModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applies, setApplies] = useState("all");

  const add = useMutation({
    mutationFn: () => {
      const dates: string[] = [];
      const end = to || from;
      for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${end}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
        dates.push(d.toISOString().slice(0, 10));
      }
      return addHoliday({ name: name.trim(), dates, applies_to: applies });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: settingsQuery.queryKey });
      onOpenChange(false);
      setName("");
      setFrom("");
      setTo("");
    },
    onError: () => toast.error("Toevoegen is niet gelukt"),
  });
  const valid = name.trim().length > 0 && from !== "" && (to === "" || to >= from);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Dag toevoegen"
      footer={
        <>
          <PillButton variant="ghost" onClick={() => onOpenChange(false)}>Annuleren</PillButton>
          <PillButton onClick={() => add.mutate()} disabled={!valid || add.isPending}>Opslaan</PillButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="h-name" className="text-[13px] font-medium">Dag</label>
          <input id="h-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="h-from" className="text-[13px] font-medium">Datum</label>
            <input id="h-from" type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="h-to" className="text-[13px] font-medium">Tot en met</label>
            <input id="h-to" type="date" className={inputCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <Select label="Geldt voor" options={APPLIES_TO} value={applies} onChange={setApplies} />
      </div>
    </Modal>
  );
}
