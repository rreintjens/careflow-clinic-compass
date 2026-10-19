import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { UiIcon } from "@/components/UiIcon";
import type { ItemType, PageType } from "@/domain/questionnaire/engine";

type Opt = { value: string; label: string };
export type AddChoice = { kind: "item"; type: ItemType } | { kind: "page"; type: PageType };

/** Tiles of vragenlijst-pagina.dc.html; names come from the option lists, these lines explain them. */
const ITEM_TILES: Partial<Record<ItemType, { icon: string; help: string }>> = {
  single_choice: { icon: "vinkje-cirkel", help: "De patiënt kiest één antwoord en gaat direct door." },
  multi_choice: { icon: "klembord", help: "Meerdere antwoorden, met een antwoord dat de rest uitsluit." },
  number: { icon: "kaart-chip", help: "Bijvoorbeeld centimeters of kilo's, met minimum en maximum." },
  yes_no: { icon: "duim-omhoog", help: "Met een vervolgvraag bij ja of bij nee." },
  height_weight: { icon: "weegschaal", help: "Twee velden; rekent de BMI uit als berekend veld." },
  measure_with_image: { icon: "meetlint", help: "Een meting met een foto erbij, zoals buikomvang." },
};
const PAGE_TILES: Partial<Record<PageType, { icon: string; help: string }>> = {
  question_page: { icon: "document", help: "Zet meerdere vragen op één scherm, zonder maximum, bijvoorbeeld voor een lange medische vragenlijst. Voorwaardelijke vragen verschijnen op dezelfde pagina." },
  text: { icon: "info", help: "Een titel en een wervende of uitleggende tekst, met een knop." },
  flow_overview: { icon: "route", help: "Laat zien waar de patiënt is. De stappen komen uit de flow zelf; alleen titel en tekst zijn te bewerken." },
  boodschap: { icon: "grafiek", help: "Titel, opsomming of stappen, afbeelding en knop. Vier vormen." },
};

function Tile({ icon, label, help, onClick }: { icon: string; label: string; help: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-start gap-3 rounded-[14px] border border-line bg-background p-4 text-left hover:border-primary">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-sand text-primary"><UiIcon name={icon} className="size-[18px]" /></span>
      <span className="min-w-0"><span className="block text-[15px]">{label}</span><span className="mt-0.5 block text-xs leading-[1.5] text-muted-foreground">{help}</span></span>
    </button>
  );
}

/** "Vraag of pagina toevoegen": two groups of tiles; a tile opens the matching window. */
export function AddChooser({ itemTypes, pageTypes, afterLabel, onPick, onClose }: { itemTypes: Opt[]; pageTypes: Opt[]; afterLabel: string; onPick: (c: AddChoice) => void; onClose: () => void }) {
  const items = itemTypes.filter((o) => ITEM_TILES[o.value as ItemType]);
  const pages = pageTypes.filter((o) => PAGE_TILES[o.value as PageType]);
  return (
    <Modal open width="lg" onOpenChange={(o) => !o && onClose()} title="Vraag of pagina toevoegen" description={afterLabel}
      footer={<PillButton variant="outline" onClick={onClose}>Annuleren</PillButton>}>
      <div className="flex flex-col gap-3">
        <span className="text-[13px] font-medium">Vragen</span>
        <div className="grid grid-cols-2 gap-3">
          {items.map((o) => { const t = ITEM_TILES[o.value as ItemType]!; return <Tile key={o.value} icon={t.icon} label={o.label.replace(/ \(BMI\)$/, "")} help={t.help} onClick={() => onPick({ kind: "item", type: o.value as ItemType })} />; })}
        </div>
        <span className="mt-2 text-[13px] font-medium">Pagina’s zonder vraag</span>
        <div className="grid grid-cols-2 gap-3">
          {pages.map((o) => { const t = PAGE_TILES[o.value as PageType]!; return <Tile key={o.value} icon={t.icon} label={o.label} help={t.help} onClick={() => onPick({ kind: "page", type: o.value as PageType })} />; })}
        </div>
        <p className="mt-1 text-xs leading-[1.6] text-muted-foreground">Elke vraag of pagina kan een voorwaarde krijgen: alleen tonen als een eerder antwoord of een berekend veld aan iets voldoet.</p>
      </div>
    </Modal>
  );
}
