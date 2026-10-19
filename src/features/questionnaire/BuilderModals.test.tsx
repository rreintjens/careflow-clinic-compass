import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Condition, FlowFile, Item, Page } from "@/domain/questionnaire/engine";
import seed from "@/seed/tbc_flow_medisch_afvallen_v0.2.json";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: unknown }) => <a>{children as string}</a> }));

Element.prototype.scrollTo = () => {};
const { ItemModal } = await import("./BuilderModals");
const { ConditionModal, fieldInfos, refOptions } = await import("./conditions");

const flow = seed as unknown as FlowFile;
const triage = flow.questionnaires[0]!;
const ops = [["eq", "is"], ["not_eq", "is niet"], ["gte", "is minimaal"], ["lt", "is kleiner dan"], ["between", "ligt tussen"], ["contains", "bevat"]].map(([value, label]) => ({ value: value!, label: label! }));
const ctx = { fields: fieldInfos(triage, flow.computed_fields), ops, refs: refOptions(flow.settings, flow.computed_fields), settings: flow.settings, computed: flow.computed_fields };
const find = (id: string) => { for (const p of triage.pages) for (const i of p.items ?? []) if (i.id === id) return { page: p as Page, item: i as Item }; throw new Error(id); };

describe("condition modal (vraag 8, buikomvang)", () => {
  it("opens the nested seed condition as situations", () => {
    const { item, page } = find("waist_cm");
    render(<ConditionModal title="Wanneer tonen we vraag 8, buikomvang?" description="x" alwaysLabel="Altijd tonen" value={(item.show_if ?? page.show_if) as Condition} ctx={ctx} onSave={() => {}} onClose={() => {}} />);
    expect(screen.getByText("Situatie 1")).toBeTruthy();
    expect(screen.getAllByText("ligt tussen").length).toBeGreaterThan(0);
    expect(screen.getByText(/Samengevat:/)).toBeTruthy();
  });
});

describe("question modal (vraag 7, aandoeningen)", () => {
  it("saves a single-question page visibility change without adding an item rule", () => {
    const { item, page } = find("comorbidities");
    const save = vi.fn();
    render(<ItemModal item={item} number={7} questionnaireName={triage.name} questionnaireId="q" def={triage} page={page} flow={flow} ui={{}} itemTypes={[{ value: "multi_choice", label: "Meer keuzes" }]} sections={["Je gewicht"]} section={page.section} rejections={[]} images={[]} ctx={ctx} onSave={save} onClose={() => {}} />);
    const tonen = screen.getByText("Tonen").parentElement;
    if (!tonen) throw new Error("Missing visibility control");
    fireEvent.click(within(tonen).getByText("Wijzig"));
    const conditionDialog = screen.getByRole("dialog", { name: /Wanneer tonen we vraag 7/ });
    fireEvent.click(within(conditionDialog).getByRole("radio", { name: "Altijd tonen" }));
    fireEvent.click(within(conditionDialog).getByRole("button", { name: "Opslaan" }));
    fireEvent.click(screen.getByRole("button", { name: "Opslaan" }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: "comorbidities" }), "Je gewicht", { value: undefined });
    expect(save.mock.calls[0]?.[0].show_if).toBeUndefined();
  });
  it("shows one row per answer with outcome and exclusive pill", () => {
    const { item, page } = find("comorbidities");
    render(<ItemModal item={item} number={7} questionnaireName={triage.name} questionnaireId="q" def={triage} page={page} flow={flow} ui={{}} itemTypes={[{ value: "multi_choice", label: "Meer keuzes" }]} sections={["Je gewicht"]} section={page.section} rejections={[]} images={[]} ctx={ctx} onSave={() => {}} onClose={() => {}} />);
    expect(screen.getByText("Vraag 7 wijzigen")).toBeTruthy();
    expect(screen.getByText("Antwoorden en uitkomst")).toBeTruthy();
    expect(screen.getByText(/Sluit de rest uit/)).toBeTruthy();
    expect(screen.getByText("Voorbeeld voor de patiënt")).toBeTruthy();
    expect(screen.getByText("Open het klikbare scherm")).toBeTruthy();
  });
});
