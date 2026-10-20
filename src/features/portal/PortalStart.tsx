import { useSuspenseQuery } from '@tanstack/react-query';
import { History, ClipboardCheck, CalendarDays, ShieldCheck, Footprints, MapPin, Syringe, Star } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useEffect,useState } from 'react';
import { portalQuery } from '@/data/portal';
import { copy, PortalTile } from './PortalShell';
import { feedbackDue, ownDoctor, readPortalSettings, weeksSince, type HistoryItem } from '@/domain/portal';
import type { Json } from '@/integrations/supabase/types';

export type PortalData=ReturnType<typeof usePortalData>;
export function usePortalData(){
 const {data:d}=useSuspenseQuery(portalQuery);
 const treat=(id:string|null|undefined)=>d.treatments.find(t=>t.id===id);
 const prac=(id:string|null|undefined)=>d.practitioners.find(p=>p.id===id);
 const loc=(id:string|null|undefined)=>d.locations.find(l=>l.id===id);
 const role=(id:string|null|undefined)=>d.roles.find(r=>r.id===id)?.name??'';
 const now=Date.parse(`${d.today}T23:59:59+02:00`);
 const history=(d.appointments??[]).filter(a=>Date.parse(a.starts_at)<now);
 const upcoming=(d.appointments??[]).filter(a=>Date.parse(a.starts_at)>=now).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
 return {d,treat,prac,loc,role,history,upcoming};
}
export const fmtDay=(iso:string,o:Intl.DateTimeFormatOptions={day:'numeric',month:'long'})=>new Date(iso).toLocaleDateString('nl-NL',{timeZone:'Europe/Amsterdam',...o});
export const fill=(s:string,vars:Record<string,string|number>)=>s.replace(/\{(\w+)\}/g,(_,k:string)=>String(vars[k]??''));
export function Photo({src,size,alt=''}:{src:string|null|undefined;size:number;alt?:string}){
 return src?<img src={src} alt={alt} width={size} height={size} className='portal-photo' style={{width:size,height:size}}/>:<span className='portal-photo portal-photo-empty' style={{width:size,height:size}}/>;
}
export function Ring({value,max,children}:{value:number;max:number;children:React.ReactNode}){
 const r=52,c=2*Math.PI*r,p=max>0?Math.min(1,value/max):0;
 return <span className='portal-ring'><svg viewBox='0 0 120 120'><circle cx='60' cy='60' r={r} className='portal-ring-track'/><circle cx='60' cy='60' r={r} className='portal-ring-value' strokeDasharray={c} strokeDashoffset={c*(1-p)}/></svg><span className='portal-ring-center'>{children}</span></span>;
}

