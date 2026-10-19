import { useRef, useState, type ReactNode } from "react";

import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { TextLink } from "@/components/Field";
import { UiIcon } from "@/components/UiIcon";
import type { VersionRow } from "@/data/questionnaires";
import { VersionPill } from "./VersionPill";

export const longDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : "");
/** "zojuist", "12 minuten geleden", "vandaag om 14:05" or a date. */
export function whenSaved(iso: string, now = Date.now()) {
  const min = Math.round((now - Date.parse(iso)) / 60000);
  if (min < 2) return "zojuist";
  if (min < 60) return `${min} minuten geleden`;
  const d = new Date(iso);
  if (d.toDateString() === new Date(now).toDateString()) return `vandaag om ${d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`;
  return `op ${longDate(iso)}`;
}
export const changesCount = (n: number) => (n === 0 ? "nog geen wijzigingen" : n === 1 ? "1 wijziging" : `${n} wijzigingen`);

/** Period an archived version was live: from its publication until the next version was published. */
export function livePeriod(v: VersionRow, all: VersionRow[]) {
  const next = all.filter((x) => x.published_at && x.version_no > v.version_no).sort((a, b) => a.version_no - b.version_no)[0];
  return { from: longDate(v.published_at), to: longDate(next?.published_at) };
}

export function PublishDialog({ name, moment, liveNo, draftNo, changes, running, testLink, busy, onPublish, onClose }: {
  name: string; moment: string; liveNo: number | null; draftNo: number; changes: string[]; running: number; testLink: ReactNode; busy: boolean; onPublish: () => void; onClose: () => void;
}) {
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={liveNo ? `Versie ${liveNo} vervangen door versie ${draftNo}?` : `Versie ${draftNo} publiceren?`} description={`${name} · ${moment.toLowerCase()}`}
      footer={<div className="flex w-full items-center gap-3"><span className="mr-auto">{testLink}</span><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton onClick={onPublish} disabled={busy}>Publiceer versie {draftNo}</PillButton></div>}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-[14px] bg-sand px-4 py-3">
          {liveNo && <><VersionPill tone="archive">Versie {liveNo} · nu live</VersionPill><UiIcon name="pijl-rechts" className="size-4 text-primary" /></>}
          <VersionPill tone="live">Versie {draftNo} · wordt live</VersionPill>
        </div>
        <div>
          <h3 className="mb-2 text-[15px] font-semibold">Wat verandert er voor de patiënt</h3>
          {changes.length ? <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">{changes.map((c) => <li key={c}>{c.charAt(0).toUpperCase() + c.slice(1)}.</li>)}</ul>
            : <p className="text-sm text-muted-foreground">Niets: deze versie is voor de patiënt gelijk aan de live versie.</p>}
        </div>
        {liveNo && <p className="flex gap-3 rounded-[14px] bg-signal px-4 py-3 text-sm ring-1 ring-signal-border"><UiIcon name="info" className="mt-0.5 size-4 shrink-0" />
          {running === 1 ? "1 patiënt is" : `${running} patiënten zijn`} nu bezig met versie {liveNo}. Zij maken die versie gewoon af; wie daarna begint, krijgt versie {draftNo}. Versie {liveNo} komt in de versies te staan en kun je altijd terugzetten.</p>}
      </div>
    </Modal>
  );
}

