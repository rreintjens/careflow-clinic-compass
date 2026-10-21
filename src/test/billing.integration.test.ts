import {describe,it,expect,vi} from 'vitest';
import {databaseClient,testRoleSession,integrationEnabled} from './database-client';
vi.setConfig({testTimeout:30000});
describe.skipIf(!integrationEnabled)('Invoice access and atomic settlement',()=>{
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
});