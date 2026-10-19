import { describe, expect, it } from "vitest";
import { allowlisted } from "./mail";

describe("demo mail allowlist", () => {
  it("delivers to Rob by default", () => expect(allowlisted("rob@bodyclinic.nl", "Rob@BodyClinic.nl")).toBe(true));
  it("keeps patients demo-only", () => expect(allowlisted("rob@bodyclinic.nl", "sanne.test@example.test")).toBe(false));
  it("accepts several addresses", () => expect(allowlisted("a@x.nl, rob@bodyclinic.nl", "rob@bodyclinic.nl")).toBe(true));
  it("sends nothing when the list is empty", () => expect(allowlisted("", "rob@bodyclinic.nl")).toBe(false));
});