export function DiscardDialog({ draftNo, liveNo, changes, busy, onConfirm, onClose }: { draftNo: number; liveNo: number | null; changes: number; busy: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Concept versie ${draftNo} weggooien?`}
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton onClick={onConfirm} disabled={busy}>Concept weggooien</PillButton></>}>
      <p className="text-sm">{changes === 0 ? "Er zijn nog geen wijzigingen in dit concept." : `Je verliest ${changes === 1 ? "1 wijziging" : `${changes} wijzigingen`}.`}{liveNo ? ` Versie ${liveNo} blijft live voor patiënten.` : ""}</p>
    </Modal>
  );
}

export function VersionsDialog({ versions, names, draftChanges, onContinue, onView, onUse, onExport, onImport, onClose }: {
  versions: VersionRow[]; names: Record<string, string>; draftChanges: number;
  onContinue: () => void; onView: (v: VersionRow) => void; onUse: (v: VersionRow) => void; onExport: () => void; onImport: (f: File) => void; onClose: () => void;
}) {
  const [confirm, setConfirm] = useState<VersionRow | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const draft = versions.find((v) => v.status === "draft");
  const live = versions.find((v) => v.status === "published");
  const archive = versions.filter((v) => v.status === "archived").sort((a, b) => b.version_no - a.version_no);
  const by = (id: string | null) => (id && names[id] ? `, gepubliceerd door ${names[id]}` : "");
  const use = (v: VersionRow) => (draft ? setConfirm(v) : onUse(v));
  const Row = ({ pill, title, sub, actions }: { pill: ReactNode; title: string; sub: string; actions?: ReactNode }) => (
    <div className="flex flex-col gap-3 rounded-[16px] border border-line px-4 py-3.5">
      <div className="flex items-center gap-3">{pill}<div className="min-w-0 flex-1"><div className="text-[15px] font-semibold">{title}</div><div className="text-[13px] text-muted-foreground">{sub}</div></div></div>
      {actions}
    </div>
  );
  return (
    <Modal open width="lg" onOpenChange={(o) => !o && onClose()} title="Versies" description="Er staat altijd één versie live en er is hoogstens één concept. Oude versies kun je bekijken of als concept terughalen."
      footer={<div className="flex w-full items-center gap-3"><PillButton variant="outline" onClick={onExport}>Exporteren</PillButton><PillButton variant="outline" onClick={() => file.current?.click()}>Importeren</PillButton>
        <input ref={file} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} /><span className="ml-auto" /><PillButton variant="outline" onClick={onClose}>Sluiten</PillButton></div>}>
      <div className="flex flex-col gap-3">
        {draft && (
          <div className="flex items-center gap-3 rounded-[16px] border border-line px-4 py-3.5">
            <VersionPill tone="draft">Concept</VersionPill>
            <div className="min-w-0 flex-1"><div className="text-[15px] font-semibold">Versie {draft.version_no}</div><div className="text-[13px] text-muted-foreground">Laatst bewaard {whenSaved(draft.updated_at)}{draft.updated_by && names[draft.updated_by] ? ` door ${names[draft.updated_by]}` : ""} · {changesCount(draftChanges)}</div></div>
            <PillButton size="sm" onClick={onContinue}>Verder</PillButton>
          </div>
        )}
        {live && <Row pill={<VersionPill tone="live">Live</VersionPill>} title={`Versie ${live.version_no}`} sub={`Live sinds ${longDate(live.published_at)}${by(live.published_by)}`} />}
        {archive.map((v) => {
          const p = livePeriod(v, versions);
          return <Row key={v.id} pill={<VersionPill tone="archive">Archief</VersionPill>} title={`Versie ${v.version_no}`} sub={p.from ? `Live van ${p.from}${p.to ? ` tot ${p.to}` : ""}${by(v.published_by)}` : "Niet gepubliceerd"}
            actions={<div className="flex gap-2"><PillButton size="sm" variant="outline" onClick={() => onView(v)}>Bekijken</PillButton><PillButton size="sm" variant="outline" onClick={() => use(v)}>Als concept gebruiken</PillButton></div>} />;
        })}
        {draft && archive.length > 0 && <p className="text-[13px] text-warning">Er ligt al een concept. “Als concept gebruiken” vervangt dat concept door de gekozen versie; je ziet eerst wat er verdwijnt.</p>}
        {confirm && draft && (
          <div className="flex flex-col gap-3 rounded-[14px] bg-warning-bg px-4 py-3 text-sm">
            <p>Concept versie {draft.version_no} wordt vervangen door een kopie van versie {confirm.version_no}. {draftChanges ? `De ${changesCount(draftChanges)} in het concept verdwijnen.` : ""}</p>
            <div className="flex gap-3"><PillButton size="sm" onClick={() => { onUse(confirm); setConfirm(null); }}>Concept vervangen</PillButton><TextLink onClick={() => setConfirm(null)}>Annuleren</TextLink></div>
          </div>
        )}
      </div>
    </Modal>
  );
}
