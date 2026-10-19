import { describe,expect,it } from "vitest";
import { contactSchema,requestDestination,requestSchema } from "./dossier-entries";
const id="11111111-1111-4111-8111-111111111111";
const request={id:null,patientId:id,kind:"package",durationMonths:1,explanation:"",destination:"pharmacy",practitionerId:null,status:"open"};
describe("owner approved dossier rules",()=>{
 it.each([["package","pharmacy"],["repeat","pharmacy"],["doctor_question","doctor"]])("defaults %s to %s",(kind,to)=>expect(requestDestination(kind)).toBe(to));
 it.each([1,2,3,6])("accepts a %s month package",n=>expect(requestSchema.safeParse({...request,durationMonths:n}).success).toBe(true));
 it("rejects 4 months",()=>expect(requestSchema.safeParse({...request,durationMonths:4}).success).toBe(false));
 it.each(["open","in_progress","completed"])("accepts status %s",status=>expect(requestSchema.safeParse({...request,status}).success).toBe(true));
 it("requires doctor for doctor destination",()=>expect(requestSchema.safeParse({...request,destination:"doctor"}).success).toBe(false));
 it("internal notes need no direction",()=>expect(contactSchema.safeParse({id:null,patientId:id,kind:"internal",direction:null,subject:"Notitie",body:"",occurredAt:"2026-10-19T11:00:00Z",followUp:null,assignedTo:null,dueOn:null}).success).toBe(true));
 it("followup requires staff and due date",()=>expect(contactSchema.safeParse({id:null,patientId:id,kind:"internal",direction:null,subject:"Notitie",body:"",occurredAt:"2026-10-19T11:00:00Z",followUp:"Terugbellen",assignedTo:null,dueOn:null}).success).toBe(false));
});