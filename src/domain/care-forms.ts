import {z} from 'zod';

export const careFormSchema=z.object({id:z.string().uuid().nullable(),code:z.string().trim().min(1).max(120),kind:z.enum(['consent','aftercare']),templateId:z.string().uuid().nullable(),name:z.string().trim().min(1).max(200),textNl:z.string().max(100000),textEn:z.string().max(100000)});
export function frozenCareForm(snapshot:unknown,kind:string):{text:string;versionId:string|null}|null {
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))return null;
 const parsed=z.object({consents:z.record(z.string(),z.object({text:z.string(),versionId:z.string().uuid().nullable()}))}).safeParse(snapshot);
 return parsed.success?parsed.data.consents[kind]??null:null;
}
export function frozenAftercare(snapshot:unknown):string|null {
 const parsed=z.object({aftercare:z.string()}).safeParse(snapshot);
 return parsed.success?parsed.data.aftercare:null;
}