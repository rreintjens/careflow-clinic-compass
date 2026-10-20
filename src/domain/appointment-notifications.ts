import { z } from "zod";
export const notificationPlanSchema=z.record(z.enum(["confirmation","rescheduled","appointment_reminder","questionnaire_reminder","cancelled","no_show"]),z.object({email:z.boolean(),sms:z.boolean()}));
export function notificationEnabled(plan:unknown,moment:string,channel:"email"|"sms",notify:string|null):boolean {
  if(notify==="none")return false;
  const parsed=notificationPlanSchema.safeParse(plan);
  const choice=parsed.success?parsed.data[moment as keyof typeof parsed.data]:undefined;
  return choice?choice[channel]:channel==="email";
}
export function validUntil(completedAt:string|null,days:number,at:string):boolean {
  if(!completedAt)return false;
  const age=Date.parse(at)-Date.parse(completedAt);
  return Number.isFinite(age)&&age>=0&&(days<=0||age<=days*86_400_000);
}