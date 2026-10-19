import { describe, expect, it } from "vitest";
import { configurationChanges, configOfDefinition } from "./version-config";
import { evalCondition, makeCtx, type QuestionnaireDef } from "./engine";
import { joinFlow, splitFlow } from "./io";

const config = (n: number) => ({ settings: { bmi: { direct_from: n } }, computed_fields: {} });
const def = (n: number): QuestionnaireDef => ({ id: "q", name: "Q", moment: "before_booking", pages: [], version_config: config(n) });
describe("version-owned thresholds", () => {
  it("keeps live 30 while concept uses 29", () => {
    const live = makeCtx(configOfDefinition(def(30), config(29)), { bmi: 29.5 }, "2026-10-19");
    const draft = makeCtx(configOfDefinition(def(29), config(30)), { bmi: 29.5 }, "2026-10-19");
    const condition = { all: [{ field: "bmi", op: "gte" as const, value: "settings.bmi.direct_from" }] };
    expect(evalCondition(condition, live)).toBe(false);
    expect(evalCondition(condition, draft)).toBe(true);
  });
  it("counts a changed threshold independently of question changes", () => expect(configurationChanges(config(30), config(29))).toEqual(["BMI vanaf waar direct door: 30 wordt 29"]));
  it("retains version settings through export/import", () => {
    const file = joinFlow({ meta: {}, ...config(31) }, [def(30), def(29)]);
    const imported = splitFlow(JSON.parse(JSON.stringify(file)));
    expect(configOfDefinition(imported.questionnaires[0] as QuestionnaireDef, imported.document).settings).toEqual({ bmi: { direct_from: 30 } });
    expect(configOfDefinition(imported.questionnaires[1] as QuestionnaireDef, imported.document).settings).toEqual({ bmi: { direct_from: 29 } });
  });
});