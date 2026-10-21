import {describe,it,expect} from 'vitest';
import {billingTotals,validateSettlement,type Settlement} from './billing';
const base:Settlement={appointmentId:'00000000-0000-4000-8000-000000000001',lines:[{treatmentId:'00000000-0000-4000-8000-000000000002',name:'Botox',qty:2,unit:'zones',priceCents:10000,discountCents:1000,vatRate:21}],payments:[{method:'pin',amountCents:19000}],withoutInvoice:false,reason:''};
describe('Afrekenen',()=>{
 it('regelkorting wordt van het regelbedrag afgetrokken',()=>expect(billingTotals(base.lines).totalCents).toBe(19000));
 it('btw wordt uit het inclusief-bedrag berekend',()=>expect(billingTotals(base.lines).vatCents).toBe(3298));
 it('betalingsplits moeten samen het volledige bedrag dekken',()=>{expect(validateSettlement({...base,payments:[{method:'pin',amountCents:9000},{method:'cash',amountCents:10000}]}).totalCents).toBe(19000);expect(()=>validateSettlement({...base,payments:[{method:'pin',amountCents:9000}]})).toThrow();});
 it('zonder factuur afsluiten vereist een reden',()=>{expect(()=>validateSettlement({...base,withoutInvoice:true,payments:[]})).toThrow();expect(validateSettlement({...base,withoutInvoice:true,payments:[],reason:'Demo coulance'}).withoutInvoice).toBe(true);});
 it('zonder factuur mag geen betaling geregistreerd worden',()=>expect(()=>validateSettlement({...base,withoutInvoice:true,reason:'Coulance'})).toThrow());
 it('korting kan niet hoger zijn dan de regel',()=>expect(()=>billingTotals(base.lines.map(l=>({...l,discountCents:21000})))).toThrow());
 it('vrijgestelde regels hebben geen btw',()=>expect(billingTotals(base.lines.map(l=>({...l,vatRate:0}))).vatCents).toBe(0));
});