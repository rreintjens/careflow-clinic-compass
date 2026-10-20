import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { getRequest } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { portalEmailSchema, portalTokenSchema, portalLanding, PORTAL_LINK_MINUTES, feedbackSchema } from '@/domain/portal';

const digest = async (v: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))), b=>b.toString(16).padStart(2,'0')).join('');
export const portalLoginInfo = createServerFn({method:'GET'}).handler(async()=>{
 const {resolveTenant,admin}=await import('./booking.server'); const t=await resolveTenant(undefined); if(!t) throw new Error('Mijn omgeving is niet beschikbaar.');
 const db=await admin(); const {data}=await db.from('portal_config').select('content').eq('tenant_id',t.id).single();
 const c=data?.content; if(!c||typeof c!=='object'||Array.isArray(c)) throw new Error('Mijn omgeving is niet beschikbaar.');
 return {content:{...c,demoPatients:t.test_mode?c['demoPatients']:[]},demo:t.test_mode};
});
export const sendPortalLink=createServerFn({method:'POST'}).inputValidator((d:unknown)=>portalEmailSchema.parse(d)).handler(async({data})=>{
 const {resolveTenant,admin}=await import('./booking.server'); const t=await resolveTenant(undefined);
 const result={message:'Check je mail',demoLink:null as string|null}; if(!t)return result; const db=await admin();
 const {count}=await db.from('portal_login_tokens').select('id',{count:'exact',head:true}).eq('tenant_id',t.id).eq('email',data.email).gte('created_at',new Date(Date.now()-600000).toISOString()); if((count??0)>=5)return result;
 const {data:ps}=await db.from('patients').select('id').eq('tenant_id',t.id).ilike('email',data.email).is('deleted_at',null).order('created_at',{ascending:false}); const p=ps?.[0];
 const raw=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 const {error}=await db.from('portal_login_tokens').insert({tenant_id:t.id,patient_id:p?.id??null,email:data.email,token_hash:await digest(raw),expires_at:new Date(Date.now()+PORTAL_LINK_MINUTES*60000).toISOString()}); if(error)throw new Error('Probeer het later opnieuw.');
 await db.from('audit_log').insert({tenant_id:t.id,action:'portal_link_sent',category:'login',record_type:'patient',record_id:p?.id??null,details:{email_hash:await digest(data.email),duplicate:(ps?.length??0)>1}});
 if(p){
 const {data:cfg}=await db.from('portal_config').select('content').eq('tenant_id',t.id).single(); const c=cfg?.content;
 const txt=(k:string)=>c&&typeof c==='object'&&!Array.isArray(c)&&typeof c[k]==='string'?String(c[k]):'';
 const origin=new URL(getRequest().url).origin; const path=`/mijn/link/${raw}`; const url=(origin.startsWith('https:')?origin:'https://careflow-clinic-compass.lovable.app')+path;
 const {theme}=await import('./mailer.server'); const {renderMailDocument}=await import('@/domain/mail-document'); const {allowlisted}=await import('@/domain/mail');
 const {data:st}=await db.from('settings').select('value').eq('tenant_id',t.id).eq('key','mail_allowlist').maybeSingle();
 const blank={condition:'always',title_en:'',text_en:'',button_en:'',image:''};
 const html=renderMailDocument({language:'nl',values:{},situation:{online:false,existingPatient:true,questionnaire:false,preparation:false},images:{},theme:theme(),blocks:[{...blank,id:'login',type:'button',title_nl:txt('subject'),text_nl:'',button_nl:txt('mailButton'),url},{...blank,id:'footnote',type:'text',title_nl:'',text_nl:txt('mailFootnote'),button_nl:'',url:''}]});
 const saved=await db.from('mail_outbox').insert({tenant_id:t.id,patient_id:p.id,recipient:data.email,subject:txt('subject'),html,moment:'portal_login',status:allowlisted(st?.value,data.email)?'waiting_domain':'demo_only'}); if(saved.error)throw new Error('Probeer het later opnieuw.');
 // Test-mode link is also returned for unknown addresses, preserving a uniform sending response.
 }
 if(t.test_mode)result.demoLink=`/mijn/link/${raw}`;
 return result;
});
export const redeemPortalLink=createServerFn({method:'POST'}).inputValidator((d:unknown)=>portalTokenSchema.parse(d)).handler(async({data})=>{
 const {resolveTenant,admin}=await import('./booking.server'); const t=await resolveTenant(undefined); if(!t)throw new Error('De link is ongeldig of verlopen.'); const db=await admin();
 const {data:rows,error}=await db.rpc('portal_claim_token',{_hash:await digest(data.token),_tenant:t.id}); const tok=rows?.[0]; if(error||!tok?.patient_id)throw new Error('De link is ongeldig of verlopen.');
 const {data:p}=await db.from('patients').select('id,email').eq('tenant_id',t.id).eq('id',tok.patient_id).is('deleted_at',null).single(); if(!p)throw new Error('De link is ongeldig of verlopen.');
 const generated=await db.auth.admin.generateLink({type:'magiclink',email:p.email}); const user=generated.data?.user, otp=generated.data?.properties?.hashed_token; if(generated.error||!user||!otp){console.error('portal generate',generated.error?.code);throw new Error('Inloggen is niet gelukt.');}
 const [ms,gs]=await Promise.all([db.from('tenant_memberships').select('id').eq('user_id',user.id).limit(1),db.from('group_admins').select('user_id').eq('user_id',user.id).limit(1)]); if(ms.error||gs.error||ms.data?.length||gs.data?.length)throw new Error('Gebruik de medewerkerslogin voor dit account.');
 const access=await db.from('portal_patient_access').upsert({tenant_id:t.id,patient_id:p.id,user_id:user.id},{onConflict:'tenant_id,patient_id'}); if(access.error){console.error('portal access',access.error.code);throw new Error('Inloggen is niet gelukt.');}
 const updated=await db.auth.admin.updateUserById(user.id,{app_metadata:{...user.app_metadata,active_tenant:t.id}}); if(updated.error){console.error('portal update',updated.error.code);throw new Error('Inloggen is niet gelukt.');}
 // Updating the Auth user can invalidate its previously generated one-time token.
 const fresh=await db.auth.admin.generateLink({type:'magiclink',email:p.email});
 const freshOtp=fresh.data?.properties?.hashed_token;
 if(fresh.error||!freshOtp)throw new Error('Inloggen is niet gelukt.');
 const key=process.env['SUPABASE_PUBLISHABLE_KEY']!;
 const client=createClient(process.env['SUPABASE_URL']!,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const h=new Headers(init?.headers);if(key.startsWith('sb_')&&h.get('Authorization')===`Bearer ${key}`)h.delete('Authorization');h.set('apikey',key);return fetch(input,{...init,headers:h});}}});
 const verified=await client.auth.verifyOtp({token_hash:freshOtp,type:'magiclink'}); if(!verified.data.session){console.error('portal verify',verified.error?.code);throw new Error('Inloggen is niet gelukt.');}
 await db.from('audit_log').insert(['portal_link_used','portal_login'].map(action=>({tenant_id:t.id,user_id:user.id,role_key:'patient',action,category:'login',record_type:'patient',record_id:p.id})));
 return {access_token:verified.data.session.access_token,refresh_token:verified.data.session.refresh_token};
});
export const readPortal=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const db=context.supabase; const {data:id}=await db.rpc('portal_patient_id'); if(!id)throw new Error('Log in als patiënt om Mijn omgeving te openen.');
 const [p,a,pk,m,c]=await Promise.all([db.from('patients').select('id,first_name,last_name,email,patient_number,tenant_id').eq('id',id).single(),db.from('portal_patient_access').select('*').eq('patient_id',id).single(),db.from('ma_packages').select('*').eq('patient_id',id),db.from('measurements').select('weight_kg,measured_on').eq('patient_id',id).order('measured_on',{ascending:false}).limit(1),db.from('portal_config').select('content').single()]);
 if(p.error||a.error||pk.error||m.error||c.error)throw new Error('Mijn omgeving kon niet worden geladen.');
 const {admin}=await import('./booking.server');
 const auditDb=await admin();
 const audit=await auditDb.from('audit_log').insert({tenant_id:p.data.tenant_id,user_id:context.userId,role_key:'patient',action:'portal_viewed',category:'patient',record_type:'patient',record_id:id});
 if(audit.error)throw new Error('Mijn omgeving kon niet worden geladen.');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam'}).format(new Date());
 const extra=await portalHistory(auditDb,p.data.tenant_id,id);
 return {patient:p.data,access:a.data,landing:portalLanding(pk.data??[],a.data.starter_proposed,today),weight:m.data?.[0]?.weight_kg??null,content:c.data.content,today,...extra};
});

