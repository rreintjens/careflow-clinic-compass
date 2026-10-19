import { describe, expect, it } from "vitest";
import { filterPickerOptions, togglePickerGroup } from "./picker";

describe("shared picker rules", () => {
  const options = [
    { value: "doctor", label: "Renée", group: "Arts", detail: "Amsterdam · Keizersgracht 100" },
    { value: "blocked", label: "Rob", group: "Arts", disabled: true, reason: "Doet deze behandeling niet" },
  ];
  it("finds names, role and address, including accents", () => {
    expect(filterPickerOptions(options, "renee arts keizersgracht").map(x => x.value)).toEqual(["doctor"]);
    expect(filterPickerOptions(options, "Utrecht")).toEqual([]);
  });
  it("selects only eligible members of a group and preserves other selections", () => {
    expect(togglePickerGroup(["other"], options)).toEqual(["other", "doctor"]);
    expect(togglePickerGroup(["other", "doctor"], options)).toEqual(["other"]);
  });
});