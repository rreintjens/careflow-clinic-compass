import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { SearchField } from "@/components/Field";
import { MenuIcon } from "@/components/MenuIcon";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { cn } from "@/lib/utils";
import { expandSearch } from "./icon-search";

interface Entry { key: string; label: string; group: string; words: string }

const GROUP_NL: Record<string, string> = {
  Health: "Gezondheid", Mood: "Gezicht en stemming", Gestures: "Gebaren", Nature: "Natuur", Weather: "Weer", Food: "Eten",
  Sport: "Sport", Animals: "Dieren", Buildings: "Gebouwen", Communication: "Communicatie", Devices: "Apparaten", Document: "Documenten",
  "E-commerce": "Winkel", Map: "Kaart", Media: "Media", Shapes: "Vormen", Symbols: "Symbolen", System: "Systeem", Vehicles: "Vervoer",
  Arrows: "Pijlen", Charts: "Grafieken", Design: "Ontwerp", Text: "Tekst", Photography: "Foto", Currencies: "Valuta", Laundry: "Was",
  Electrical: "Elektra", Games: "Spel", Gender: "Gender", Letters: "Letters", Numbers: "Cijfers", Math: "Wiskunde", Zodiac: "Sterrenbeeld",
  Brand: "Merken", Badges: "Badges", Computers: "Computers", Database: "Database", Development: "Ontwikkeling", Extensions: "Bestanden",
  Logic: "Logica", "Version control": "Versiebeheer", Overig: "Overig",
};
const GROUP_FIRST = ["The Body Clinic", "Basis", "Eigen iconen", "Gezondheid", "Gezicht en stemming", "Sport", "Natuur", "Eten", "Gebaren", "Weer"];

async function loadLibrary(): Promise<Entry[]> {
  const [tbc, ui, tabler] = await Promise.all([
    fetch("/icon-library/tbc.json").then((r) => r.json() as Promise<string[]>),
    fetch("/ui-icons/icons.json").then((r) => r.json() as Promise<Array<{ name: string; tags: string[] }>>),
    fetch("/icon-library/tabler.json").then((r) => r.json() as Promise<Array<[string, string, string]>>),
  ]);
  const nice = (s: string) => s.replace(/-/g, " ");
  return [
    ...tbc.map((n) => ({ key: n, label: nice(n), group: "The Body Clinic", words: nice(n) })),
    ...ui.map((i) => ({ key: `ui:${i.name}`, label: nice(i.name), group: "Basis", words: `${nice(i.name)} ${i.tags.join(" ")}` })),
    ...tabler.map(([n, c, t]) => ({ key: `tabler:${n}`, label: nice(n), group: GROUP_NL[c] ?? c, words: `${nice(n)} ${t}` })),
  ];
}

export function IconPicker({ value, fallback, custom, onUpload, onPick, onClose }: {
  value: string | null; fallback: string; custom: ReadonlyArray<{ id: string; name: string }>;
  onUpload: (file: File) => Promise<string>; onPick: (icon: string | null) => void; onClose: () => void;
}) {
  const lib = useQuery({ queryKey: ["icon-library"], queryFn: loadLibrary, staleTime: Infinity });
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("The Body Clinic");
  const fileRef = useRef<HTMLInputElement>(null);
  const all = useMemo(() => [...custom.map((c) => ({ key: `custom:${c.id}`, label: c.name, group: "Eigen iconen", words: c.name })), ...(lib.data ?? [])], [lib.data, custom]);
  const groups = useMemo(() => {
    const set = new Set(all.map((e) => e.group));
    set.add("Eigen iconen");
    return [...GROUP_FIRST.filter((g) => set.has(g)), ...[...set].filter((g) => !GROUP_FIRST.includes(g)).sort((a, b) => a.localeCompare(b, "nl"))];
  }, [all]);
  const shown = useMemo(() => {
    const terms = expandSearch(q);
    if (!terms.length) return all.filter((e) => e.group === group);
    return all.filter((e) => terms.some((t) => e.words.toLowerCase().includes(t))).slice(0, 400);
  }, [all, q, group]);

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} width="xl" title="Icoon kiezen"
      footer={<><input ref={fileRef} type="file" accept=".svg,image/svg+xml" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = "";
        if (!f) return;
        try { const key = await onUpload(f); onPick(key); } catch (err) { toast.error(err instanceof Error ? err.message : "Uploaden is niet gelukt"); }
      }} />
        <PillButton variant="outline" onClick={() => fileRef.current?.click()}>Eigen SVG uploaden</PillButton>
        <PillButton variant="outline" onClick={onClose}>Annuleren</PillButton></>}>
      <SearchField placeholder="Zoek, bijvoorbeeld lippen, oog of huid" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Zoek een icoon" autoFocus />
      {!q.trim() && (
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-2" role="tablist" aria-label="Icoongroepen">
          {groups.map((g) => (
            <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => setGroup(g)}
              className={cn("h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] transition-colors", group === g ? "bg-primary text-primary-foreground" : "bg-sand hover:bg-mist")}>{g}</button>
          ))}
        </div>
      )}
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-1.5">
        <button type="button" onClick={() => onPick(null)} className={cn("flex flex-col items-center gap-1.5 rounded-xl p-2 text-center hover:bg-sand", !value && "bg-teal-light")}>
          <MenuIcon icon={fallback} inherited />
          <span className="text-[11px] leading-tight text-muted-foreground">Geen eigen icoon</span>
        </button>
        {shown.map((e) => (
          <button key={e.key} type="button" title={e.label} onClick={() => onPick(e.key)} className={cn("flex flex-col items-center gap-1.5 rounded-xl p-2 text-center hover:bg-sand", value === e.key && "bg-teal-light")}>
            <MenuIcon icon={e.key} />
            <span className="line-clamp-2 break-all text-[11px] leading-tight text-muted-foreground">{e.label}</span>
          </button>
        ))}
      </div>
      {lib.isLoading && <p className="py-4 text-sm text-muted-foreground">Iconen laden…</p>}
      {!lib.isLoading && shown.length === 0 && <p className="py-4 text-sm text-muted-foreground">{group === "Eigen iconen" && !q ? "Nog geen eigen iconen. Upload een SVG." : "Geen iconen gevonden."}</p>}
    </Modal>
  );
}
