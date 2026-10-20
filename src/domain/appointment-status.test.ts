import { describe, expect, it } from "vitest";
import { agendaStatuses, authorizedDoubleBooking, blocksAppointment, receptionTransitions } from "./appointment-status";
describe("shared appointment status", () => {
  it("double booking requires both permission and a recorded reason", () => {
    expect(authorizedDoubleBooking(false, "Medisch noodzakelijk")).toBe(false);
    expect(authorizedDoubleBooking(true, " ")).toBe(false);
    expect(authorizedDoubleBooking(true, "Medisch noodzakelijk")).toBe(true);
  });
  it("keeps arrivals visible in agenda and Mijn dag", () => expect(agendaStatuses).toContain("gearriveerd"));
  it("supports no_show", () => expect(receptionTransitions("booked")).toContain("no_show"));
  it.each(["tentatief", "gearriveerd", "in_behandeling", "klaar_voor_betaling", "afgerond"])("%s still protects the booked time", status => expect(blocksAppointment(status, null, 100)).toBe(true));
  it("expired holds release time", () => expect(blocksAppointment("held", 99, 100)).toBe(false));
  it("cancelled and no show release time", () => { expect(blocksAppointment("cancelled", null, 100)).toBe(false); expect(blocksAppointment("no_show", null, 100)).toBe(false); });
  it("reception cannot bypass payment by completing a consultation", () => expect(receptionTransitions("klaar_voor_betaling")).not.toContain("afgerond"));
});