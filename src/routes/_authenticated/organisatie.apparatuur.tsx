import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PlusIcon, SearchField, Tag, TextField, TextLink, thCls } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { deleteEquipment, kindOpts, locName, opts, orgQuery, saveEquipment, saveEquipmentType, saveRoom, type Org, type Room } from "@/data/organisation";
import { addMonths, type Placement } from "@/domain/equipment";
import { brandType, deviceNames, kindOfType, previewName, roomNumber, roomsOf, type Device } from "@/features/organisation/devices";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/organisatie/apparatuur")({
  head: () => ({ meta: [{ title: "Apparatuur · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(orgQuery),
  component: EquipmentPage,
});

const DAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za"];
const DAYS_LONG = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

function BuildingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" />
    </svg>
  );
}
function DeviceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </svg>
  );
}
function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn("text-primary transition-transform", open && "rotate-180")}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
const IconBox = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn("inline-flex shrink-0 items-center justify-center rounded-[10px] bg-background text-primary", className)}>{children}</span>
);

type Draft = { device: Device | null; placement?: Placement; locationId?: string; roomId?: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function EquipmentPage() {
  const { data: org } = useSuspenseQuery(orgQuery);
  const names = deviceNames(org);
  const [q, setQ] = useState("");
  const [locFilter, setLocFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const firstClinic = org.locations.find((l) => l.name === "Amsterdam-Zuid")?.id ?? org.locations.find((l) => l.kind === "clinic")?.id ?? "";
  const [open, setOpen] = useState<Set<string>>(new Set([firstClinic]));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [roomModal, setRoomModal] = useState<{ locationId: string; room: Room | null } | null>(null);

  const ql = q.trim().toLowerCase();
  const matches = (d: Device) =>
    (kindFilter === "all" || kindOfType(org, d.type_id)?.key === kindFilter) &&
    (!ql || (names.get(d.id) ?? "").toLowerCase().includes(ql) || (kindOfType(org, d.type_id)?.name ?? "").toLowerCase().includes(ql));
  const roomMatches = (r: Room) => !ql || r.name.toLowerCase().includes(ql) || r.purpose.toLowerCase().includes(ql);
  const filtering = !!ql || kindFilter !== "all";

  const located = org.equipment.filter((d) => d.placement !== "travelling");
  const travelling = org.equipment.filter((d) => d.placement === "travelling" && matches(d));
  const locations = org.locations.filter((l) => locFilter === "all" || l.id === locFilter).sort((a, b) => Number(a.kind === "online") - Number(b.kind === "online"));
  const clinicCount = org.locations.filter((l) => l.kind === "clinic").length;
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const row = (d: Device, compact = false) => {
    const kind = kindOfType(org, d.type_id);
    return (
      <div key={d.id} className="flex items-center gap-3 rounded-[12px] bg-sand px-3 py-2.5">
        <IconBox className="h-8 w-8"><DeviceIcon /></IconBox>
        <div className="min-w-0 flex-1">
          <div className="truncate whitespace-nowrap text-[13px]">{brandType(org, d.type_id)}</div>
          <div className="truncate whitespace-nowrap text-[11px] text-muted-foreground">{kind?.name}{d.status !== "in_use" ? ` · ${opts(org, "equipment_status").find((o) => o.value === d.status)?.label ?? ""}` : ""}</div>
        </div>
        {d.placement === "fixed_room" ? <span className="whitespace-nowrap text-xs">Vast</span> : <Tag>Verplaatsbaar</Tag>}
        <TextLink onClick={() => setDraft({ device: d })}>Wijzig</TextLink>
        {compact && null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Apparatuur"
        description="Per locatie: de kamers met wat erin staat. Een apparaat heeft een soort; de soort bepaalt welke behandelingen in die kamer kunnen. Namen zijn de soort plus een nummer, je verzint ze niet zelf."
        actions={<PillButton size="lg" onClick={() => setDraft({ device: null })}><PlusIcon />Apparaat toevoegen</PillButton>}
      />
      <div className="flex items-center gap-3">
        <SearchField className="w-[300px]" placeholder="Zoek een apparaat of kamer" value={q} onChange={(e) => setQ(e.target.value)} />
        <InlineSelect value={locFilter} onChange={setLocFilter} options={[{ value: "all", label: "Alle locaties" }, ...org.locations.map((l) => ({ value: l.id, label: l.name }))]} />
        <InlineSelect value={kindFilter} onChange={setKindFilter} options={[{ value: "all", label: "Alle soorten" }, ...kindOpts(org)]} />
        <span className="ml-auto whitespace-nowrap text-[13px] text-muted-foreground">
          {plural(clinicCount, "locatie", "locaties")} · {plural(org.rooms.length, "kamer", "kamers")} · {plural(org.equipment.length, "apparaat", "apparaten")}
        </span>
      </div>

      {locations.map((l) => {
        const rooms = roomsOf(org, l.id);
        const here = located.filter((d) => d.location_id === l.id);
        const isOpen = open.has(l.id) || (filtering && here.some(matches));
        const summary = l.kind === "online" ? "Geen kamers; Google Meet" : `${plural(rooms.length, "kamer", "kamers")} · ${plural(here.length, "apparaat", "apparaten")}`;
        if (!isOpen)
          return (
            <button key={l.id} type="button" onClick={() => toggle(l.id)} className="flex items-center justify-between rounded-[18px] border border-line bg-background px-6 py-4 text-left">
              <span className="whitespace-nowrap text-[15px] font-semibold">{l.name}</span>
              <span className="flex items-center gap-4 whitespace-nowrap text-[13px] text-muted-foreground">{summary}<Chevron open={false} /></span>
            </button>
          );
        const movable = here.filter((d) => d.placement === "movable_location" && matches(d));
        return (
          <section key={l.id} className="rounded-[20px] border border-line bg-background p-6">
            <div className="flex items-center gap-4">
              <IconBox className="h-11 w-11 bg-sand"><BuildingIcon /></IconBox>
              <div className="min-w-0 flex-1">
                <div className="whitespace-nowrap text-[17px] font-semibold">{l.name}</div>
                <div className="whitespace-nowrap text-[13px] text-muted-foreground">{l.kind === "online" ? summary : `${l.address ?? ""} · ${summary}`}</div>
              </div>
              {l.kind === "clinic" && (
                <>
                  <PillButton variant="outline" onClick={() => setRoomModal({ locationId: l.id, room: null })}><PlusIcon />Kamer toevoegen</PillButton>
                  <PillButton variant="outline" onClick={() => setDraft({ device: null, locationId: l.id })}><PlusIcon />Apparaat toevoegen</PillButton>
                </>
              )}
              <button type="button" aria-label="Inklappen" onClick={() => toggle(l.id)} className="p-2"><Chevron open /></button>
            </div>
            {l.kind === "clinic" && (
              <>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {rooms.filter((r) => roomMatches(r) || here.some((d) => d.room_id === r.id && matches(d)) || !filtering).map((r, i) => {
                    const devs = here.filter((d) => d.placement === "fixed_room" && d.room_id === r.id && (matches(d) || !filtering));
                    return (
                      <div key={r.id} className={cn("rounded-[16px] border border-line p-4", devs.length > 2 && "col-span-3")}>
                        <div className="flex items-start gap-3">
                          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setRoomModal({ locationId: l.id, room: r })}>
                            <div className="truncate whitespace-nowrap text-sm font-semibold">Kamer {(roomNumber(org, r.id) ?? i + 1)} · {r.name}</div>
                            <div className="truncate whitespace-nowrap text-xs text-muted-foreground">{r.purpose}</div>
                          </button>
                          <button type="button" aria-label="Apparaat in deze kamer toevoegen" onClick={() => setDraft({ device: null, placement: "fixed_room", locationId: l.id, roomId: r.id })} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-primary text-primary"><PlusIcon /></button>
                        </div>
                        <div className="mt-3 flex flex-col gap-2">
                          {devs.length ? devs.map((d) => row(d)) : <p className="text-xs text-muted-foreground">Geen apparatuur; alleen consulten en injectables</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {movable.length > 0 && (
                  <div className="mt-5">
                    <div className="mb-2 text-[13px]">Verplaatsbaar binnen {l.name}</div>
                    <div className="grid grid-cols-2 gap-3">{movable.map((d) => row(d))}</div>
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}

      <section className="rounded-[20px] border border-line bg-sand p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-semibold">Reist tussen locaties</h2>
            <p className="text-[13px] text-muted-foreground">Apparatuur die per dag op een andere locatie staat. Het weekschema bepaalt waar een behandeling boekbaar is.</p>
          </div>
          <PillButton variant="outline" onClick={() => setDraft({ device: null, placement: "travelling" })}><PlusIcon />Reizend apparaat toevoegen</PillButton>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-line"><th className={thCls}>Apparaat</th>{DAYS.map((d) => <th key={d} className={thCls}>{d}</th>)}<th className={thCls} /></tr></thead>
            <tbody className="divide-y divide-line">
              {travelling.map((d) => (
                <tr key={d.id}>
                  <td className="px-2.5 py-3">
                    <div className="flex items-center gap-3">
                      <IconBox className="h-8 w-8"><DeviceIcon /></IconBox>
                      <div><div className="whitespace-nowrap text-sm font-semibold">{names.get(d.id)}</div><div className="whitespace-nowrap text-xs text-muted-foreground">{kindOfType(org, d.type_id)?.name}</div></div>
                    </div>
                  </td>
                  {DAYS.map((_, i) => {
                    const s = org.dayLocations.find((x) => x.equipment_id === d.id && x.weekday === i + 1);
                    return <td key={i} className="whitespace-nowrap px-2.5 py-3 text-sm">{s?.location_id ? locName(org, s.location_id) : "–"}</td>;
                  })}
                  <td className="px-2.5 py-3"><TextLink onClick={() => setDraft({ device: d })}>Wijzig</TextLink></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {draft && <DeviceModal org={org} draft={draft} onClose={() => setDraft(null)} />}
      {roomModal && <RoomModal org={org} {...roomModal} onClose={() => setRoomModal(null)} />}
    </div>
  );
}

/** Filter select without a visible label (label kept for screen readers). */
function InlineSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return <Select label="" value={value} onChange={onChange} options={options} className="w-auto min-w-[150px] [&>label]:sr-only" />;
}

const PLACEMENTS: Array<{ value: Placement; title: string; help: string }> = [
  { value: "fixed_room", title: "Vast in een kamer", help: "Altijd in dezelfde kamer; de kamer is dan boekbaar voor deze soort." },
  { value: "movable_location", title: "Verplaatsbaar binnen een locatie", help: "Wisselt tussen kamers; de locatie is boekbaar, de kamer wordt bij de afspraak gekozen." },
  { value: "travelling", title: "Reist tussen locaties", help: "Per dag op een andere locatie; je vult een weekschema in." },
];

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function DeviceModal({ org, draft, onClose }: { org: Org; draft: Draft; onClose: () => void }) {
  const qc = useQueryClient();
  const d = draft.device;
  const initialType = org.equipmentTypes.find((t) => t.id === d?.type_id);
  const [kindId, setKindId] = useState(initialType?.kind_id ?? org.equipmentKinds[0]?.id ?? "");
  const firstType = (k: string) => org.equipmentTypes.find((t) => t.kind_id === k)?.id ?? "";
  const [typeId, setTypeId] = useState(initialType?.id ?? firstType(initialType?.kind_id ?? org.equipmentKinds[0]?.id ?? ""));
  const [placement, setPlacement] = useState<Placement>((d?.placement as Placement) ?? draft.placement ?? "fixed_room");
  const clinics = org.locations.filter((l) => l.kind === "clinic");
  const [loc, setLoc] = useState(d?.location_id ?? draft.locationId ?? clinics[0]?.id ?? "");
  const [room, setRoom] = useState(d?.room_id ?? draft.roomId ?? roomsOf(org, d?.location_id ?? draft.locationId ?? clinics[0]?.id ?? "")[0]?.id ?? "");
  const [status, setStatus] = useState(d?.status ?? "in_use");
  const today = new Date().toISOString().slice(0, 10);
  const maintOptions = [
    { value: "none", label: "Geen onderhoud" },
    ...opts(org, "maintenance_interval").map((o) => {
      const next = d?.maintenance_interval_months === Number(o.value) && d.next_maintenance_on ? d.next_maintenance_on : addMonths(today, Number(o.value));
      return { value: `${o.value}|${next}`, label: `${o.label}, volgende ${fmtDate(next)}` };
    }),
  ];
  const [maint, setMaint] = useState(d?.maintenance_interval_months && d.next_maintenance_on ? `${d.maintenance_interval_months}|${d.next_maintenance_on}` : "none");
  const [schedule, setSchedule] = useState(DAYS.map((_, i) => org.dayLocations.find((s) => s.equipment_id === d?.id && s.weekday === i + 1)?.location_id ?? "none"));
  const [newType, setNewType] = useState(false);

  const types = org.equipmentTypes.filter((t) => t.kind_id === kindId);
  const rooms = roomsOf(org, loc);
  const kind = org.equipmentKinds.find((k) => k.id === kindId);
  const valid = !!typeId && (placement === "travelling" || !!loc) && (placement !== "fixed_room" || !!room);
  const draftRow = { id: d?.id ?? null, type_id: typeId, placement, location_id: placement === "travelling" ? null : loc, room_id: placement === "fixed_room" ? room : null };
  const name = valid ? previewName(org, draftRow) : "";

  const refresh = () => qc.invalidateQueries({ queryKey: orgQuery.queryKey });
  const save = useMutation({
    mutationFn: () => {
      const [mi, next] = maint === "none" ? [null, null] : maint.split("|");
      return saveEquipment(
        d?.id ?? null,
        { type_id: draftRow.type_id, placement, location_id: draftRow.location_id, room_id: draftRow.room_id, status, maintenance_interval_months: mi ? Number(mi) : null, next_maintenance_on: next ?? null },
        { name, kind: kind?.key ?? "" },
        schedule.map((s, i) => ({ weekday: i + 1, location_id: s === "none" ? null : s })),
      );
    },
    onSuccess: async () => { await refresh(); toast.success(d ? "Opgeslagen" : "Apparaat toegevoegd"); onClose(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const del = useMutation({
    mutationFn: () => deleteEquipment(d?.id ?? ""),
    onSuccess: async () => { await refresh(); toast.success("Apparaat verwijderd"); onClose(); },
    onError: () => toast.error("Verwijderen is niet gelukt"),
  });

  return (
    <>
      <Modal open onOpenChange={(o) => !o && onClose()} width="lg" title={d ? "Apparaat wijzigen" : "Apparaat toevoegen"} description="Kies eerst de soort, dan waar het staat"
        footer={
          <div className="flex w-full items-center justify-between">
            {d ? <TextLink tone="warning" onClick={() => del.mutate()}>Apparaat verwijderen</TextLink> : <span />}
            <div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!valid || save.isPending} onClick={() => save.mutate()}>{d ? "Opslaan" : "Toevoegen"}</PillButton></div>
          </div>
        }>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Soort" value={kindId} onChange={(v) => { setKindId(v); setTypeId(firstType(v)); }} options={org.equipmentKinds.map((k) => ({ value: k.id, label: k.name }))} help="De soort bepaalt welke behandelingen ermee kunnen; nieuwe soorten maak je bij Behandelingen." />
          <Select label="Merk en type" value={typeId} onChange={(v) => (v === "__new" ? setNewType(true) : setTypeId(v))} options={[...types.map((t) => ({ value: t.id, label: `${t.brand} ${t.type}`.trim() })), { value: "__new", label: "Nieuw type" }]} help="Keuzelijst van bekende typen, of nieuw type." />
        </div>
        <div className="mt-5 text-[13px] font-medium">Waar staat het?</div>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {PLACEMENTS.map((p) => (
            <button key={p.value} type="button" onClick={() => setPlacement(p.value)}
              className={cn("rounded-[14px] border p-4 text-left", placement === p.value ? "border-primary bg-teal-light" : "border-line bg-background")}>
              <div className="text-sm">{p.title}</div>
              <div className="mt-1 text-xs leading-[1.5] text-muted-foreground">{p.help}</div>
            </button>
          ))}
        </div>
        {placement !== "travelling" ? (
          <div className="mt-5 grid grid-cols-2 gap-4">
            <Select label="Locatie" value={loc} onChange={(v) => { setLoc(v); setRoom(roomsOf(org, v)[0]?.id ?? ""); }} options={clinics.map((l) => ({ value: l.id, label: l.name }))} />
            {placement === "fixed_room" && (
              <Select label="Kamer" value={room} onChange={setRoom} options={rooms.map((r, i) => ({ value: r.id, label: `Kamer ${i + 1} · ${r.name}` }))} help="Alleen kamers van de gekozen locatie." />
            )}
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-4">
            {DAYS_LONG.map((day, i) => (
              <Select key={day} label={day} value={schedule[i] ?? "none"} onChange={(v) => setSchedule(schedule.map((x, j) => (j === i ? v : x)))} options={[{ value: "none", label: "Geen" }, ...clinics.map((l) => ({ value: l.id, label: l.name }))]} />
            ))}
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-4">
          <Select label="Status" value={status} onChange={setStatus} options={opts(org, "equipment_status")} />
          <Select label="Onderhoud" value={maint} onChange={setMaint} options={maintOptions} help="Bij onderhoud is de kamer die dag niet boekbaar voor deze soort." />
        </div>
        {name && (
          <div className="mt-5 flex items-start gap-3 rounded-[14px] bg-teal-light px-4 py-3 text-[13px] leading-[1.6]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-primary"><path d="M5 12l5 5 9-10" /></svg>
            <span>Naam wordt automatisch <strong className="font-semibold">{name}</strong>. Staat er al een van deze soort, dan komt er een nummer achter.</span>
          </div>
        )}
      </Modal>
      {newType && kind && <NewTypeModal kindId={kind.id} kindName={kind.name} onClose={() => setNewType(false)} onSaved={async (id) => { await refresh(); setTypeId(id); setNewType(false); }} />}
    </>
  );
}

function NewTypeModal({ kindId, kindName, onClose, onSaved }: { kindId: string; kindName: string; onClose: () => void; onSaved: (id: string) => Promise<void> }) {
  const [brand, setBrand] = useState("");
  const [type, setType] = useState("");
  const save = useMutation({
    mutationFn: () => saveEquipmentType({ kind_id: kindId, brand: brand.trim(), type: type.trim() }),
    onSuccess: (id) => onSaved(id),
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Nieuw type" description={`Voor de soort ${kindName}`}
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!brand.trim() || !type.trim() || save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></>}>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Merk" value={brand} onChange={(e) => setBrand(e.target.value)} />
        <TextField label="Type" value={type} onChange={(e) => setType(e.target.value)} />
      </div>
    </Modal>
  );
}

function RoomModal({ org, locationId, room, onClose }: { org: Org; locationId: string; room: Room | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(room?.name ?? "");
  const [purpose, setPurpose] = useState(room?.purpose ?? "");
  const count = roomsOf(org, locationId).length;
  const save = useMutation({
    mutationFn: () => saveRoom(room?.id ?? null, { location_id: locationId, name: name.trim(), purpose: purpose.trim(), sort: count }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: orgQuery.queryKey }); toast.success("Opgeslagen"); onClose(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={room ? `Kamer ${roomNumber(org, room.id)} wijzigen` : "Kamer toevoegen"} description={locName(org, locationId)}
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></>}>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Naam" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Waarvoor" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      </div>
    </Modal>
  );
}
