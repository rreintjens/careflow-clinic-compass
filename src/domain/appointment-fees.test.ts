import {expect,it} from "vitest";
import {cancellationFee} from "./appointment-fees";
it("a no-show uses the configured fee",()=>expect(cancellationFee("no_show","2026-10-21T10:00:00Z",0,{hours:48,feeCents:6000})).toBe(6000));
it("a cancellation before the deadline has no fee",()=>expect(cancellationFee("cancelled","2026-10-21T10:00:00Z",Date.parse("2026-10-19T10:00:00Z"),{hours:48,feeCents:6000})).toBe(0));
it("a late cancellation uses the configured fee",()=>expect(cancellationFee("cancelled","2026-10-21T10:00:00Z",Date.parse("2026-10-20T10:00:00Z"),{hours:48,feeCents:6000})).toBe(6000));
it("a booked appointment cannot be charged a cancellation fee",()=>expect(cancellationFee("booked","2026-10-21T10:00:00Z",Date.parse("2026-10-20T10:00:00Z"),{hours:48,feeCents:6000})).toBe(0));