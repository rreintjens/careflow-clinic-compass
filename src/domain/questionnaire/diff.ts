/** Plain-language list of what changes for the patient between the live version and a concept. */
import { questionNumbers } from "./builder";
import type { Item, Page, QuestionnaireDef } from "./engine";

const items = (d: QuestionnaireDef) => new Map(d.pages.flatMap((p) => (p.items ?? []).map((i) => [i.id, i] as const)));
const plain = (d: QuestionnaireDef) => new Map(d.pages.filter((p) => !p.items?.length).map((p) => [p.id, p] as const));
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const options = (i: Item) => [...(i.options ?? []), ...(i.exclusive_option ? [i.exclusive_option] : [])];
const short = (s: string) => (s.length > 40 ? `${s.slice(0, 38)}…` : s);
const label = (o: string) => o.toLowerCase();

export function describeChanges(live: QuestionnaireDef | null, draft: QuestionnaireDef): string[] {
  if (!live) return ["Dit wordt de eerste versie die patiënten krijgen"];
  const out: string[] = [];
  const nums = questionNumbers(draft);
  const liveItems = items(live), draftItems = items(draft);
  const pageOf = (d: QuestionnaireDef, id: string) => d.pages.find((p) => p.items?.some((i) => i.id === id));
  for (const [id, i] of draftItems) {
    const n = `vraag ${nums[id] ?? "?"}`;
    const old = liveItems.get(id);
    if (!old) { out.push(`${n} “${short(i.text)}” is nieuw${i.optional ? " en optioneel" : ""}`); continue; }
    if (old.text !== i.text || !same(old.help, i.help)) out.push(`${n} krijgt een nieuwe tekst`);
    if (old.type !== i.type) out.push(`${n} wordt een andere soort vraag`);
    for (const o of options(i)) if (!options(old).includes(o)) out.push(`${n} krijgt de optie “${label(o)}”`);
    for (const o of options(old)) if (!options(i).includes(o)) out.push(`bij ${n} vervalt de optie “${label(o)}”`);
    if (i.allow_unknown && !old.allow_unknown) out.push(`${n} krijgt de optie “${label(i.allow_unknown)}”`);
    if (!same(old.show_if, i.show_if) || !same(pageOf(live, id)?.show_if, pageOf(draft, id)?.show_if)) out.push(`de voorwaarde van ${n} is gewijzigd`);
    if (!same(old.red_if, i.red_if)) out.push(`wanneer ${n} rood is, is gewijzigd`);
    if (!same(old.signal_if, i.signal_if)) out.push(`het signaal voor de arts bij ${n} is gewijzigd`);
    if (!!old.optional !== !!i.optional) out.push(`${n} is ${i.optional ? "nu optioneel" : "nu verplicht"}`);
  }
  for (const [id, i] of liveItems) if (!draftItems.has(id)) out.push(`de vraag “${short(i.text)}” vervalt`);
  const livePages = plain(live), draftPages = plain(draft);
  const title = (p: Page) => p.title ?? p.id;
  for (const [id, p] of draftPages) {
    const old = livePages.get(id);
    if (!old) out.push(`de pagina “${short(title(p))}” is nieuw`);
    else {
      const { show_if: a, ...x } = old, { show_if: b, ...y } = p;
      if (!same(x, y)) out.push(`de pagina “${short(title(p))}” is gewijzigd`);
      if (!same(a, b)) out.push(`wanneer de pagina “${short(title(p))}” verschijnt, is gewijzigd`);
    }
  }
  for (const [id, p] of livePages) if (!draftPages.has(id)) out.push(`de pagina “${short(title(p))}” vervalt`);
  const order = (d: QuestionnaireDef, keep: (id: string) => boolean) => d.pages.flatMap((p) => (p.items?.length ? p.items.map((i) => i.id) : [p.id])).filter(keep);
  const common = (id: string) => (liveItems.has(id) || livePages.has(id)) && (draftItems.has(id) || draftPages.has(id));
  if (!same(order(live, common), order(draft, common))) out.push("de volgorde is gewijzigd");
  return out;
}

/** The list as one sentence, as shown under “Wat verandert er voor de patiënt”. */
export function changesSentence(changes: string[]): string {
  if (!changes.length) return "Niets: deze versie is voor de patiënt gelijk aan de live versie.";
  const s = changes.join("; ");
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}
