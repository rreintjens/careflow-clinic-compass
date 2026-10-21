import {describe,it,expect,vi} from 'vitest';
import {databaseClient,testRoleSession,integrationEnabled} from './database-client';
vi.setConfig({testTimeout:30000});
describe.skipIf(!integrationEnabled)('Invoice access and atomic settlement',()=>{
 it('rejects a forged unit price without creating a settlement',async()=>{
  const {client}=await testRoleSession('admin@example.test');
  const appointment='d6100000-0000-4000-8000-000000000004';
  const a=await client.from('appointments').select('treatment_id').eq('id',appointment).single();if(!a.data)throw new Error('Missing demo billing appointment');
  const t=await client.from('treatments').select('price_cents').eq('id',a.data.treatment_id).single();if(!t.data)throw new Error('Missing price');
  const result=await client.rpc('settle_appointment',{_appointment:appointment,_lines:[{treatmentId:a.data.treatment_id,qty:1,priceCents:(t.data.price_cents??0)+1,discountCents:0}],_payments:[],_without_invoice:true,_reason:'Demo-controle'});
  expect(result.error?.message).toContain('prijs is gewijzigd');
  const read=await client.from('billing_settlements').select('id').eq('appointment_id',appointment);expect(read.data??[]).toHaveLength(0);
 });
 it('rejects an oversized no-invoice reason at the database boundary',async()=>{
  const {client}=await testRoleSession('admin@example.test');const appointment='d6100000-0000-4000-8000-000000000004';
  const a=await client.from('appointments').select('treatment_id').eq('id',appointment).single();if(!a.data)throw new Error('Missing appointment');
  const t=await client.from('treatments').select('price_cents').eq('id',a.data.treatment_id).single();if(!t.data)throw new Error('Missing price');
  const result=await client.rpc('settle_appointment',{_appointment:appointment,_lines:[{treatmentId:a.data.treatment_id,qty:1,priceCents:t.data.price_cents??0,discountCents:0}],_payments:[],_without_invoice:true,_reason:'x'.repeat(2001)});
  expect(result.error?.message).toContain('maximaal 2000');
  const read=await client.from('billing_settlements').select('id').eq('appointment_id',appointment);expect(read.data??[]).toHaveLength(0);
 });
 it('anonymous callers cannot read or settle appointments',async()=>{
  const db=databaseClient();const read=await db.from('billing_settlements').select('id');expect(read.data??[]).toHaveLength(0);
  const save=await db.rpc('settle_appointment',{_appointment:'00000000-0000-4000-8000-000000000001',_lines:[],_payments:[],_without_invoice:false,_reason:''});expect(save.error).not.toBeNull();
 });
 it('medical-only staff cannot settle or read invoices',async()=>{
  const {client}=await testRoleSession('arts@example.test');const perm=await client.rpc('has_permission',{_perm:'billing.till'});expect(perm.data).toBe(false);
  const read=await client.from('billing_settlements').select('id');expect(read.data??[]).toHaveLength(0);
  const save=await client.rpc('settle_appointment',{_appointment:'00000000-0000-4000-8000-000000000001',_lines:[],_payments:[],_without_invoice:true,_reason:'Test'});expect(save.error).not.toBeNull();
 });
 it('paid invoice is immutable and contains no medical question answers',async()=>{
  const db=databaseClient(true);const invoice=await db.from('billing_settlements').select('*').eq('invoice_number','2026-000001').single();expect(invoice.error).toBeNull();if(!invoice.data)throw new Error('Missing verified demo invoice');
  expect(invoice.data.total_cents).toBe(28000);expect(invoice.data.vat_cents).toBe(4860);
  for(const line of Array.isArray(invoice.data.lines)?invoice.data.lines:[])expect(line).not.toHaveProperty('lot');expect(invoice.data.fiscal_snapshot).not.toHaveProperty('answers');
  const {client}=await testRoleSession('admin@example.test');const update=await client.from('billing_settlements').update({total_cents:1}).eq('id',invoice.data.id).select('id');expect(update.data??[]).toHaveLength(0);
  const privilegedUpdate=await db.from('billing_settlements').update({total_cents:1}).eq('id',invoice.data.id);expect(privilegedUpdate.error?.message).toContain('kan niet worden gewijzigd');
  const before=await db.from('billing_settlements').select('id').eq('appointment_id',invoice.data.appointment_id);
  const duplicate=await client.rpc('settle_appointment',{_appointment:invoice.data.appointment_id,_lines:invoice.data.lines,_payments:invoice.data.payments,_without_invoice:false,_reason:''});expect(duplicate.error).not.toBeNull();
  const after=await db.from('billing_settlements').select('id').eq('appointment_id',invoice.data.appointment_id);expect(after.data).toEqual(before.data);
 });
 it('financial projection returns only amounts and exemption, not medical data',async()=>{
  const db=databaseClient(true);const invoice=await db.from('billing_settlements').select('appointment_id').eq('invoice_number','2026-000001').single();if(!invoice.data)throw new Error('Missing verified invoice');
  const {client}=await testRoleSession('admin@example.test');const r=await client.rpc('billing_projection',{_appointment:invoice.data.appointment_id});expect(r.error).toBeNull();
  expect(Object.keys(r.data as object).sort()).toEqual(['exempt','lines']);
  const result=r.data as {lines:Array<Record<string,unknown>>};expect(result.lines.length).toBeGreaterThan(0);for(const line of result.lines)expect(Object.keys(line).sort()).toEqual(['priceCents','qty','treatmentId','unit']);
  const anonymous=await databaseClient().rpc('billing_projection',{_appointment:invoice.data.appointment_id});expect(anonymous.error).not.toBeNull();
 });
});