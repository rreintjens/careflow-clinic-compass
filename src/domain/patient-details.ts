import {z} from "zod";
/** Identity fields shared by the patient profile and authenticated save. */
export const patientDetailsSchema=z.object({
 date_of_birth:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&v<=new Date().toISOString().slice(0,10),"Kies een geldige geboortedatum."),
 phone:z.string().trim().min(6).max(20),postcode:z.string().trim().min(3).max(10),house_number:z.string().trim().min(1).max(10),
 house_suffix:z.string().trim().max(10),street:z.string().trim().min(1).max(120),city:z.string().trim().min(1).max(80),
});