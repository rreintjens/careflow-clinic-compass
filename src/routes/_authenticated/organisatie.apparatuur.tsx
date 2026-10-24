import { ListPage,DataTable,RowChevron } from "@/components/ListPage";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PlusIcon, SearchField, TextField, TextLink, tdCls, thCls } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { deleteEquipment, kindOpts, opts, orgQuery, saveEquipment, saveEquipmentType, saveRoom, type Org, type Room } from "@/data/organisation";
import { addMonths, type Placement } from "@/domain/equipment";
import { brandType, deviceNames, kindOfType, previewName, roomNumber, roomsOf, type Device } from "@/features/organisation/devices";
import { EquipmentKindsModal } from "@/features/organisation/EquipmentKindsModal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/organisatie/apparatuur")({
  head: () => ({ meta: [{ title: "Apparatuur · Beheer · The Body Clinic" }, { name: "description", content: "Apparatuur bij The Body Clinic. Beheer en bekijk de bijbehorende gegevens." }, { property: "og:title", content: "Apparatuur · Beheer · The Body Clinic" }, { property: "og:description", content: "Apparatuur bij The Body Clinic. Beheer en bekijk de bijbehorende gegevens." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(orgQuery),
  component: EquipmentPage,
});

const DAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za"];
const DAYS_LONG = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

type Draft = { device: Device | null; placement?: Placement; locationId?: string; roomId?: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function EquipmentPage() {
  const { data: org } = useSuspenseQuery(orgQuery);
  const names = deviceNames(org);
  const [q, setQ] = useState("");
  const [locFilter, setLocFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [kindsOpen, setKindsOpen] = useState(false);
  const [roomModal, setRoomModal] = useState<{ locationId: string; room: Room | null } | null>(null);

  const ql = q.trim().toLowerCase();
  const matches = (d: Device) =>
    (kindFilter === "all" || kindOfType(org, d.type_id)?.key === kindFilter) &&
    (!ql || (names.get(d.id) ?? "").toLowerCase().includes(ql) || (kindOfType(org, d.type_id)?.name ?? "").toLowerCase().includes(ql));
  const shown = org.equipment.filter(matches);
  const atLocation = (locationId: string) => shown.filter((d) => d.location_id === locationId && d.placement !== "travelling");
  const travelling = shown.filter((d) => d.placement === "travelling");
  const locations = org.locations
    .filter((l) => locFilter === "all" || l.id === locFilter)
    .filter((l) => l.kind === "clinic" || atLocation(l.id).length > 0)
    .sort((a, b) => Number(a.kind === "online") - Number(b.kind === "online") || a.name.localeCompare(b.name, "nl"));

  const statusLabel = (d: Device) => (d.status !== "in_use" ? opts(org, "equipment_status").find((o) => o.value === d.status)?.label ?? "" : "");
  const roomText = (d: Device) => {
    if (d.placement !== "fixed_room" || !d.room_id) return "–";
    const room = org.rooms.find((r) => r.id === d.room_id);
    return room ? `Kamer ${roomNumber(org, room.id) ?? ""} · ${room.name}` : "–";
  };
  const placementText = (d: Device) => (d.placement === "fixed_room" ? "Vast" : d.placement === "movable_location" ? "Verplaatsbaar" : "Reizend");

  return (
    <ListPage>
      <PageHeader
        title="Apparatuur"
        description="Per locatie: welke apparatuur er staat. Een apparaat heeft een soort; de soort bepaalt welke behandelingen ermee kunnen. Namen zijn de soort plus een nummer, je verzint ze niet zelf."
        actions={<div className="flex flex-wrap gap-3"><PillButton variant="outline" onClick={() => setKindsOpen(true)}>Soorten beheren</PillButton><PillButton onClick={() => setDraft({ device: null })}><PlusIcon />Apparaat toevoegen</PillButton></div>}
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <SearchField className="w-[300px]" placeholder="Zoek een apparaat" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Zoek een apparaat" />
        <InlineSelect value={locFilter} onChange={setLocFilter} options={[{ value: "all", label: "Alle locaties" }, ...org.locations.map((l) => ({ value: l.id, label: l.name }))]} />
        <InlineSelect value={kindFilter} onChange={setKindFilter} options={[{ value: "all", label: "Alle soorten" }, ...kindOpts(org)]} />
        <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">{plural(shown.length, "apparaat", "apparaten")}</span>
      </div>

      {locations.map((l) => {
        const rooms = roomsOf(org, l.id);
        const devs = atLocation(l.id);
        return (
          <section key={l.id} className="overflow-hidden rounded-[16px] border border-line">
            <div className="list-group flex items-center gap-3 bg-sand px-4 py-2.5">
              <span className="text-sm font-medium">{l.name}</span>
              <span className="text-xs text-muted-foreground">{l.kind === "online" ? "Online" : plural(rooms.length, "kamer", "kamers")}</span>
              {l.kind === "clinic" && (
                <button type="button" onClick={() => setRoomModal({ locationId: l.id, room: null })} className="ml-auto flex items-center gap-1 text-xs text-primary"><PlusIcon />Kamer</button>
              )}
            </div>
            <DataTable columnLayout="equipment">
              {devs.length ? (
                <table>
                  <thead><tr><th className={thCls}>Apparaat</th><th className={thCls}>Soort</th><th className={thCls}>Kamer</th><th className={thCls}>Vast of verplaatsbaar</th><th className={thCls}>Onderhoud</th><th className={thCls} /></tr></thead>
                  <tbody className="divide-y divide-line">
                    {devs.map((d) => (
                      <tr key={d.id} data-list-row>
                        <td className={tdCls}><div className="whitespace-nowrap text-sm">{names.get(d.id)}</div><div className="whitespace-nowrap text-xs text-muted-foreground">{brandType(org, d.type_id)}{statusLabel(d) ? ` · ${statusLabel(d)}` : ""}</div></td>
                        <td className={tdCls}>{kindOfType(org, d.type_id)?.name}</td>
                        <td className={`${tdCls} whitespace-nowrap`}>{roomText(d)}</td>
                        <td className={`${tdCls} whitespace-nowrap`}>{placementText(d)}</td>
                        <td className={`${tdCls} whitespace-nowrap`}>{d.next_maintenance_on ? fmtDay(d.next_maintenance_on) : "–"}</td>
                        <td className={tdCls}><button type="button" data-row-action onClick={() => setDraft({ device: d })} className="text-primary" aria-label={`${names.get(d.id)} openen`}><RowChevron /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-4 py-6 text-sm text-muted-foreground">Geen apparatuur{ql || kindFilter !== "all" ? " voor dit filter" : ""}.</p>
              )}
            </DataTable>
          </section>
        );
      })}

      {travelling.length > 0 && (
        <section className="overflow-hidden rounded-[16px] border border-line">
          <div className="list-group flex items-center gap-3 bg-sand px-4 py-2.5">
            <span className="text-sm font-medium">Reist tussen locaties</span>
            <span className="text-xs text-muted-foreground">{plural(travelling.length, "apparaat", "apparaten")} · het weekschema bepaalt waar een behandeling boekbaar is</span>
            <button type="button" onClick={() => setDraft({ device: null, placement: "travelling" })} className="ml-auto flex items-center gap-1 text-xs text-primary"><PlusIcon />Reizend apparaat</button>
          </div>
          <DataTable>
            <table>
              <thead><tr><th className={thCls}>Apparaat</th><th className={thCls}>Soort</th>{DAYS.map((d) => <th key={d} className={thCls}>{d}</th>)}<th className={thCls}>Onderhoud</th><th className={thCls} /></tr></thead>
              <tbody className="divide-y divide-line">
                {travelling.map((d) => (
                  <tr key={d.id} data-list-row>
                    <td className={tdCls}><div className="whitespace-nowrap text-sm">{names.get(d.id)}</div><div className="whitespace-nowrap text-xs text-muted-foreground">{brandType(org, d.type_id)}{statusLabel(d) ? ` · ${statusLabel(d)}` : ""}</div></td>
                    <td className={tdCls}>{kindOfType(org, d.type_id)?.name}</td>
                    {DAYS.map((_, i) => {
                      const s = org.dayLocations.find((x) => x.equipment_id === d.id && x.weekday === i + 1);
                      return <td key={i} className={`${tdCls} whitespace-nowrap`}>{s?.location_id ? org.locations.find((x) => x.id === s.location_id)?.name ?? "–" : "–"}</td>;
                    })}
                    <td className={`${tdCls} whitespace-nowrap`}>{d.next_maintenance_on ? fmtDay(d.next_maintenance_on) : "–"}</td>
                    <td className={tdCls}><button type="button" data-row-action onClick={() => setDraft({ device: d })} className="text-primary" aria-label={`${names.get(d.id)} openen`}><RowChevron /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        </section>
      )}

      {kindsOpen && <EquipmentKindsModal org={org} onClose={() => setKindsOpen(false)} />}
      {draft && <DeviceModal org={org} draft={draft} onClose={() => setDraft(null)} />}
      {roomModal && <RoomModal org={org} {...roomModal} onClose={() => setRoomModal(null)} />}
    </ListPage>
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
  const [kindsOpen, setKindsOpen] = useState(false);

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
          <Select label="Soort" value={kindId} onChange={(v) => { if (v === "__new") { setKindsOpen(true); return; } setKindId(v); setTypeId(firstType(v)); }} options={[...org.equipmentKinds.map((k) => ({ value: k.id, label: k.name })), { value: "__new", label: "Nieuwe soort…" }]} help="De soort bepaalt welke behandelingen ermee kunnen; nieuwe soorten maak je bij Behandelingen." />
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
      {kindsOpen && <EquipmentKindsModal org={org} onClose={() => setKindsOpen(false)} onCreated={(id) => { setKindId(id); setTypeId(firstType(id)); setKindsOpen(false); }} />}
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
    <Modal open onOpenChange={(o) => !o && onClose()} title={room ? `Kamer ${roomNumber(org, room.id)} wijzigen` : "Kamer toevoegen"} description={org.locations.find((l) => l.id === locationId)?.name ?? ""}
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></>}>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Naam" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Waarvoor" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      </div>
    </Modal>
  );
}
