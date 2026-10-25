import { expect, it } from 'vitest';
import { missingGroupLocations, type BookingCoverage } from './menu-bookability';
import type { MenuData } from './menu';
const menu: MenuData = { groups: [{id:'g',parent_id:null,sort:0}], roots:[], links:['target','a','b','c'].map((id,sort)=>({treatment_id:id,category_id:'g',sort})) };
const row = (id:string, bookable:string[], kind='behandeling'):BookingCoverage => ({id,bookable,kind});
it('warns for Den Bosch when most other Profhilo treatments are bookable there',()=>{
 expect(missingGroupLocations(menu,[row('target',['Blaricum']),row('a',['Blaricum','Den Bosch']),row('b',['Den Bosch']),row('c',[])],'target',['Blaricum','Den Bosch'])).toEqual(['Den Bosch']);
});
it('does not treat a tie as a majority',()=>{
 expect(missingGroupLocations(menu,[row('target',['Blaricum']),row('a',['Den Bosch']),row('b',['Blaricum'])],'target',['Blaricum','Den Bosch'])).toEqual([]);
});
it('uses the consult for a singleton treatment and finds PhilArt Eye missing in Blaricum',()=>{
 expect(missingGroupLocations(menu,[row('target',['Den Bosch']),row('a',['Den Bosch','Blaricum'],'consult')],'target',['Den Bosch','Blaricum'])).toEqual(['Blaricum']);
});
it('does not warn that online coach conversations are absent from clinics',()=>{
 expect(missingGroupLocations(menu,[row('target',['Online']),row('a',['Eindhoven'],'consult')],'target',['Eindhoven'])).toEqual([]);
});
it('keeps an unavailable treatment without coverage in the warning comparison',()=>{
 expect(missingGroupLocations(menu,[row('target',[]),row('a',['Utrecht'])],'target',['Utrecht'])).toEqual(['Utrecht']);
});
it('does not compare consult specialties in the general directory',()=>{
 expect(missingGroupLocations(menu,[row('target',['Utrecht'],'consult'),row('a',['Eindhoven'],'consult')],'target',['Utrecht','Eindhoven'])).toEqual([]);
});

it('finds Eindhoven for the singleton medical weight loss consult via its other consult placement',()=>{
 const m:MenuData={groups:[{id:'consults',parent_id:null,sort:0},{id:'start',parent_id:null,sort:1}],roots:[],links:[{treatment_id:'target',category_id:'start',sort:0},{treatment_id:'target',category_id:'consults',sort:0},{treatment_id:'a',category_id:'consults',sort:1}]};
 expect(missingGroupLocations(m,[row('target',['Utrecht'],'consult'),row('a',['Utrecht','Eindhoven'],'consult')],'target',['Utrecht','Eindhoven'])).toEqual(['Eindhoven']);
});
it('finds Utrecht missing for Coagulatie meerdere plekjes',()=>{
 expect(missingGroupLocations(menu,[row('target',['Rotterdam']),row('a',['Rotterdam','Utrecht']),row('b',['Rotterdam','Utrecht'],'consult')],'target',['Rotterdam','Utrecht'])).toEqual(['Utrecht']);
});
