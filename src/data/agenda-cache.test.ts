import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ organisation: vi.fn(), select: vi.fn() }));
vi.mock("./organisation-read.functions", () => ({ getOrganisation: mocks.organisation }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: mocks.select }) } }));

import { agendaRefQuery } from "./agenda";
import { orgQuery } from "./organisation";

describe("shared agenda reference cache", () => {
  it("reuses one organisation read for concurrent agenda and organisation consumers", async () => {
    mocks.organisation.mockResolvedValue({ practitioners: [], treatments: [], categories: [], locations: [], categoryLinks: [], practitionerTreatments: [], practitionerLocations: [], treatmentLocations: [], options: [] });
    mocks.select.mockResolvedValue({ data: [], error: null });
    const client = new QueryClient();
    await Promise.all([client.fetchQuery(agendaRefQuery), client.fetchQuery(orgQuery)]);
    await client.fetchQuery(agendaRefQuery);
    expect(mocks.organisation).toHaveBeenCalledTimes(1);
    expect(mocks.select).toHaveBeenCalledTimes(2);
    await client.invalidateQueries({ queryKey: ["agenda-ref"] });
    await client.fetchQuery(agendaRefQuery);
    expect(mocks.organisation).toHaveBeenCalledTimes(1);
    expect(mocks.select).toHaveBeenCalledTimes(4);
    client.clear();
  });
});