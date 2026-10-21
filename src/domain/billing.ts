import { z } from 'zod';

export const billingLineSchema = z.object({ treatmentId:z.string().uuid(), name:z.string().min(1), qty:z.number().positive().max(10000), unit:z.string(), priceCents:z.number().int().nonnegative(), discountCents:z.number().int().nonnegative(), vatRate:z.number().min(0).max(100) });
export const settlementSchema = z.object({ appointmentId:z.string().uuid(), lines:z.array(billingLineSchema).min(1).max(100), payments:z.array(z.object({ method:z.string().min(1), amountCents:z.number().int().positive() })).max(10), withoutInvoice:z.boolean(), reason:z.string().max(2000) });
export type BillingLine=z.infer<typeof billingLineSchema>;
export type Settlement=z.infer<typeof settlementSchema>;
export function billingTotals(lines:BillingLine[]) {
 const rows=lines.map(l=>{const gross=Math.round(l.qty*l.priceCents);if(l.discountCents>gross)throw new Error('Korting is hoger dan het regelbedrag.');const total=gross-l.discountCents;return {...l,totalCents:total,vatCents:Math.round(total*l.vatRate/(100+l.vatRate))};});
 return {rows,totalCents:rows.reduce((s,l)=>s+l.totalCents,0),vatCents:rows.reduce((s,l)=>s+l.vatCents,0)};
}
export function validateSettlement(input:Settlement) {
 const d=settlementSchema.parse(input);const totals=billingTotals(d.lines);
 if(d.withoutInvoice){if(!d.reason.trim())throw new Error('Geef een reden voor afsluiten zonder factuur.');if(d.payments.length)throw new Error('Zonder factuur kan geen betaling worden vastgelegd.');}
 else if(d.payments.reduce((s,p)=>s+p.amountCents,0)!==totals.totalCents)throw new Error('De betalingen moeten samen het totaalbedrag zijn.');
 return {...d,...totals};
}
export interface BillingPaymentProvider { pay(payments:Settlement['payments']):Promise<{paid:boolean}> }
export const mockBillingPaymentProvider:BillingPaymentProvider={pay:async()=>({paid:true})};