/** History, upcoming appointments, practitioners and treatments for the portal; photos are signed server-side. */
async function portalHistory(db:{from:(t:string)=>any;storage:any},tenantId:string,patientId:string){
 const [appts,fb,treats,prs,locs,roles,cats,catLinks]=await Promise.all([
  db.from('appointments').select('id,treatment_id,practitioner_id,location_id,starts_at,ends_at,status,meet_link').eq('tenant_id',tenantId).eq('patient_id',patientId).in('status',['booked']).order('starts_at',{ascending:false}),
  db.from('treatment_feedback').select('appointment_id,rating,tags,comment,share_with_practitioner').eq('tenant_id',tenantId).eq('patient_id',patientId),
  db.from('treatments').select('id,name_nl,icon,duration_min,portal_settings').eq('tenant_id',tenantId),
  db.from('practitioners').select('id,first_name,last_name,role_id,photo_path').eq('tenant_id',tenantId).eq('status','active'),
  db.from('locations').select('id,name,kind').eq('tenant_id',tenantId),
  db.from('roles').select('id,name').eq('tenant_id',tenantId),
  db.from('treatment_categories').select('id,name_nl,icon,parent_id').eq('tenant_id',tenantId),
  db.from('treatment_category_links').select('treatment_id,category_id').eq('tenant_id',tenantId),
 ]);
 for(const q of [appts,fb,treats,prs,locs,roles,cats,catLinks]) if(q.error) throw new Error('Mijn omgeving kon niet worden geladen.');
 const {data:tenant}=await db.from('tenants').select('slug').eq('id',tenantId).single();
 const bucket=`practitioner-photos-${tenant?.slug??''}`;
 const photos=await Promise.all((prs.data??[]).map(async(p:{photo_path:string|null})=>{
  if(!p.photo_path)return null;
  const {data:s}=await db.storage.from(bucket).createSignedUrl(p.photo_path,3600);
  return s?.signedUrl??null;
 }));
 const photoById=Object.fromEntries((prs.data??[]).map((p:{id:string},i:number)=>[p.id,photos[i]??null]));
 return {appointments:appts.data??[],feedback:fb.data??[],treatments:treats.data??[],practitioners:(prs.data??[]).map((p:{id:string;first_name:string;last_name:string;role_id:string|null;photo_path:string|null})=>({id:p.id,first_name:p.first_name,last_name:p.last_name,role_id:p.role_id,photo:photoById[p.id]??null})),locations:locs.data??[],roles:roles.data??[],categories:cats.data??[],categoryLinks:catLinks.data??[]};
}

