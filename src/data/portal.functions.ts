import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Json } from '@/integrations/supabase/types';
import { getRequest } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { portalEmailSchema, portalTokenSchema, portalLanding, PORTAL_LINK_MINUTES, feedbackSchema, readMaConfig, packageTotal, packageEnd } from '@/domain/portal';

const digest = async (v: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))), b=>b.toString(16).padStart(2,'0')).join('');
export const portalLoginInfo = createServerFn({method:'GET'}).handler(async()=>{
 const {resolveTenant,admin}=await import('./booking.server'); const t=await resolveTenant(undefined); if(!t) throw new Error('Mijn omgeving is niet beschikbaar.');
 const db=await admin(); const {data}=await db.from('portal_config').select('content').eq('tenant_id',t.id).single();
 const c=data?.content; if(!c||typeof c!=='object'||Array.isArray(c)) throw new Error('Mijn omgeving is niet beschikbaar.');
 return {content:{...c,demoPatients:t.test_mode?c['demoPatients']:[]},demo:t.test_mode};
});
export const sendPortalLink=createServerFn({method:'POST'}).inputValidator((d:unknown)=>portalEmailSchema.parse(d)).handler(async({data})=>{
 const {resolveTenant,admin}=await import('./booking.server'); const t=await resolveTenant(data.merk);
 const result={message:'Check je mail',demoLink:null as string|null,held:false}; if(!t)return result; const db=await admin();
 const {count}=await db.from('portal_login_tokens').select('id',{count:'exact',head:true}).eq('tenant_id',t.id).eq('email',data.email).gte('created_at',new Date(Date.now()-600000).toISOString()); if((count??0)>=5)return result;
  const {data:ps}=await db.from('patients').select('id').eq('tenant_id',t.id).ilike('email',data.email).is('deleted_at',null).order('created_at',{ascending:false}); const p=ps?.[0];
 // Booking draft: the exact flow state travels with the token, so the link restores it in any browser.
 const draft=data.draft; let holdToken:string|null=null; let held=false;
 if(draft?.date&&draft.time&&draft.treatmentId&&draft.locationId){
  if(draft.holdToken){
   const {data:heldRow}=await db.from('appointments').select('id').eq('tenant_id',t.id).eq('hold_token',draft.holdToken).eq('status','held').gt('hold_expires_at',new Date().toISOString()).maybeSingle();
   if(heldRow){holdToken=draft.holdToken;held=true;}
  }
  if(!holdToken){
   const qp=new URLSearchParams(draft.params); const {holdSlot}=await import('./booking.functions');
   const h=await holdSlot({data:{merk:data.merk,treatmentId:draft.treatmentId,locationId:draft.locationId,practitionerId:(qp.get('p')==='any'||!qp.get('p')?'any':qp.get('p')!) as never,date:draft.date,time:draft.time,language:qp.get('lang')==='en'?'en':'nl',source:qp.get('bron')??undefined,link:qp.get('link')??undefined}});
   if(h.ok){holdToken=h.token;held=true;}
  }
 }
 // Case 4: a held time with nothing left to answer confirms on click, exactly like a login from the details step.
 let confirmNow=draft?.confirm===true;
 if(draft&&holdToken&&!confirmNow&&draft.treatmentId){const {data:tr}=await db.from('treatments').select('pre_questionnaire_key').eq('id',draft.treatmentId).maybeSingle();if(tr&&!tr.pre_questionnaire_key)confirmNow=true;}
 if(draft)draft.confirm=confirmNow;
 const rc=draft?{booking:draft.params,holdToken,confirm:confirmNow,triage:draft.triageKey?{key:draft.triageKey,versionId:draft.triageVersionId??null,answers:draft.triageAnswers??{}}:null}:(data.returnTo?{booking:data.returnTo}:null);
 const raw=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 const {error}=await db.from('portal_login_tokens').insert({tenant_id:t.id,patient_id:p?.id??null,email:data.email,token_hash:await digest(raw),expires_at:new Date(Date.now()+PORTAL_LINK_MINUTES*60000).toISOString(),return_context:rc as never}); if(error)throw new Error('Probeer het later opnieuw.');
 await db.from('audit_log').insert({tenant_id:t.id,action:'portal_link_sent',category:'login',record_type:'patient',record_id:p?.id??null,details:{email_hash:await digest(data.email),duplicate:(ps?.length??0)>1,booking:!!draft}});
 if(p){
 const {data:cfg}=await db.from('portal_config').select('content').eq('tenant_id',t.id).single(); const c=cfg?.content;
 const txt=(k:string)=>c&&typeof c==='object'&&!Array.isArray(c)&&typeof c[k]==='string'?String(c[k]):'';
 const origin=new URL(getRequest().url).origin; const path=`/mijn/link/${raw}`; const url=(origin.startsWith('https:')?origin:'https://careflow-clinic-compass.lovable.app')+path;
 const {theme}=await import('./mailer.server'); const {renderMailDocument}=await import('@/domain/mail-document'); const {allowlisted}=await import('@/domain/mail');
 const {data:st}=await db.from('settings').select('value').eq('tenant_id',t.id).eq('key','mail_allowlist').maybeSingle();
  const blank={condition:'always',title_en:'',text_en:'',button_en:'',image:''};
 let subject=txt('subject'),text='',button=txt('mailButton'),footnote=txt('mailFootnote');
 if(draft){
  subject=(draft.confirm?txt('confirmSubject'):txt('bookingSubject'))||subject; button=(draft.confirm?txt('confirmButton'):txt('bookingButton'))||button; footnote=txt('bookingFootnote')||footnote;
  const [tr,lc]=await Promise.all([db.from('treatments').select('name_nl').eq('id',draft.treatmentId??'').maybeSingle(),db.from('locations').select('name,kind').eq('id',draft.locationId??'').maybeSingle()]);
  const dag=draft.date?new Date(`${draft.date}T12:00:00Z`).toLocaleDateString('nl-NL',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long'}):'';
  const vars:Record<string,string>={behandeling:tr.data?.name_nl??'',dag,tijd:draft.time??'',locatie:lc.data?.kind==='online'?'een videogesprek':lc.data?.name??''};
  text=txt('bookingText').replace(/\{(\w+)\}/g,(_,k:string)=>vars[k]??'');
 }
 const html=renderMailDocument({language:'nl',values:{},situation:{online:false,existingPatient:true,questionnaire:false,preparation:false},images:{},theme:theme(),blocks:[{...blank,id:'login',type:'button',title_nl:subject,text_nl:text,button_nl:button,url},{...blank,id:'footnote',type:'text',title_nl:'',text_nl:footnote,button_nl:'',url:''}]});
 const saved=await db.from('mail_outbox').insert({tenant_id:t.id,patient_id:p.id,recipient:data.email,subject,html,moment:'portal_login',status:allowlisted(st?.value,data.email)?'waiting_domain':'demo_only'}); if(saved.error)throw new Error('Probeer het later opnieuw.');
 // Test-mode link is also returned for unknown addresses, preserving a uniform sending response.
 }
 if(t.test_mode)result.demoLink=`/mijn/link/${raw}`;
 result.held=held;
 return result;
});
export const redeemPortalLink=createServerFn({method:'POST'}).inputValidator((d:unknown)=>portalTokenSchema.parse(d)).handler(async({data})=>{
 const {resolveTenant,admin}=await import('./booking.server'); const t=await resolveTenant(undefined); if(!t)throw new Error('De link is ongeldig of verlopen.'); const db=await admin();
 const {data:rows,error}=await db.rpc('portal_claim_token',{_hash:await digest(data.token),_tenant:t.id}); const tok=rows?.[0]; if(error||!tok)throw new Error('De link is ongeldig of verlopen.');
 const rcRaw=tok.return_context; const draft=rcRaw&&typeof rcRaw==='object'&&!Array.isArray(rcRaw)?rcRaw as {booking?:string;holdToken?:string|null;confirm?:boolean;triage?:{key:string;versionId:string|null;answers:Record<string,unknown>}|null}:null;
 if(!tok.patient_id){
  // Unknown address: never log in, send the patient back to the booking as a new patient.
  if(draft?.booking)return {unknownEmail:true as const,returnTo:draft.booking};
  throw new Error('De link is ongeldig of verlopen.');
 }
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
 const session={access_token:verified.data.session.access_token,refresh_token:verified.data.session.refresh_token};
 // Login started at the details step: confirm the held booking right away, with the patient's own record.
 if(draft?.confirm&&draft.holdToken){
  const {data:full}=await db.from('patients').select('*').eq('id',p.id).single();
  const {confirmBooking}=await import('./booking.functions');
  const r=full?await confirmBooking({data:{token:draft.holdToken,existing:true,salutation:full.salutation??'',firstName:full.first_name,lastName:full.last_name,dateOfBirth:full.date_of_birth,email:full.email,phoneCountry:full.phone_country??'+31',phone:full.phone??'0600000000',country:full.country??'NL',postcode:full.postcode??'0000AA',houseNumber:full.house_number??'0',suffix:full.house_suffix??undefined,street:full.street??'-',city:full.city??'-',consentPrivacy:true,consentGp:false,consentLsp:false,consentMarketing:false,triageKey:draft.triage?.key,triageVersionId:draft.triage?.versionId??undefined,triageAnswers:draft.triage?.answers}}):{ok:false as const,reason:'failed' as const};
  if(r.ok){await db.from('audit_log').insert({tenant_id:t.id,user_id:user.id,role_key:'patient',action:'portal_booking_confirmed',category:'booking',record_type:'patient',record_id:p.id});return {...session,confirmed:true as const};}
  // Moment expired: back to the planner with the same choices, without the lost time.
  const params=new URLSearchParams(draft.booking??'');params.delete('tijd');params.delete('stap');
  return {...session,returnTo:params.toString(),holdToken:null,holdExpired:true as const};
 }
 let returnTo=draft?.booking??null;
 if(returnTo&&draft?.holdToken){const qp=new URLSearchParams(returnTo);if(qp.get('d')&&qp.get('tijd')){qp.set('stap','vasthouden');returnTo=qp.toString();}}
 return {...session,returnTo,holdToken:draft?.holdToken??null};
});

/** Booking-flow context for a logged-in patient: prefill details and past visits for the practitioner preset. Staff get patient:null. */
export const bookingPatientContext=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({merk:z.string().max(60).optional()}).parse(d)).handler(async({data,context})=>{
 const db=context.supabase; const {data:pid}=await db.rpc('portal_patient_id'); if(!pid) return {patient:null,visits:[] as {treatment_id:string;practitioner_id:string|null;starts_at:string}[]};
 const {resolveTenant,admin}=await import('./booking.server'); const t=await resolveTenant(data.merk); if(!t) return {patient:null,visits:[] as {treatment_id:string;practitioner_id:string|null;starts_at:string}[]};
 const adb=await admin();
 const {data:p}=await adb.from('patients').select('id,first_name,last_name,email,phone,phone_country,date_of_birth,salutation,country,postcode,house_number,house_suffix,street,city').eq('id',pid).eq('tenant_id',t.id).is('deleted_at',null).single();
 if(!p) return {patient:null,visits:[] as {treatment_id:string;practitioner_id:string|null;starts_at:string}[]};
 const {data:visits}=await adb.from('appointments').select('treatment_id,practitioner_id,starts_at').eq('tenant_id',t.id).eq('patient_id',pid).eq('status','booked').lt('starts_at',new Date().toISOString()).not('practitioner_id','is',null).order('starts_at',{ascending:false}).limit(200);
 return {patient:p,visits:visits??[]};
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

export type PortalAppointment={id:string;treatment_id:string;practitioner_id:string|null;location_id:string|null;starts_at:string;ends_at:string;status:string;meet_link:string|null};
export type PortalPractitioner={id:string;first_name:string;last_name:string;title:string|null;role_id:string|null;photo:string|null};
export type PortalTreatment={id:string;name_nl:string;icon:string|null;duration_min:number;portal_settings:Json};
export type PortalMeasurement={measured_on:string;weight_kg:number|null;waist_cm:number|null;height_cm:number|null};
export type PortalExtra={appointments:PortalAppointment[];feedback:{appointment_id:string;rating:number;tags:string[];comment:string;share_with_practitioner:boolean}[];treatments:PortalTreatment[];practitioners:PortalPractitioner[];locations:{id:string;name:string;kind:string}[];roles:{id:string;name:string;key:string}[];categories:{id:string;name_nl:string;icon:string|null;parent_id:string|null}[];categoryLinks:{treatment_id:string;category_id:string}[];measurements:PortalMeasurement[]};
/** History, upcoming appointments, practitioners and treatments for the portal; photos are signed server-side. */
async function portalHistory(db:{from:(t:string)=>any;storage:any},tenantId:string,patientId:string):Promise<PortalExtra>{
 const [appts,fb,treats,prs,locs,roles,cats,catLinks,ms]=await Promise.all([
  db.from('appointments').select('id,treatment_id,practitioner_id,location_id,starts_at,ends_at,status,meet_link').eq('tenant_id',tenantId).eq('patient_id',patientId).in('status',['booked']).order('starts_at',{ascending:false}),
  db.from('treatment_feedback').select('appointment_id,rating,tags,comment,share_with_practitioner').eq('tenant_id',tenantId).eq('patient_id',patientId),
  db.from('treatments').select('id,name_nl,icon,duration_min,portal_settings').eq('tenant_id',tenantId),
  db.from('practitioners').select('id,first_name,last_name,title,role_id,photo_path').eq('tenant_id',tenantId).eq('status','active'),
  db.from('locations').select('id,name,kind').eq('tenant_id',tenantId),
  db.from('practitioner_roles').select('id,key,name_nl').eq('tenant_id',tenantId),
  db.from('treatment_categories').select('id,name_nl,icon,parent_id').eq('tenant_id',tenantId),
  db.from('treatment_category_links').select('treatment_id,category_id').eq('tenant_id',tenantId),
  db.from('measurements').select('measured_on,weight_kg,waist_cm,height_cm').eq('tenant_id',tenantId).eq('patient_id',patientId).order('measured_on',{ascending:false}).limit(24),
 ]);
 for(const q of [appts,fb,treats,prs,locs,roles,cats,catLinks,ms]) if(q.error) throw new Error('Mijn omgeving kon niet worden geladen.');
 const {data:tenant}=await db.from('tenants').select('slug').eq('id',tenantId).single();
 const bucket=`practitioner-photos-${tenant?.slug??''}`;
 const photos=await Promise.all((prs.data??[]).map(async(p:{photo_path:string|null})=>{
  if(!p.photo_path)return null;
  const {data:s}=await db.storage.from(bucket).createSignedUrl(p.photo_path,3600);
  return s?.signedUrl??null;
 }));
 const photoById=Object.fromEntries((prs.data??[]).map((p:{id:string},i:number)=>[p.id,photos[i]??null]));
 return {appointments:appts.data??[],feedback:fb.data??[],treatments:treats.data??[],practitioners:(prs.data??[]).map((p:{id:string;first_name:string;last_name:string;title:string|null;role_id:string|null;photo_path:string|null})=>({id:p.id,first_name:p.first_name,last_name:p.last_name,title:p.title,role_id:p.role_id,photo:photoById[p.id]??null})),locations:locs.data??[],roles:(roles.data??[]).map((r:{id:string;key:string;name_nl:string})=>({id:r.id,key:r.key,name:r.name_nl})),categories:cats.data??[],categoryLinks:catLinks.data??[],measurements:ms.data??[]};
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
 const {data:allowed}=await context.supabase.rpc('has_permission',{_perm:'patients.view'});
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

const orderSchema=z.object({months:z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(6)]),strengths:z.array(z.number()).min(1).max(6),support:z.string().max(40),extras:z.array(z.string().max(40)).max(8),remark:z.string().max(1000),mode:z.enum(['deliver','pickup']),delivery:z.string().max(40).nullable(),payment:z.string().max(40),total:z.number().min(0).max(100000)});
/** Bestelling plaatsen (demo-betaling): nieuw pakket met status 'ordered'; de arts kijkt na. */
export const placePortalOrder=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>orderSchema.parse(d)).handler(async({data,context})=>{
 const db=context.supabase; const {data:pid}=await db.rpc('portal_patient_id'); if(!pid)throw new Error('Log in als patiënt.');
 const {data:p}=await db.from('patients').select('tenant_id').eq('id',pid).single(); if(!p)throw new Error('Bestellen is niet gelukt.');
 if(data.strengths.length!==data.months)throw new Error('Kies voor elke maand een sterkte.');
 const {data:cfgRow}=await db.from('portal_config').select('content').eq('tenant_id',p.tenant_id).single();
 const cfg=readMaConfig(cfgRow?.content&&typeof cfgRow.content==='object'&&!Array.isArray(cfgRow.content)?(cfgRow.content as Record<string,unknown>)['maConfig']:null);
 if(!cfg)throw new Error('Bestellen is niet gelukt.');
 // Sterktes en totaal worden server-side opnieuw berekend; de client stuurt alleen keuzes.
 const idx=data.strengths.map(s=>cfg.strengths.indexOf(s)); if(idx.some(i=>i<0))throw new Error('Kies voor elke maand een sterkte.');
 const check=data.strengths.length>1?packageTotal(cfg,idx,data.months):packageTotal(cfg,idx,data.months);
 const support=cfg.support.find(s=>s.key===data.support); const extras=cfg.extras.filter(e=>data.extras.includes(e.key));
 const delivery=data.mode==='deliver'?cfg.delivery.find(x=>x.key===data.delivery):undefined;
 const expected=check+(support?.price??0)*data.months+extras.reduce((s,e)=>s+e.price,0)+(delivery?.price??0);
 if(Math.abs(expected-data.total)>0.01)throw new Error('Het totaal klopt niet meer. Probeer het opnieuw.');
 const {data:prev}=await db.from('ma_packages').select('start_date,months').eq('patient_id',pid).in('status',['active','completed']).order('start_date',{ascending:false}).limit(1);
 const start=prev?.[0]?packageEnd(prev[0].start_date,prev[0].months):new Date().toISOString().slice(0,10);
 const {error}=await db.from('ma_packages').insert({tenant_id:p.tenant_id,patient_id:pid,order_id:crypto.randomUUID(),start_date:start,months:data.months,strengths:data.strengths,status:'ordered'});
 if(error){console.error('portal order',error.code);throw new Error('Bestellen is niet gelukt.');}
 const {admin}=await import('./booking.server'); await (await admin()).from('audit_log').insert({tenant_id:p.tenant_id,user_id:context.userId,role_key:'patient',action:'portal_order_placed',category:'patient',record_type:'patient',record_id:pid,details:{months:data.months,strengths:data.strengths,support:data.support,extras:data.extras,mode:data.mode,delivery:data.delivery,payment:data.payment,total:data.total,remark:data.remark||undefined}});
 return {ok:true};
});
