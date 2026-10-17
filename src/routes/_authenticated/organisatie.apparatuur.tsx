import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/Card";
import { PlusIcon, Tag, TextField, TextLink, tdCls, thCls } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { addEquipmentException, deleteEquipment, locName, optLabel, opts, orgQuery, saveEquipment, type Equipment, type Org } from "@/data/organisation";

export const Route = createFileRoute("/_authenticated/organisatie/apparatuur")({
  head: () => ({ meta: [{ title: "Apparatuur · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(orgQuery),
  component: EquipmentPage,
});

const DAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
const MOBILITY_HELP: Record<string, string> = {
  fixed_room: "Vast in een kamer. Een behandeling die het nodig heeft, krijgt die kamer.",
  within_location: "Verplaatsbaar binnen een locatie. Het gaat mee naar de kamer van de afspraak.",
  between_locations: "Verplaatsbaar tussen locaties. Per dag kies je waar het staat; alleen daar is een behandeling die dag boekbaar.",
};

function where(org: Org, e: Equipment) {
  if (e.mobility === "fixed_room") {
    const r = org.rooms.find((x) => x.id === e.room_id);
    return r ? `${locName(org, r.location_id)}, ${r.name.toLowerCase()}` : "Nog geen kamer";
  }
  if (e.mobility === "within_location") return e.location_id ? `${locName(org, e.location_id)}, gaat mee naar de kamer van de afspraak` : "Nog geen locatie";
  return "Wisselt per dag, zie hieronder";
}

function neededFor(org: Org, e: Equipment) {
  const names = [...new Set(org.requirements.filter((r) => r.kind === "equipment" && r.equipment_kind === e.kind).map((r) => org.treatments.find((t) => t.id === r.treatment_id)?.name_nl).filter(Boolean))] as string[];
  if (!names.length) return "Nog geen behandeling";
  return names.length === 1 ? (names[0] as string) : `${names[names.length - 1]} en andere ${optLabel(org, "equipment_kind", e.kind).toLowerCase()}behandelingen`;
}

function EquipmentPage() {
  const { data: org } = useSuspenseQuery(orgQuery);
  const [modal, setModal] = useState<Equipment | "new" | null>(null);
  const between = org.equipment.filter((e) => e.mobility === "between_locations");
  let prevNeed = "";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Apparatuur" description="Apparaten die een behandeling nodig heeft. Vast in een kamer, of verplaatsbaar." actions={<PillButton size="lg" onClick={() => setModal("new")}><PlusIcon />Apparaat toevoegen</PillButton>} />
      <div className="grid grid-cols-3 gap-4">
        {[
          ["1", "Vast in een kamer", "Een apparaat dat niet te verplaatsen is, zoals een laser of afzuiger. Je legt het vast bij de kamer. Een behandeling die het nodig heeft, krijgt die kamer."],
          ["2", "Verplaatsbaar binnen een locatie", "Een apparaat op wieltjes. Het hoort bij een locatie en gaat mee naar de kamer van de afspraak. Het systeem reserveert het apparaat én een vrije kamer."],
          ["3", "Verplaatsbaar tussen locaties", "Een apparaat dat per dag ergens anders staat. Je plant per dag op welke locatie het is. Alleen die dag kan de behandeling daar."],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded-[18px] bg-sand p-5">
            <div className="flex items-center gap-3"><span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-background text-xs font-semibold">{n}</span><span className="text-[15px] font-semibold">{t}</span></div>
            <p className="mt-3 text-[13px] leading-[1.6]">{d}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-6">
        <Card title="Alle apparatuur" description="Klik op Wijzig om een apparaat aan te passen; dat opent een pop-up. Vaste apparatuur zie je ook bij de kamers van de locatie; het is hetzelfde gegeven.">
          <table className="w-full">
            <thead><tr className="border-b border-line"><th className={thCls}>Apparaat</th><th className={thCls}>Soort</th><th className={thCls}>Hoe</th><th className={thCls}>Waar</th><th className={thCls}>Nodig voor</th><th className={thCls} /></tr></thead>
            <tbody className="divide-y divide-line">
              {org.equipment.map((e) => {
                const need = neededFor(org, e);
                const shown = need === prevNeed ? "Idem" : need;
                prevNeed = need;
                return (
                  <tr key={e.id}>
                    <td className={tdCls}>{e.name}</td>
                    <td className={tdCls}>{optLabel(org, "equipment_kind", e.kind)}</td>
                    <td className={tdCls}><Tag tone={e.mobility === "fixed_room" ? "teal" : "sand"}>{optLabel(org, "equipment_mobility", e.mobility)}</Tag></td>
                    <td className={tdCls}>{where(org, e)}</td>
                    <td className={tdCls}>{shown}</td>
                    <td className={tdCls}><TextLink onClick={() => setModal(e)}>Wijzig</TextLink></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {between.map((e) => (
            <div key={e.id} className="mt-5 rounded-[14px] bg-sand p-4 text-sm">
              <div className="font-medium">{e.name}, per dag</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[13px]">
                {DAYS.map((d, i) => {
                  const dl = org.dayLocations.find((x) => x.equipment_id === e.id && x.weekday === i + 1);
                  return <div key={d}><span className="text-muted-foreground">{d}: </span>{dl?.location_id ? locName(org, dl.location_id) : "Niet ingepland"}</div>;
                })}
              </div>
            </div>
          ))}
          <div className="mt-4"><PillButton variant="outline" onClick={() => setModal("new")}><PlusIcon />Apparaat toevoegen</PillButton></div>
        </Card>
        <Card title="Zo rekent de agenda">
          <div className="flex flex-col gap-3 text-sm leading-[1.6]">
            <p>Een behandeling vraagt bijvoorbeeld “een kamer” en “een laser”. Een tijd is alleen boekbaar als op dat moment op die locatie een vrije kamer is, een vrije laser, en een behandelaar die het doet.</p>
            <p>Bij een vaste laser telt de kamer waar hij staat. Bij een verplaatsbare laser telt elke vrije kamer, plus het apparaat. Bij het boeken worden kamer en apparaat samen vastgelegd, zodat er nooit twee afspraken op hetzelfde apparaat staan.</p>
          </div>
        </Card>
      </div>
      {modal && <EquipmentModal org={org} equipment={modal === "new" ? null : modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function EquipmentModal({ org, equipment, onClose }: { org: Org; equipment: Equipment | null; onClose: () => void }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: orgQuery.queryKey });
  const [name, setName] = useState(equipment?.name ?? "");
  const [kind, setKind] = useState(equipment?.kind ?? opts(org, "equipment_kind")[0]?.value ?? "");
  const [mobility, setMobility] = useState(equipment?.mobility ?? "fixed_room");
  const [room, setRoom] = useState(equipment?.room_id ?? "");
  const [loc, setLoc] = useState(equipment?.location_id ?? "");
  const [recurrence, setRecurrence] = useState(equipment?.recurrence ?? "weekly");
  const [days, setDays] = useState(DAYS.map((_, i) => org.dayLocations.find((d) => d.equipment_id === equipment?.id && d.weekday === i + 1)?.location_id ?? "none"));
  const [excOpen, setExcOpen] = useState(false);
  const clinics = org.locations.filter((l) => l.kind === "clinic");
  const roomOptions = org.rooms.map((r) => ({ value: r.id, label: `${locName(org, r.location_id)} · ${r.name}` }));
  const valid = name.trim() && kind && (mobility !== "fixed_room" || room) && (mobility !== "within_location" || loc);
  const save = useMutation({
    mutationFn: () =>
      saveEquipment(
        equipment?.id ?? null,
        { name: name.trim(), kind, mobility, room_id: mobility === "fixed_room" ? room : null, location_id: mobility === "within_location" ? loc : null, recurrence },
        days.map((d, i) => ({ weekday: i + 1, location_id: d === "none" ? null : d })),
      ),
    onSuccess: async () => { await refresh(); toast.success("Opgeslagen"); onClose(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const del = useMutation({
    mutationFn: () => deleteEquipment(equipment?.id ?? ""),
    onSuccess: async () => { await refresh(); toast.success("Apparaat verwijderd"); onClose(); },
    onError: () => toast.error("Verwijderen is niet gelukt"),
  });
  return (
    <>
      <Modal open onOpenChange={(o) => !o && onClose()} title={equipment ? equipment.name : "Apparaat toevoegen"} description={MOBILITY_HELP[mobility] ?? ""}
        footer={
          <div className="flex w-full items-center justify-between">
            {equipment ? <TextLink tone="warning" onClick={() => del.mutate()}>Apparaat verwijderen</TextLink> : <span />}
            <div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!valid || save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></div>
          </div>
        }>
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Naam" value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Soort" value={kind} onChange={setKind} options={opts(org, "equipment_kind")} />
          <Select label="Hoe" value={mobility} onChange={setMobility} options={opts(org, "equipment_mobility")} className="col-span-2" />
          {mobility === "fixed_room" && <Select label="Kamer" value={room} onChange={setRoom} options={roomOptions} className="col-span-2" />}
          {mobility === "within_location" && <Select label="Locatie" value={loc} onChange={setLoc} options={clinics.map((l) => ({ value: l.id, label: l.name }))} className="col-span-2" />}
        </div>
        {mobility === "between_locations" && (
          <>
            <div className="mt-5 text-[13px] font-medium">Waar staat het?</div>
            <div className="mt-2 grid grid-cols-2 gap-4">
              {DAYS.map((d, i) => (
                <Select key={d} label={d} value={days[i] ?? "none"} onChange={(v) => setDays(days.map((x, j) => (j === i ? v : x)))} options={[{ value: "none", label: "Niet ingepland" }, ...clinics.map((l) => ({ value: l.id, label: l.name }))]} />
              ))}
            </div>
            <div className="mt-4 flex items-end gap-4">
              <Select label="Herhaling" value={recurrence} onChange={setRecurrence} options={opts(org, "recurrence").filter((o) => o.value !== "once")} className="w-[180px]" />
              {equipment && <span className="pb-3"><TextLink onClick={() => setExcOpen(true)}>Uitzondering toevoegen, zoals onderhoud</TextLink></span>}
            </div>
          </>
        )}
        {mobility !== "between_locations" && equipment && <div className="mt-4"><TextLink onClick={() => setExcOpen(true)}>Uitzondering toevoegen, zoals onderhoud</TextLink></div>}
      </Modal>
      {excOpen && equipment && <EquipmentExceptionModal equipmentId={equipment.id} onClose={() => setExcOpen(false)} />}
    </>
  );
}

function EquipmentExceptionModal({ equipmentId, onClose }: { equipmentId: string; onClose: () => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () => addEquipmentException({ equipment_id: equipmentId, date_from: from, date_to: to || from, note: note.trim() || null }),
    onSuccess: () => { toast.success("Uitzondering toegevoegd"); onClose(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Uitzondering toevoegen" description="Dagen waarop het apparaat niet beschikbaar is, bijvoorbeeld voor onderhoud."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!from || (!!to && to < from) || save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></>}>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Van" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField label="Tot en met" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <TextField label="Reden" value={note} onChange={(e) => setNote(e.target.value)} className="col-span-2" />
      </div>
    </Modal>
  );
}
