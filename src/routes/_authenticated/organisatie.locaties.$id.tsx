import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/Card";
import { Checkbox, PlusIcon, SearchField, StatusMark, Tag, TextField, TextLink, Toggle, tdCls, thCls } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import {
  addLocationException, deleteRoom, fullName, optLabel, opts, orgQuery, saveHours, saveLocation, saveRoom, workLocationIds, type Org, type Room, kindName, kindOpts,
} from "@/data/organisation";
import { hhmm, quarterTimes } from "@/domain/organisation";
import { REASON_TEXT, treatmentBookability } from "@/features/organisation/bookability";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/organisatie/locaties/$id")({
  head: () => ({ meta: [{ title: "Locatie · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  loader: async ({ context, params }) => {
    const org = await context.queryClient.ensureQueryData(orgQuery);
    if (!org.locations.some((l) => l.id === params.id)) throw notFound();
  },
  component: LocationPage,
});

const DAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

function LocationPage() {
  const { id } = Route.useParams();
  const { data: org } = useSuspenseQuery(orgQuery);
  const l = org.locations.find((x) => x.id === id);
  if (!l) return null;
  return <LocationForm key={`${l.id}-${l.updated_at}`} org={org} />;
}

function LocationForm({ org }: { org: Org }) {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: orgQuery.queryKey });
  const l = org.locations.find((x) => x.id === id);
  if (!l) throw new Error("location missing");
  const online = l.kind === "online";
  const [name, setName] = useState(l.name);
  const [address, setAddress] = useState(l.address ?? "");
  const [pc, setPc] = useState(l.postal_city ?? "");
  const [status, setStatus] = useState(l.status);
  const [maps, setMaps] = useState(l.maps_url ?? "");
  const [phone, setPhone] = useState(l.phone ?? "");
  const [isNew, setIsNew] = useState(l.show_new_label);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [excOpen, setExcOpen] = useState(false);
  const [roomModal, setRoomModal] = useState<Room | "new" | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const save = useMutation({
    mutationFn: () => saveLocation(id, { name: name.trim(), address: address.trim() || null, postal_city: pc.trim() || null, status, maps_url: maps.trim() || null, phone: phone.trim() || null, show_new_label: isNew }),
    onSuccess: async () => { await refresh(); toast.success("Opgeslagen"); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });

  const hours = org.hours.filter((h) => h.location_id === id);
  const rooms = org.rooms.filter((r) => r.location_id === id);
  const here = org.treatmentLocations.filter((tl) => tl.location_id === id).map((tl) => {
    const t = org.treatments.find((x) => x.id === tl.treatment_id);
    const b = treatmentBookability(org, tl.treatment_id).perLocation.find((p) => p.locationId === id);
    const docs = org.practitionerTreatments.filter((pt) => pt.treatment_id === tl.treatment_id && workLocationIds(org, pt.practitioner_id).includes(id) && !pt.excluded_location_ids.includes(id));
    return { t, reason: b?.reason ?? "no_practitioner", docs };
  }).filter((r) => r.t).sort((a, b) => (a.t?.name_nl ?? "").localeCompare(b.t?.name_nl ?? ""));
  const okCount = here.filter((h) => h.reason === "ok").length;

  const roomFeatures = (r: Room) => org.equipment.filter((e) => e.placement === "fixed_room" && e.room_id === r.id);
  const suitedFor = (r: Room) => {
    const kinds = roomFeatures(r).map((e) => e.kind);
    if (!kinds.length) return "Alles zonder speciale apparatuur";
    const ts = org.treatmentLocations.filter((tl) => tl.location_id === id).map((tl) => tl.treatment_id)
      .filter((tid) => org.requirements.some((q) => q.treatment_id === tid && q.kind === "equipment" && kinds.includes(q.equipment_kind ?? "")))
      .map((tid) => org.treatments.find((t) => t.id === tid)?.name_nl).filter(Boolean);
    return `${ts.length ? ts.join(", ") : kindName(org, kinds[0])}, en de rest als die vrij is`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link to="/organisatie/locaties" className="text-sm text-primary hover:text-primary-hover">Locaties</Link>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-[28px] font-semibold tracking-tight">{l.name}</h1>
            <Tag>{online ? "Online" : "Kliniek"}</Tag>
            <Tag tone="sand">{online ? "Vast" : l.status === "open" ? "Open" : "Gesloten"}</Tag>
          </div>
          <PillButton size="lg" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Gegevens">
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Naam" value={name} onChange={(e) => setName(e.target.value)} disabled={online} />
              <TextField label="Adres" value={address} onChange={(e) => setAddress(e.target.value)} disabled={online} />
              {!online && <TextField label="Postcode en plaats" value={pc} onChange={(e) => setPc(e.target.value)} />}
              {!online && <Select label="Status" value={status} onChange={setStatus} options={opts(org, "location_status")} />}
              {!online && <TextField label="Google Maps-link" value={maps} onChange={(e) => setMaps(e.target.value)} help="Komt als knop “Locatie op Google Maps” in de bevestiging en de herinnering." />}
              {!online && <TextField label="Telefoonnummer voor patiënten" value={phone} onChange={(e) => setPhone(e.target.value)} />}
            </div>
            {!online && (
              <div className="mt-5 flex items-center justify-between gap-4 rounded-[14px] bg-sand px-4 py-3">
                <div>
                  <div className="text-sm">Toon het label “Nieuw” bij deze locatie</div>
                  <div className="text-xs text-muted-foreground">De patiënt ziet “Nieuw” naast de naam in de locatielijst. Zet uit als de locatie is ingeburgerd.</div>
                </div>
                <Toggle checked={isNew} onChange={setIsNew} label="Toon het label Nieuw" />
              </div>
            )}
          </Card>

          {!online && (
            <Card title="Openingstijden" description="Behandelaars kunnen alleen binnen deze tijden worden ingeroosterd.">
              <button type="button" onClick={() => setHoursOpen(true)} className="grid w-full grid-cols-2 gap-x-6 text-left" aria-label="Openingstijden wijzigen">
                {DAYS.map((d, i) => {
                  const h = hours.find((x) => x.weekday === i + 1);
                  return (
                    <div key={d} className="flex justify-between border-b border-line py-2.5 text-sm">
                      <span>{d}</span>
                      <span className={h && !h.closed ? "" : "text-muted-foreground"}>{h && !h.closed ? `${hhmm(h.opens)} – ${hhmm(h.closes)}` : "Gesloten"}</span>
                    </div>
                  );
                })}
              </button>
              <div className="mt-4"><PillButton variant="outline" onClick={() => setExcOpen(true)}><PlusIcon />Uitzondering toevoegen</PillButton></div>
            </Card>
          )}

          {!online && (
            <Card title="Kamers en apparatuur" description="Apparatuur die vast in een kamer staat, zoals een laser of afzuiger, geef je als kenmerk van die kamer op.">
              <table className="w-full">
                <thead><tr className="border-b border-line"><th className={thCls}>Kamer</th><th className={thCls}>Kenmerken</th><th className={thCls}>Geschikt voor</th><th className={thCls} /></tr></thead>
                <tbody className="divide-y divide-line">
                  {rooms.map((r) => {
                    const f = roomFeatures(r);
                    return (
                      <tr key={r.id}>
                        <td className={tdCls}>{r.name}</td>
                        <td className={tdCls}>{f.length ? <span className="flex gap-1">{f.map((e) => <Tag key={e.id}>{kindName(org, e.kind)}</Tag>)}</span> : <span className="text-muted-foreground">Geen</span>}</td>
                        <td className={tdCls}>{suitedFor(r)}</td>
                        <td className={tdCls}><TextLink onClick={() => setRoomModal(r)}>Wijzig</TextLink></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-4"><PillButton variant="outline" onClick={() => setRoomModal("new")}><PlusIcon />Kamer toevoegen</PillButton></div>
            </Card>
          )}
        </div>

        <Card title="Behandelingen hier">
          <Tag tone={okCount === here.length ? "teal" : "warning"}>{okCount} van {here.length} boekbaar</Tag>
          <p className="mt-2 text-sm text-muted-foreground">Dezelfde keuze als op de pagina van elke behandeling.</p>
          <ul className="mt-3 max-h-[640px] divide-y divide-line overflow-y-auto">
            {here.map(({ t, reason, docs }) => t && (
              <li key={t.id} className="flex gap-3 py-3">
                <StatusMark kind={reason === "ok" ? "ok" : "warn"} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{t.name_nl}</div>
                  <div className="text-xs text-muted-foreground">
                    {reason === "ok" ? (docs.length <= 2 ? docs.map((d) => fullName(org.practitioners.find((p) => p.id === d.practitioner_id) ?? { first_name: "", last_name: "" })).join(", ") : `${docs.length} behandelaars`) : REASON_TEXT[reason]}
                  </div>
                </div>
                <Link to="/organisatie/behandelingen/$id" params={{ id: t.id }} className="text-[13px] text-primary underline underline-offset-2">Wijzig</Link>
              </li>
            ))}
          </ul>
          <div className="mt-3"><PillButton variant="outline" onClick={() => setAddOpen(true)}><PlusIcon />Behandeling toevoegen</PillButton></div>
        </Card>
      </div>

      {hoursOpen && <HoursModal org={org} locationId={id} onClose={() => setHoursOpen(false)} onSaved={refresh} />}
      {excOpen && <LocationExceptionModal locationId={id} onClose={() => setExcOpen(false)} />}
      {roomModal && <RoomModal locationId={id} room={roomModal === "new" ? null : roomModal} count={rooms.length} onClose={() => setRoomModal(null)} onSaved={refresh} />}
      {addOpen && <OfferTreatmentsModal org={org} locationId={id} onClose={() => setAddOpen(false)} onSaved={refresh} />}
    </div>
  );
}

function HoursModal({ org, locationId, onClose, onSaved }: { org: Org; locationId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const existing = org.hours.filter((h) => h.location_id === locationId);
  const times = quarterTimes(6, 23).map((t) => ({ value: t, label: t }));
  const [rows, setRows] = useState(DAYS.map((_, i) => {
    const h = existing.find((x) => x.weekday === i + 1);
    return { weekday: i + 1, closed: h ? h.closed : true, opens: hhmm(h?.opens) || "08:30", closes: hhmm(h?.closes) || "17:30" };
  }));
  const valid = rows.every((r) => r.closed || r.opens < r.closes);
  const save = useMutation({
    mutationFn: () => saveHours(locationId, rows, existing.map((h) => h.weekday)),
    onSuccess: async () => { await onSaved(); toast.success("Opgeslagen"); onClose(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Modal open width="lg" onOpenChange={(o) => !o && onClose()} title="Openingstijden" description="Behandelaars kunnen alleen binnen deze tijden worden ingeroosterd."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!valid || save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></>}>
      <div className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <div key={r.weekday} className="grid grid-cols-[120px_160px_1fr_1fr] items-end gap-3">
            <span className="pb-3 text-sm">{DAYS[i]}</span>
            <Select label="Open" value={r.closed ? "closed" : "open"} onChange={(v) => set(i, { closed: v === "closed" })} options={[{ value: "open", label: "Open" }, { value: "closed", label: "Gesloten" }]} />
            {!r.closed && <Select label="Van" value={r.opens} onChange={(v) => set(i, { opens: v })} options={times} />}
            {!r.closed && <Select label="Tot" value={r.closes} onChange={(v) => set(i, { closes: v })} options={times} />}
          </div>
        ))}
        {!valid && <p className="text-sm text-warning">De begintijd moet vóór de eindtijd liggen.</p>}
      </div>
    </Modal>
  );
}

function LocationExceptionModal({ locationId, onClose }: { locationId: string; onClose: () => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () => addLocationException({ location_id: locationId, date_from: from, date_to: to || from, closed: true, note: note.trim() || null }),
    onSuccess: () => { toast.success("Uitzondering toegevoegd"); onClose(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Uitzondering toevoegen" description="Dagen waarop deze locatie dicht is. Feestdagen voor alle locaties zet je in Algemeen."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!from || (!!to && to < from) || save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></>}>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Van" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField label="Tot en met" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <TextField label="Reden" value={note} onChange={(e) => setNote(e.target.value)} className="col-span-2" />
      </div>
    </Modal>
  );
}

function RoomModal({ locationId, room, count, onClose, onSaved }: { locationId: string; room: Room | null; count: number; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(room?.name ?? "");
  const save = useMutation({
    mutationFn: () => saveRoom(room?.id ?? null, { location_id: locationId, name: name.trim(), sort: count }),
    onSuccess: async () => { await onSaved(); toast.success("Opgeslagen"); onClose(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const del = useMutation({
    mutationFn: () => deleteRoom(room?.id ?? ""),
    onSuccess: async () => { await onSaved(); toast.success("Kamer verwijderd"); onClose(); },
    onError: () => toast.error("Verwijderen is niet gelukt"),
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={room ? room.name : "Kamer toevoegen"} description="Vaste apparatuur in deze kamer zet je bij Apparatuur."
      footer={
        <div className="flex w-full items-center justify-between">
          {room ? <TextLink tone="warning" onClick={() => del.mutate()}>Kamer verwijderen</TextLink> : <span />}
          <div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></div>
        </div>
      }>
      <TextField label="Naam" value={name} onChange={(e) => setName(e.target.value)} />
    </Modal>
  );
}

function OfferTreatmentsModal({ org, locationId, onClose, onSaved }: { org: Org; locationId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const offered = new Set(org.treatmentLocations.filter((tl) => tl.location_id === locationId).map((tl) => tl.treatment_id));
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const list = org.treatments.filter((t) => !offered.has(t.id) && (!q || t.name_nl.toLowerCase().includes(q.toLowerCase())));
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("treatment_locations").insert(picked.map((t) => ({ treatment_id: t, location_id: locationId })));
      if (error) throw error;
    },
    onSuccess: async () => { await onSaved(); toast.success("Behandelingen toegevoegd"); onClose(); },
    onError: () => toast.error("Toevoegen is niet gelukt"),
  });
  return (
    <Modal open width="lg" onOpenChange={(o) => !o && onClose()} title="Behandeling toevoegen" description="Vink aan welke behandelingen op deze locatie worden aangeboden."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!picked.length || add.isPending} onClick={() => add.mutate()}>Toevoegen ({picked.length})</PillButton></>}>
      <SearchField placeholder="Zoek een behandeling" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Zoek een behandeling" />
      <ul className="mt-3 flex flex-col gap-2">
        {list.map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-[14px] border border-line px-3.5 py-3">
            <Checkbox checked={picked.includes(t.id)} label={t.name_nl} onChange={(v) => setPicked(v ? [...picked, t.id] : picked.filter((x) => x !== t.id))} />
            <span className="flex-1 text-sm">{t.name_nl}</span>
            <span className="text-xs text-muted-foreground">{t.duration_min} min</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
