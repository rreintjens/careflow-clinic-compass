import {describe,it,expect,vi} from 'vitest';
import {databaseClient,testRoleSession,integrationEnabled} from './database-client';
vi.setConfig({testTimeout:30000});
describe.skipIf(!integrationEnabled)('Formulieren versies en isolatie',()=>{
 it('anonieme bezoekers kunnen formulieren niet lezen of publiceren',async()=>{
  const db=databaseClient();const read=await db.from('care_form_versions').select('id');expect(read.data??[]).toHaveLength(0);
  const publish=await db.rpc('manage_care_form',{_action:'publish',_id:'00000000-0000-4000-8000-000000000001'});expect(publish.error).not.toBeNull();
 });
 it('nieuwe publicatie verandert een bestaand consultsnapshot niet',async()=>{
  const admin=databaseClient(true);const {client}=await testRoleSession('admin@example.test');
  const tid=await client.rpc('current_tenant');if(!tid.data)throw new Error('Missing tenant');
  const form=await client.from('care_form_versions').select('*').eq('kind','consent').eq('status','live').limit(1).single();if(!form.data)throw new Error('Missing live form');
  const notes=await admin.from('consult_notes').select('id,care_form_snapshot').eq('tenant_id',tid.data).in('status',['draft','parked']);expect(notes.error).toBeNull();expect(notes.data?.length).toBeGreaterThan(0);
  const concept=await client.rpc('manage_care_form',{_action:'concept',_id:form.data.id});expect(concept.error).toBeNull();if(!concept.data)throw new Error('Missing concept');
  const changed=await client.rpc('manage_care_form',{_action:'save',_id:concept.data,_name:form.data.name,_nl:form.data.text_nl,_en:form.data.text_en});expect(changed.error).toBeNull();
  const published=await client.rpc('manage_care_form',{_action:'publish',_id:concept.data});expect(published.error).toBeNull();
  const versions=await client.from('care_form_versions').select('id,status').eq('code',form.data.code);expect(versions.data?.filter(v=>v.status==='live')).toHaveLength(1);expect(versions.data?.find(v=>v.id===form.data?.id)?.status).toBe('archived');
  const after=await admin.from('consult_notes').select('id,care_form_snapshot').eq('tenant_id',tid.data).in('status',['draft','parked']);expect(after.data).toEqual(notes.data);
  const mutate=await client.from('care_form_versions').update({text_nl:'Invalid rewrite'}).eq('id',published.data??'').select('id');expect(mutate.data??[]).toHaveLength(0);
  const unchanged=await client.from('care_form_versions').select('text_nl').eq('id',concept.data).single();expect(unchanged.data?.text_nl).toBe(form.data.text_nl);
 });
 it('een andere kliniek ziet geen formulier buiten de actieve kliniek',async()=>{
  const admin=databaseClient(true);const {client}=await testRoleSession('admin@example.test');const tid=await client.rpc('current_tenant');if(!tid.data)throw new Error('Missing tenant');
  const other=await admin.from('care_form_versions').select('id').neq('tenant_id',tid.data).limit(1).single();if(!other.data)throw new Error('Missing other tenant form');
  const read=await client.from('care_form_versions').select('id').eq('id',other.data.id);expect(read.data??[]).toHaveLength(0);
  const edit=await client.rpc('manage_care_form',{_action:'concept',_id:other.data.id});expect(edit.error).not.toBeNull();
 });
});