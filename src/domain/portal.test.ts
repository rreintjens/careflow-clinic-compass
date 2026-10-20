import { describe, expect, it } from "vitest";
import { packageEnd, portalLanding, usablePortalToken, PORTAL_LINK_MINUTES } from "./portal";

describe("patient portal rules", () => {
  it("links expire after ten minutes and cannot be reused", () => {
    expect(PORTAL_LINK_MINUTES).toBe(10);
    const issued = Date.parse("2026-10-20T06:18:00Z"), expires = "2026-10-20T06:28:00Z";
    expect(usablePortalToken(expires, null, issued + 599_999)).toBe(true);
    expect(usablePortalToken(expires, null, issued + 600_000)).toBe(false);
    expect(usablePortalToken(expires, "2026-10-20T06:19:00Z", issued)).toBe(false);
  });
  const p = { order_id: "order", start_date: "2026-08-01", months: 3, status: "active" };
  it("Mark lands on active programme before other conditions", () => expect(portalLanding([p], true, "2026-10-20").kind).toBe("active"));
  it("Sandra lands on consult preparation without a package", () => expect(portalLanding([], true, "2026-10-20").kind).toBe("starter"));
  it("Eva lands on general Start with her stopped date", () => expect(portalLanding([{ ...p, start_date: "2026-05-02" }], true, "2026-10-20")).toMatchObject({ kind: "stopped", stoppedOn: "2026-08-02" }));
  it("Sanne lands on general Start", () => expect(portalLanding([], false, "2026-10-20").kind).toBe("general"));
  it("six single-month lines of one order count as six months", () => expect(portalLanding(Array.from({ length: 6 }, () => ({ ...p, months: 1 })), false, "2026-12-20").kind).toBe("active"));
  it("calendar month duration respects month-end", () => expect(packageEnd("2026-01-31", 1)).toBe("2026-02-28"));
});