export function PortalStart(){
 const {d,treat,prac,loc,role,history,upcoming}=usePortalData();
 const [greeting,setGreeting]=useState('Goedemorgen');
 useEffect(()=>{const hour=Number(new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',hour:'numeric',hourCycle:'h23'}).format(new Date()));setGreeting(hour<12?'Goedemorgen':hour<18?'Goedemiddag':'Goedenavond');},[]);
 const c=d.content;const lost=d.weight!==null&&d.access.initial_weight_kg!==null?(d.access.initial_weight_kg-d.weight).toLocaleString('nl-NL',{maximumFractionDigits:1}):'';
 const month=d.landing.package?Math.max(1,(Number(d.today.slice(0,4))-Number(d.landing.package.start_date.slice(0,4)))*12+Number(d.today.slice(5,7))-Number(d.landing.package.start_date.slice(5,7))+1):1;
 const historyTile=<PortalTile icon={History} label={copy(c,d.landing.kind==='active'?'combinedHistory':'history')} value={String(history.length)} sub={copy(c,'historySub')} to='/mijn/historie'/>;
 const medical=d.landing.kind==='active'||d.landing.kind==='starter'||d.landing.kind==='stopped';
 return <><p className='portal-date'>{new Date(`${d.today}T12:00:00Z`).toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'})}</p><h1>{greeting}, <span>{d.patient.first_name}</span></h1><div className='portal-pills'>{d.landing.kind==='active'?<><span><CalendarDays size={14}/>Maand {month} {copy(c,'programme')}</span><span><Syringe size={14}/>{d.access.medication}</span></>:<span><MapPin size={14}/>Kliniek {d.access.clinic_label}</span>}</div>
 {medical?<div className='portal-start-grid'>
 {d.landing.kind==='active'&&<><PortalTile icon={CalendarDays} label={copy(c,'activeLabel')} value={`Maand ${month}`} sub={d.access.medication??''} status='neutral' to='/mijn/afspraken'/><PortalTile icon={Footprints} label={copy(c,'lost')} value={`${lost} kg`} status='good' to='/mijn/voortgang'/>{history.length>0&&historyTile}</>}
 {d.landing.kind==='starter'&&<><PortalTile icon={ClipboardCheck} label={copy(c,'starterLabel')} value={copy(c,'questionnaire')} sub={copy(c,'questionnaireSub')} status='soon' to='/mijn/afspraken'/><PortalTile icon={ShieldCheck} label={copy(c,'starterLabel')} value={copy(c,'consents')} sub={copy(c,'consentsSub')} status='soon' to='/mijn/profiel'/></>}
 {d.landing.kind==='stopped'&&<div className='portal-tile portal-status-good portal-stopped'><span className='portal-icon'><Footprints size={20}/></span><span className='portal-tile-label'>{copy(c,'stoppedLabel').replace('{datum}',new Date(`${d.landing.stoppedOn}T12:00:00Z`).toLocaleDateString('nl-NL',{day:'numeric',month:'long'}))}</span><strong className='portal-tile-value'>{lost} kg</strong><span className='portal-tile-sub'>{copy(c,'lost')}</span><Link to='/boeken' className='portal-restart'>{copy(c,'restart')}</Link></div>}
 {d.landing.kind==='stopped'&&history.length>0&&historyTile}
 </div>:<CosmeticStart/>}
 </>;
}

/** Cosmetic Start (v0.2 §5): arts card, behandeltraject, feedback, opnieuw boeken, ontdekken. */
function CosmeticStart(){
 const {d,treat,prac,loc,role,history,upcoming}=usePortalData();
 const c=d.content;
 const items:HistoryItem[]=history.map(a=>({id:a.id,starts_at:a.starts_at,treatment_id:a.treatment_id,practitioner_id:a.practitioner_id}));
 const doctorId=ownDoctor(items,items.map(i=>i.treatment_id));
 const doctor=prac(doctorId);
 const doctorVisits=history.filter(a=>a.practitioner_id===doctorId);
 const others=[...new Set(history.map(a=>a.practitioner_id).filter(id=>id&&id!==doctorId))].map(id=>prac(id)).filter(Boolean);
 const second=others[0];
 // Behandeltraject: treatment with a course_count the patient has started.
 const course=history.map(a=>({a,s:readPortalSettings(treat(a.treatment_id)?.portal_settings)})).find(x=>x.s.course_count&&x.s.course_count>1);
 const courseDone=course?history.filter(a=>a.treatment_id===course.a.treatment_id).length:0;
 const courseNext=course?upcoming.find(a=>a.treatment_id===course.a.treatment_id):undefined;
 const given=(d.feedback??[]).map(f=>f.appointment_id);
 const due=feedbackDue(items,given,d.today);
 const dueT=due?treat(due.treatment_id):null,dueP=due?prac(due.practitioner_id):null;
 // Opnieuw boeken: most recent visit per treatment, max 3.
 const rebook=[...new Map([...history].sort((a,b)=>b.starts_at.localeCompare(a.starts_at)).map(a=>[a.treatment_id,a])).values()].slice(0,3);
 const hadCategories=new Set(d.categoryLinks.filter(l=>history.some(a=>a.treatment_id===l.treatment_id)).map(l=>l.category_id));
 const discover=d.categories.filter(cat=>!cat.parent_id&&!hadCategories.has(cat.id)).slice(0,4);
 return <>
 {doctor&&<section className='portal-card'>
  <div className='portal-doctor'><Photo src={doctor.photo} size={64}/><div className='min-w-0'><p className='portal-card-label'>{copy(c,'yourDoctor')}</p><h2>{doctor.first_name} {doctor.last_name}</h2><p className='portal-sub'>{fill(copy(c,'visitsLine'),{n:doctorVisits.length,voornaam:doctor.first_name,datum:fmtDay(doctorVisits[0]?.starts_at??d.today)})}</p></div></div>
  <Link to='/boeken' search={{t:doctorVisits[0]?.treatment_id,p:doctor.id}} className='portal-btn-primary'><CalendarDays size={16}/>{fill(copy(c,'planWith'),{voornaam:doctor.first_name})}</Link>
  {second&&<div className='portal-doctor-second'><Photo src={second.photo} size={36}/><div className='min-w-0 flex-1'><p className='portal-row-title'>{second.first_name} {second.last_name}</p><p className='portal-sub'>{fill(copy(c,'alsoYour'),{rol:role(second.role_id).toLowerCase()})}</p></div><Link to='/boeken' search={{p:second.id}} className='portal-chip'>{copy(c,'plan')}</Link></div>}
 </section>}
 {course&&courseT(course.a,treat,c,courseDone,courseNext,prac,loc)}
 {due&&dueT&&dueP&&<section className='portal-card portal-card-amber'>
  <div className='portal-doctor'><Photo src={dueP.photo} size={44}/><div className='min-w-0'><p className='portal-card-label'>{copy(c,'feedbackTitle')}</p><p className='portal-row-title'>{dueT.name_nl} bij {dueP.first_name}, {fmtDay(due.starts_at)}</p></div></div>
  <div className='portal-stars'>{[1,2,3,4,5].map(n=><Link key={n} to='/mijn/feedback/$appointmentId' params={{appointmentId:due.id}} search={{rating:n}} aria-label={`${n} sterren`}><Star size={30} strokeWidth={1.7}/></Link>)}</div>
  <p className='portal-sub'>{fill(copy(c,'feedbackGoesTo'),{voornaam:dueP.first_name})}</p>
 </section>}
 {rebook.length>0&&<section className='portal-card'>
  <h2 className='portal-card-heading'>{copy(c,'rebookTitle')}</h2>
  <div className='portal-rows'>{rebook.map(a=>{const t=treat(a.treatment_id),p=prac(a.practitioner_id),s=readPortalSettings(t?.portal_settings),weeks=weeksSince(a.starts_at,d.today),dueWeeks=s.reminder_weeks&&s.reminder_weeks>0&&weeks>=s.reminder_weeks;
   return <div key={a.id} className='portal-row'><Photo src={p?.photo} size={40}/><div className='min-w-0 flex-1'><p className='portal-sub'>Bij {p?`${p.first_name} ${p.last_name}`:''}</p><p className='portal-row-title'>{t?.name_nl}</p><p className='portal-sub'>{dueWeeks?<><span className='portal-dot-amber'/>{fill(copy(c,'weeksAgo'),{n:weeks})}</>:fmtDay(a.starts_at)}</p></div><Link to='/boeken' search={{t:a.treatment_id,p:a.practitioner_id??undefined}} className='portal-chip'>{copy(c,'rebook')}</Link></div>;})}</div>
  <Link to='/mijn/historie' className='portal-link'>{fill(copy(c,'viewAllHistory'),{n:history.length})}</Link>
 </section>}
 {discover.length>0&&<section><h2 className='portal-card-heading portal-discover-heading'>{copy(c,'discoverTitle')}</h2><div className='portal-discover'>{discover.map(cat=><Link key={cat.id} to='/boeken' search={{cat:cat.id}} className='portal-discover-card'>{cat.icon&&<img src={`/treatment-icons/${cat.icon}.png`} alt='' className='size-7'/>}<p className='portal-row-title'>{cat.name_nl}</p><p className='portal-sub'>{copy(c,'discoverPlaceholder')||'Ontdek wat deze behandeling voor je kan doen.'}</p><span className='portal-link'>{copy(c,'moreInfo')}</span></Link>)}</div></section>}
 </>;
}
function courseT(a:HistoryItem,treat:(id:string)=>{name_nl:string;icon:string|null;portal_settings?:Json}|undefined,c:Json,courseDone:number,courseNext:{id:string;starts_at:string;practitioner_id:string|null;location_id:string|null}|undefined,prac:(id:string|null|undefined)=>{first_name:string;last_name:string;photo:string|null}|undefined,loc:(id:string|null|undefined)=>{name:string}|undefined){
 const t=treat(a.treatment_id);const s=readPortalSettings((t as {portal_settings?:unknown}|undefined)?.portal_settings);const n=s.course_count??1;const p=courseNext?prac(courseNext.practitioner_id):undefined;
 return <section className='portal-card'>
  <div className='portal-doctor'><span className='portal-icon'>{t?.icon?<img src={`/treatment-icons/${t.icon}.png`} alt='' className='size-5'/>:<Syringe size={18}/>}</span><div><p className='portal-card-label'>{copy(c,'courseLabel')}</p><h2>{t?.name_nl}</h2></div></div>
  <div className='portal-course'><Ring value={courseDone} max={n}><strong>{courseDone} van {n}</strong><span>{copy(c,'ofTreatments')}</span></Ring>
  {courseNext&&<div className='portal-course-next'><p className='portal-sub'>{fill(copy(c,'nextTreatment'),{x:courseDone+1,n})}</p><p className='portal-row-title'>{fmtDay(courseNext.starts_at,{weekday:'short',day:'numeric',month:'short'})}, {new Date(courseNext.starts_at).toLocaleTimeString('nl-NL',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit'})}</p><p className='portal-sub portal-with-photo'>{p&&<Photo src={p.photo} size={18}/>}{p?`${p.first_name} ${p.last_name}`:''} · {loc(courseNext.location_id)?.name}</p></div>}</div>
  {s.course_interval&&<p className='portal-sub'>{s.course_interval}</p>}
 </section>;
}
