import { expect,it } from "vitest";
import { freeSlots,type SlotBlock } from "./slots";
const block:SlotBlock={practitioner_id:"doctor",weekday:1,location_id:"clinic",starts:"09:00",ends:"17:00",recurrence:"weekly",valid_from:"2026-10-19",valid_until:null,treatment_ids:null,allows_online:true};
it("excludes eKis 13:00–15:00 for both online and clinic, including overlapping starts",()=>{
 for(const locationId of ["clinic","online"]){const slots=freeSlots({date:"2026-10-19",locationId,treatmentId:"t",durationMin:30,practitionerIds:["doctor"],blocks:[block],exceptions:[],busy:[{practitioner_id:"doctor",date:"2026-10-19",start:780,end:900}],now:{date:"2026-10-19",minute:0},leadMinutes:0,maxAheadWeeks:4,onlineLocationIds:["online"]});expect(slots.some(x=>x.start===750)).toBe(true);expect(slots.some(x=>x.start===765)).toBe(false);expect(slots.filter(x=>x.start>=780&&x.start<900)).toEqual([]);expect(slots.some(x=>x.start===900)).toBe(true);}
});