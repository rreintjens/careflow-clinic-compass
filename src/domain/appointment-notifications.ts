import { z } from "zod";
export const notificationPlanSchema=z.record(z.enum(["confirmation","rescheduled","appointment_reminder","questionnaire_reminder","details_reminder","cancelled","no_show"]),z.object({email:z.boolean(),sms:z.boolean()}));
export function notificationEnabled(plan:unknown,moment:string,channel:"email"|"sms",notify:string|null):boolean {
  if(notify==="none")return false;
  const parsed=notificationPlanSchema.safeParse(plan);
  const choice=parsed.success?parsed.data[moment as keyof typeof parsed.data]:undefined;
  return choice?choice[channel]:channel==="email";
}
export function validUntil(completedAt:string|null,days:number,at:string,forAppointment=false):boolean {
  if(!completedAt)return false;
  const age=Date.parse(at)-Date.parse(completedAt);
  return Number.isFinite(age)&&age>=0&&(days<=0?forAppointment:age<=days*86_400_000);
}
export function consentValid(requiredKind:string,consents:Array<{kind:string;granted:boolean;created_at:string}>,months:number,at:string):boolean {
  const latest=consents.filter(c=>c.kind===requiredKind&&Date.parse(c.created_at)<=Date.parse(at)).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))[0];
  if(!latest?.granted)return false;
  const expiry=new Date(latest.created_at);expiry.setUTCMonth(expiry.getUTCMonth()+months);
  return months>0&&Date.parse(at)<=expiry.getTime();
}