import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {configuredConsent,consentSignatureSchema} from '@/domain/consent-signing';
import {readContent,mergeTemplates} from '@/domain/dossier-templates';
import {frozenCareForm} from '@/domain/care-forms';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/integrations/supabase/types';
async function consentContext(db:SupabaseClient<Database>,noteId:string){
 const permission=await db.rpc('has_permission',{_perm:'patients.medical'});const aal=await db.rpc('is_aal2');
 if(permission.error||aal.error||!permission.data||!aal.data)throw new Error('Geen toegang.');
 const note=await db.from('consult_notes').select('id,patient_id,appointment_id,tenant_id,template_version_ids,care_form_snapshot,status').eq('id',noteId).single();
 if(note.error)throw new Error('Consult niet gevonden.');
 const tenant=await db.from('tenants').select('legal').eq('id',note.data.tenant_id).single();
 const versions=await db.from('dossier_template_versions').select('content').eq('tenant_id',note.data.tenant_id).in('id',note.data.template_version_ids);
 if(tenant.error||versions.error)throw new Error('Toestemming kon niet worden geladen.');
 const template=mergeTemplates(versions.data.map(v=>readContent(v.content)));
 return {note:note.data,forms:template.consentForms.map(kind=>{const frozen=frozenCareForm(note.data.care_form_snapshot,kind);return {kind,text:frozen?frozen.text:configuredConsent(tenant.data.legal,kind),versionId:frozen?.versionId??null};})};
}
export const readConsultConsents=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({noteId:z.string().uuid()})).handler(async({data,context})=>{
 const c=await consentContext(context.supabase,data.noteId);
 const signatures=await context.supabase.from('patient_consents').select('id,kind,signature,text_snapshot,created_at').eq('tenant_id',c.note.tenant_id).eq('patient_id',c.note.patient_id).eq('appointment_id',c.note.appointment_id??'00000000-0000-0000-0000-000000000000').not('signature','is',null).order('created_at',{ascending:false});
 if(signatures.error)throw new Error('Toestemming kon niet worden geladen.');return {...c,signatures:signatures.data};
});
export const signConsultConsent=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(consentSignatureSchema).handler(async({data,context})=>{
 const c=await consentContext(context.supabase,data.noteId);const form=c.forms.find(f=>f.kind===data.kind);
 if(!form?.text)throw new Error('De kliniek heeft nog geen toestemmingstekst voor dit formulier ingesteld.');
 if(!['draft','parked'].includes(c.note.status))throw new Error('Dit consult is al afgesloten.');
 const {admin}=await import('./booking.server');const db=await admin();
 const insert=await db.from('patient_consents').insert({tenant_id:c.note.tenant_id,patient_id:c.note.patient_id,appointment_id:c.note.appointment_id,kind:data.kind,granted:true,signature:data.signature,text_snapshot:form.text,care_form_version_id:form.versionId,template_version_ids:c.note.template_version_ids,signed_by:context.userId,source:'tablet'}).select('id').single();
 if(insert.error)throw new Error('Ondertekenen is niet gelukt.');
 const audit=await db.from('audit_log').insert({tenant_id:c.note.tenant_id,user_id:context.userId,action:'consent_signed',category:'patient',record_type:'patient_consents',record_id:insert.data.id,details:{description:'Toestemmingsformulier ondertekend op tablet',kind:data.kind}});
 if(audit.error)throw new Error('Ondertekening kon niet worden geregistreerd.');return {ok:true};
});