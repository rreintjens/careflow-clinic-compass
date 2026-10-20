import {it,expect} from "vitest";
import {patientDetailsSchema} from "./patient-details";
const valid={date_of_birth:"1980-01-01",phone:"0612345678",postcode:"1234AB",house_number:"1",house_suffix:"",street:"Demostraat",city:"Utrecht"};
it("missing address data cannot be marked complete",()=>expect(patientDetailsSchema.safeParse({...valid,street:""}).success).toBe(false));
it("complete patient details can be saved",()=>expect(patientDetailsSchema.safeParse(valid).success).toBe(true));
it("a future birth date is rejected",()=>expect(patientDetailsSchema.safeParse({...valid,date_of_birth:"2099-01-01"}).success).toBe(false));