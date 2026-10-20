import {expect,it} from "vitest";
import {notificationEnabled,validUntil,consentValid} from "./appointment-notifications";
it("a disabled reminder does not send while confirmation remains enabled",()=>{
 const plan={confirmation:{email:true,sms:false},appointment_reminder:{email:false,sms:true}};
 expect(notificationEnabled(plan,"confirmation","email","as_usual")).toBe(true);
 expect(notificationEnabled(plan,"appointment_reminder","email","as_usual")).toBe(false);
 expect(notificationEnabled(plan,"appointment_reminder","sms","as_usual")).toBe(true);
});
it("zero-day questionnaires must be completed for this appointment",()=>{
 expect(validUntil("2026-10-20T12:00:00Z",0,"2026-10-21T12:00:00Z")).toBe(false);
 expect(validUntil("2026-10-20T12:00:00Z",0,"2026-10-21T12:00:00Z",true)).toBe(true);
});
it("privacy permission is not treatment consent",()=>expect(consentValid("Botox",[{kind:"privacy",granted:true,created_at:"2026-10-20T12:00:00Z"}],12,"2026-10-21T12:00:00Z")).toBe(false));
it("consent expires after the template's configured months",()=>{
 const rows=[{kind:"Botox",granted:true,created_at:"2025-10-21T12:00:00Z"}];
 expect(consentValid("Botox",rows,12,"2026-10-21T12:00:00Z")).toBe(true);
 expect(consentValid("Botox",rows,12,"2026-10-21T12:00:01Z")).toBe(false);
});
it("a later withdrawal overrides earlier consent",()=>expect(consentValid("Botox",[{kind:"Botox",granted:true,created_at:"2026-10-01T12:00:00Z"},{kind:"Botox",granted:false,created_at:"2026-10-20T12:00:00Z"}],12,"2026-10-21T12:00:00Z")).toBe(false));
it("do not send overrides all channels",()=>expect(notificationEnabled({confirmation:{email:true,sms:true}},"confirmation","sms","none")).toBe(false));
it("questionnaire validity expires at its configured number of days",()=>{
 expect(validUntil("2026-10-01T12:00:00Z",20,"2026-10-21T12:00:00Z")).toBe(true);
 expect(validUntil("2026-10-01T12:00:00Z",20,"2026-10-21T12:00:01Z")).toBe(false);
 expect(validUntil(null,20,"2026-10-21T12:00:00Z")).toBe(false);
});