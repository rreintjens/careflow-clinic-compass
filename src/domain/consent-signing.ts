import {z} from 'zod';
export const consentSignatureSchema=z.object({noteId:z.string().uuid(),kind:z.string().trim().min(1).max(120),signature:z.string().max(300000).regex(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/)});
export function configuredConsent(legal:unknown,kind:string):string|null{
 if(!legal||typeof legal!=='object'||Array.isArray(legal))return null;
 const forms=(legal as Record<string,unknown>)['consentForms'];
 if(!forms||typeof forms!=='object'||Array.isArray(forms))return null;
 const text=(forms as Record<string,unknown>)[kind];return typeof text==='string'&&text.trim()?text:null;
}