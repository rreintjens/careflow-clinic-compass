import { describe, expect, it } from "vitest";

import {
  absoluteBookingLink,
  absoluteBookingLinkUtm,
  bookingLinkPath,
  bookingLinkUtm,
  scopeTreatments,
  scopePractitioners,
  scopeUnbookable,
  linkLocations,
  linkPractitioners,
  linkProblem,
  uniqueSlug,
  type LinkCatalog,
  type LinkDraft,
} from "./booking-links";

const cat = (over: Partial<LinkCatalog> = {}): LinkCatalog => ({
  treatments: [
    { id: "t1", locations: ["L1", "L2", "ON"] },
    { id: "t2", locations: ["L1"] },
  ],
  practitioners: [
    { id: "p1", treatments: ["t1", "t2"], locations: ["L1", "L2"] },
    { id: "p2", treatments: ["t1"], locations: ["ON"] },
    { id: "p3", treatments: ["t2"], locations: ["L2"] },
  ],
  ...over,
});
const draft = (over: Partial<LinkDraft> = {}): LinkDraft => ({ treatment_id: null, location_ids: [], practitioner_mode: null, practitioner_id: null, ...over });

describe("linkLocations", () => {
  it("keeps every chosen location when the patient may still choose a treatment", () => {
    expect(linkLocations(cat(), draft({ location_ids: ["L1", "L2"] }))).toEqual(["L1", "L2"]);
  });
  it("drops a location that does not offer the fixed treatment", () => {
    expect(linkLocations(cat(), draft({ treatment_id: "t2", location_ids: ["L1", "L2"] }))).toEqual(["L1"]);
  });
  it("removes duplicates", () => {
    expect(linkLocations(cat(), draft({ location_ids: ["L1", "L1", "L2"] }))).toEqual(["L1", "L2"]);
  });
});

describe("linkPractitioners", () => {
  it("lists who does the treatment at a location of the link", () => {
    expect(linkPractitioners(cat(), draft({ treatment_id: "t1", location_ids: ["L1", "ON"] }))).toEqual(["p1", "p2"]);
  });
  it("nobody when the treatment is not offered at the chosen location", () => {
    expect(linkPractitioners(cat(), draft({ treatment_id: "t2", location_ids: ["L2"] }))).toEqual([]);
  });
});

describe("linkProblem", () => {
  it("needs a location the treatment is offered at", () => {
    expect(linkProblem(cat(), draft())).toBe("no_location");
    expect(linkProblem(cat(), draft({ treatment_id: "t2", location_ids: ["L2"] }))).toBe("no_location");
    expect(linkProblem(cat(), draft({ location_ids: ["L1"] }))).toBeNull();
  });
  it("a fixed practitioner must be chosen and must work at that location", () => {
    const fixed = { practitioner_mode: "fixed" };
    expect(linkProblem(cat(), draft({ treatment_id: "t1", location_ids: ["L1"], ...fixed }))).toBe("no_practitioner");
    expect(linkProblem(cat(), draft({ treatment_id: "t1", location_ids: ["L1"], practitioner_id: "p2", ...fixed }))).toBe("practitioner_unavailable");
    expect(linkProblem(cat(), draft({ treatment_id: "t1", location_ids: ["L1"], practitioner_id: "p1", ...fixed }))).toBeNull();
  });
});

it("a link opens the booking flow with its slug", () => {
  expect(bookingLinkPath("instagram-oktober")).toBe("/boeken?link=instagram-oktober");
  expect(absoluteBookingLink("x1", "boek.bodyclinic.nl")).toBe("https://boek.bodyclinic.nl/boeken?link=x1");
  expect(absoluteBookingLink("x1", null)).toBe("/boeken?link=x1");
});

describe("uniqueSlug", () => {
  it("reads the name and stays free", () => {
    expect(uniqueSlug([], "Instagram oktober!")).toBe("instagram-oktober");
    expect(uniqueSlug(["instagram-oktober"], "Instagram oktober")).toBe("instagram-oktober-2");
    expect(uniqueSlug(["link"], "")).toBe("link-2");
    expect(uniqueSlug(["a"], "Réflexologie ─┤")).toBe("reflexologie");
  });
});

describe("bookingLinkUtm", () => {
  it("tags the link with the reporting source and the slug as campaign", () => {
    expect(bookingLinkUtm("instagram-oktober", "Instagram oktober")).toBe("/boeken?link=instagram-oktober&utm_source=instagram-oktober&utm_campaign=instagram-oktober");
    expect(bookingLinkUtm("zomer-2026", "Google Ads")).toBe("/boeken?link=zomer-2026&utm_source=google-ads&utm_campaign=zomer-2026");
  });
  it("falls back to the slug when there is no source", () => {
    expect(bookingLinkUtm("ziekenhuis-flyer", "")).toBe("/boeken?link=ziekenhuis-flyer&utm_source=ziekenhuis-flyer&utm_campaign=ziekenhuis-flyer");
    expect(bookingLinkUtm("ziekenhuis-flyer", "  ")).toBe("/boeken?link=ziekenhuis-flyer&utm_source=ziekenhuis-flyer&utm_campaign=ziekenhuis-flyer");
  });
  it("builds an absolute UTM link for a host", () => {
    expect(absoluteBookingLinkUtm("x1", "Radio", "boek.bodyclinic.nl")).toBe("https://boek.bodyclinic.nl/boeken?link=x1&utm_source=radio&utm_campaign=x1");
    expect(absoluteBookingLinkUtm("x1", "", null)).toBe("/boeken?link=x1&utm_source=x1&utm_campaign=x1");
  });
});


describe("multi-treatment scope",()=>{
 const c:LinkCatalog={categories:[{id:"MA",parent_id:null},{id:"child",parent_id:"MA"}],treatments:[{id:"consult",categories:["MA"],locations:["online"]},{id:"new",categories:["child"],locations:["online"]},{id:"cosmetic",categories:["other"],locations:["clinic"]}],practitioners:[{id:"rob",treatments:["consult","new"],locations:["online"]},{id:"dilan",treatments:["consult"],locations:["online"]},{id:"other",treatments:["consult"],locations:["online"]}]};
 const d={...draft(),category_ids:["MA"],location_ids:["online"],practitioner_scope:"selected" as const,practitioner_ids:["rob","dilan"]};
 it("whole Medisch afvallen includes subsequently added subcategory treatments",()=>expect(scopeTreatments(c,d)).toEqual(["consult","new"]));
 it("only the two selected doctors are offered",()=>expect(scopePractitioners(c,d,"consult","online")).toEqual(["rob","dilan"]));
 it("flags treatments without a selected practitioner at the location",()=>expect(scopeUnbookable(c,{...d,practitioner_ids:["dilan"]})).toEqual(["new"]));
 it("respects exclusions at individual locations",()=>expect(scopePractitioners({...c,practitioners:[{id:"rob",treatments:["consult"],locations:["online"],exclusions:[{treatment_id:"consult",excluded_location_ids:["online"]}]}]},d,"consult")).toEqual([]));
});
