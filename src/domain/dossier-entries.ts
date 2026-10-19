import { z } from "zod";
export const requestDestination = (kind: string) => kind === "doctor_question" ? "doctor" : "pharmacy";
const base = { id: z.string().uuid().nullable(), patientId: z.string().uuid() };
export const contactSchema = z.object({ ...base, kind: z.enum(["phone", "email", "whatsapp", "internal"]), direction: z.enum(["incoming", "outgoing"]).nullable(), subject: z.string().trim().min(1).max(200), body: z.string().max(20000), occurredAt: z.string().datetime(), followUp: z.string().trim().max(500).nullable(), assignedTo: z.string().uuid().nullable(), dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }).superRefine((v,c) => {
  if (v.kind !== "internal" && !v.direction) c.addIssue({ code: "custom", path: ["direction"], message: "Kies een richting" });
  if (v.followUp && (!v.assignedTo || !v.dueOn)) c.addIssue({ code: "custom", path: ["followUp"], message: "Kies voor wie en uiterlijk wanneer" });
});
export const requestSchema = z.object({ ...base, kind: z.enum(["package", "repeat", "doctor_question"]), durationMonths: z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(6)]).nullable(), explanation: z.string().max(20000), destination: z.enum(["pharmacy","doctor"]), practitionerId: z.string().uuid().nullable(), status: z.enum(["open","in_progress","completed"]) }).superRefine((v,c) => {
  if (v.kind === "package" && !v.durationMonths) c.addIssue({code:"custom",path:["durationMonths"],message:"Kies een duur"});
  if (v.destination === "doctor" && !v.practitionerId) c.addIssue({code:"custom",path:["practitionerId"],message:"Kies een arts"});
});