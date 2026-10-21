import { describe, expect, it, vi } from 'vitest';
import { databaseClient, integrationEnabled, testRoleSession } from './database-client';
import { portalTreatmentSchema } from '@/domain/portal-treatment';
vi.setConfig({ testTimeout: 30000 });

describe.skipIf(!integrationEnabled)('Gedeeld behandeldetail patiëntgrenzen', () => {
  it('weigert anonieme toegang', async () => {
    const result = await databaseClient().rpc('portal_treatment_detail', { _appointment: '14c6ef32-98bd-4458-83a1-9cd437aa2272' });
    expect(result.error).not.toBeNull();
  });
  it('toont alleen Sanne haar vrijgegeven inhoud, niet haar interne consultvelden', async () => {
    const { client } = await testRoleSession('sanne.devries@example.test');
    const result = await client.rpc('portal_treatment_detail', { _appointment: '14c6ef32-98bd-4458-83a1-9cd437aa2272' });
    expect(result.error).toBeNull();
    const detail = portalTreatmentSchema.parse(result.data);
    expect(detail.notes.map(n => n.id)).toContain('d6000000-0000-4000-8000-000000000001');
    expect(detail.photos.map(p => p.id)).toContain('d6000000-0000-4000-8000-000000000003');
    expect(detail.notes[0]).not.toHaveProperty('subjective');
    expect(detail.notes[0]).not.toHaveProperty('receptionNote');
  });
  it('weigert Mark toegang tot Sanne haar behandeling', async () => {
    const { client } = await testRoleSession('mark.visser@example.test');
    const result = await client.rpc('portal_treatment_detail', { _appointment: '14c6ef32-98bd-4458-83a1-9cd437aa2272' });
    expect(result.error).not.toBeNull();
  });
  it('laat een geparkeerd consult en niet-gedeelde foto’s buiten het behandeldetail', async () => {
    const { client } = await testRoleSession('sanne.devries@example.test');
    const result = await client.rpc('portal_treatment_detail', { _appointment: '52311b3c-d525-4750-a61e-2ba0e2071df6' });
    expect(result.error).toBeNull();
    const detail = portalTreatmentSchema.parse(result.data);
    expect(detail.notes).toHaveLength(0);
    expect(detail.photos).toHaveLength(0);
  });
  it('toont Mark zijn receptstatus en vrijgegeven huisartsbrief', async () => {
    const { client } = await testRoleSession('mark.visser@example.test');
    const result = await client.rpc('portal_treatment_detail', { _appointment: 'ba5646b6-5287-40eb-b3f1-54f8437bfcf8' });
    expect(result.error).toBeNull();
    const detail = portalTreatmentSchema.parse(result.data);
    expect(detail.prescriptions.find(p => p.id === 'd6000000-0000-4000-8000-000000000004')?.status).toBe('ontvangen');
    expect(detail.notes.find(n => n.id === 'd6000000-0000-4000-8000-000000000002')?.gpLetter).not.toBe('');
  });
});