import { describe, expect, it, vi } from 'vitest';
import { consultAutosave } from './consult-autosave';
describe('consult autosave', () => {
  it('retains SOEP and step edits made within one debounce window', async () => {
    const write = vi.fn(async (_: Partial<{subjective:string;step_data:object}>) => undefined);
    const queue = consultAutosave(write, vi.fn());
    queue.patch({subjective:'Nieuwe anamnese'});
    queue.patch({step_data:{diagnoses:['E66.0']}});
    await queue.flush();
    expect(write).toHaveBeenCalledExactlyOnceWith({subjective:'Nieuwe anamnese',step_data:{diagnoses:['E66.0']}});
  });
  it('serializes writes so a slow old save cannot overwrite a newer one', async () => {
    let release: (()=>void) | undefined;
    const stored: string[]=[];
    const queue=consultAutosave<{plan:string}>(async p=>{if(p.plan==='oud')await new Promise<void>(r=>{release=r;});stored.push(p.plan??'');},vi.fn());
    queue.patch({plan:'oud'}); const first=queue.flush(); await Promise.resolve();await Promise.resolve();
    queue.patch({plan:'nieuw'}); const second=queue.flush(); release?.();await first;await second;
    expect(stored).toEqual(['oud','nieuw']);
  });
  it('retains failed edits for a retry before closing', async () => {
    const write=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const queue=consultAutosave<{plan:string}>(write,vi.fn());queue.patch({plan:'Bewaren'});
    await expect(queue.flush()).rejects.toThrow('offline');await queue.flush();
    expect(write).toHaveBeenLastCalledWith({plan:'Bewaren'});
  });
});