export const sendFeedback=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>feedbackSchema.parse(d)).handler(async({data,context})=>{
 const db=context.supabase; const {data:pid}=await db.rpc('portal_patient_id'); if(!pid)throw new Error('Log in als patiënt.');
 const {data:appt}=await db.from('appointments').select('id,tenant_id,practitioner_id,starts_at').eq('id',data.appointmentId).eq('patient_id',pid).single();
 if(!appt||Date.parse(appt.starts_at)>Date.now())throw new Error('Deze behandeling is niet gevonden.');
 const {error}=await db.from('treatment_feedback').insert({appointment_id:data.appointmentId,patient_id:pid,practitioner_id:appt.practitioner_id,rating:data.rating,tags:data.tags,comment:data.comment,share_with_practitioner:data.share_with_practitioner});
 if(error)throw new Error(error.code==='23505'?'Je hebt voor deze behandeling al feedback gegeven.':'Versturen is niet gelukt.');
 await db.from('audit_log').insert({tenant_id:appt.tenant_id,user_id:context.userId,role_key:'patient',action:'portal_feedback',category:'patient',record_type:'appointment',record_id:data.appointmentId,details:{rating:data.rating}});
 return {ok:true};
});

/** Staff preview: read the portal as a patient, read-only, audited. */
export const readPortalAsPatient=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({patientId:z.string().uuid()}).parse(d)).handler(async({data,context})=>{
 const {data:allowed}=await context.supabase.rpc('has_permission',{perm:'patients.read'});
 if(!allowed)throw new Error('Geen toegang.');
 const {admin}=await import('./booking.server'); const db=await admin();
 const {data:p}=await db.from('patients').select('id,first_name,last_name,email,patient_number,tenant_id').eq('id',data.patientId).is('deleted_at',null).single();
 if(!p)throw new Error('Patiënt niet gevonden.');
 const [a,pk,m,c]=await Promise.all([db.from('portal_patient_access').select('*').eq('patient_id',p.id).maybeSingle(),db.from('ma_packages').select('*').eq('patient_id',p.id),db.from('measurements').select('weight_kg,measured_on').eq('patient_id',p.id).order('measured_on',{ascending:false}).limit(1),db.from('portal_config').select('content').eq('tenant_id',p.tenant_id).single()]);
 if(!a.data||!c.data)throw new Error('Deze patiënt heeft nog geen Mijn omgeving.');
 await db.from('audit_log').insert({tenant_id:p.tenant_id,user_id:context.userId,action:'portal_view_as_patient',category:'patient',record_type:'patient',record_id:p.id});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam'}).format(new Date());
 const extra=await portalHistory(db,p.tenant_id,p.id);
 return {patient:p,access:a.data,landing:portalLanding(pk.data??[],a.data.starter_proposed,today),weight:m.data?.[0]?.weight_kg??null,content:c.data.content,today,...extra};
});
