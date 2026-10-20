import {expect,it} from "vitest";
import {notificationEnabled,validUntil} from "./appointment-notifications";
it("a disabled reminder does not send while confirmation remains enabled",()=>{
 const plan={confirmation:{email:true,sms:false},appointment_reminder:{email:false,sms:true}};
 expect(notificationEnabled(plan,"confirmation","email","as_usual")).toBe(true);
 expect(notificationEnabled(plan,"appointment_reminder","email","as_usual")).toBe(false);
 expect(notificationEnabled(plan,"appointment_reminder","sms","as_usual")).toBe(true);
});
it("do not send overrides all channels",()=>expect(notificationEnabled({confirmation:{email:true,sms:true}},"confirmation","sms","none")).toBe(false));
it("questionnaire validity expires at its configured number of days",()=>{
 expect(validUntil("2026-10-01T12:00:00Z",20,"2026-10-21T12:00:00Z")).toBe(true);
 expect(validUntil("2026-10-01T12:00:00Z",20,"2026-10-21T12:00:01Z")).toBe(false);
 expect(validUntil(null,20,"2026-10-21T12:00:00Z")).toBe(false);
});