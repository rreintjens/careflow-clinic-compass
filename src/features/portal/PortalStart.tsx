import { useSuspenseQuery } from '@tanstack/react-query';
import { History, ClipboardCheck, CalendarDays, ShieldCheck, Footprints, MapPin, Syringe, Star, ShoppingCart, HeartPulse, Scale, Sparkles } from 'lucide-react';
import { Link, useSearch } from '@tanstack/react-router';
import { useEffect,useState } from 'react';
import { portalQuery } from '@/data/portal';
import { copy, PortalTile } from './PortalShell';
import { feedbackDue, orderWindow, ownDoctor, readPortalSettings, weeksSince, type HistoryItem } from '@/domain/portal';
import type { Json } from '@/integrations/supabase/types';
import type { PortalPractitioner } from '@/data/portal.functions';

export type PortalData=ReturnType<typeof usePortalData>;
export function usePortalData(){
 const {data:d}=useSuspenseQuery(portalQuery);
 const treat=(id:string|null|undefined)=>d.treatments.find(t=>t.id===id);
 const prac=(id:string|null|undefined)=>d.practitioners.find(p=>p.id===id);
 const loc=(id:string|null|undefined)=>d.locations.find(l=>l.id===id);
 const role=(id:string|null|undefined)=>d.roles.find(r=>r.id===id)?.name??'';
 const catById=Object.fromEntries(d.categories.map(c=>[c.id,c]));
 /** De sitecategorie (toplevel) van een behandeling; interne groepen tellen niet mee. */
 const siteCat=(tid:string|null|undefined)=>{
  const link=d.categoryLinks.find(l=>l.treatment_id===tid);let cat=link?catById[link.category_id]:undefined;
  while(cat?.parent_id)cat=catById[cat.parent_id];
  return cat as {id:string;name_nl:string;icon:string|null}|undefined;
 };
 /** Behandelicoon, met de sitecategorie als fallback. */
 const treatIcon=(tid:string|null|undefined)=>treat(tid)?.icon??siteCat(tid)?.icon??null;
 const now=Date.parse(`${d.today}T23:59:59+02:00`);
 // A visit that is already finished or paid is history, even when its slot lies later today or in the future.
 const done=(a:{starts_at:string;status?:string|null})=>Date.parse(a.starts_at)<now||a.status==='afgerond'||a.status==='klaar_voor_betaling';
 const history=(d.appointments??[]).filter(done);
 const upcoming=(d.appointments??[]).filter(a=>!done(a)).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
 return {d,treat,prac,loc,role,siteCat,treatIcon,history,upcoming};
}
export const fmtDay=(iso:string,o:Intl.DateTimeFormatOptions={day:'numeric',month:'long'})=>new Date(iso).toLocaleDateString('nl-NL',{timeZone:'Europe/Amsterdam',...o});
export const fmtTime=(iso:string)=>new Date(iso).toLocaleTimeString('nl-NL',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit'});
export const fill=(s:string,vars:Record<string,string|number>)=>s.replace(/\{(\w+)\}/g,(_,k:string)=>String(vars[k]??''));
/** Volledige naam zoals patiënten hem zien; artsen houden hun titel ("Drs. Hugo Ammerlaan"). */
export const pracName=(p:Pick<PortalPractitioner,'first_name'|'last_name'|'title'>|null|undefined)=>p?`${p.title?`${p.title} `:''}${p.first_name} ${p.last_name}`:'';
export function Photo({src,size,alt=''}:{src:string|null|undefined;size:number;alt?:string}){
 return src?<img src={src} alt={alt} width={size} height={size} className='portal-photo' style={{width:size,height:size}}/>:<span className='portal-photo portal-photo-empty' style={{width:size,height:size}}/>;
}
export function Ring({value,max,children,size}:{value:number;max:number;children:React.ReactNode;size?:'lg'}){
 const r=52,c=2*Math.PI*r,p=max>0?Math.min(1,value/max):0;
 return <span className={`portal-ring${size==='lg'?' portal-ring-lg':''}`}><svg viewBox='0 0 120 120'><circle cx='60' cy='60' r={r} className='portal-ring-track'/><circle cx='60' cy='60' r={r} className='portal-ring-value' strokeDasharray={c} strokeDashoffset={c*(1-p)}/></svg><span className='portal-ring-center'>{children}</span></span>;
}

export function PortalStart(){
 const {d,history,upcoming}=usePortalData();
 const [greeting,setGreeting]=useState('Goedemorgen');
 useEffect(()=>{const hour=Number(new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',hour:'numeric',hourCycle:'h23'}).format(new Date()));setGreeting(hour<12?'Goedemorgen':hour<18?'Goedemiddag':'Goedenavond');},[]);
 const search=useSearch({strict:false}) as {bevestigd?:boolean};
 const confirmed=search.bevestigd?upcoming[0]:undefined;
 const c=d.content;
 const month=d.landing.package?Math.max(1,(Number(d.today.slice(0,4))-Number(d.landing.package.start_date.slice(0,4)))*12+Number(d.today.slice(5,7))-Number(d.landing.package.start_date.slice(5,7))+1):1;
 const historyTile=<PortalTile icon={History} label={copy(c,d.landing.kind==='active'?'combinedHistory':'history')} value={String(history.length)} sub={copy(c,'historySub')} to='/mijn/historie'/>;
 const medical=d.landing.kind==='active'||d.landing.kind==='starter'||d.landing.kind==='stopped';
 return <>{confirmed&&<ConfirmedTile a={confirmed}/>}<div className={confirmed?'portal-fade-late':undefined}><p className='portal-date'>{new Date(`${d.today}T12:00:00Z`).toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'})}</p><h1>{greeting}, <span>{d.patient.first_name}</span></h1><div className='portal-pills'>{d.landing.kind==='active'?<><Link to='/mijn/programma' style={{textDecoration:'none'}}><span><CalendarDays size={14}/>Maand {month} {copy(c,'programme')}</span></Link><span><Syringe size={14}/>{d.access.medication}</span></>:<span><MapPin size={14}/>Kliniek {d.access.clinic_label}</span>}</div>
 {medical?<MedicalStart historyTile={historyTile}/>:<CosmeticStart/>}
 </div></>;
}

/** Besteltegel (groen) met bestelvenster-balk; gedeeld door Start en Bestellen. */
export function OrderTile({asLink=true}:{asLink?:boolean}){
 const {d}=usePortalData();const c=d.content;const pkg=d.landing.package;
 const win=pkg?orderWindow(pkg.start_date,pkg.months,d.today):null;
 if(!win)return null;
 const med=(d.access.medication??'').replace(/\s*[\d,.]+\s*mg\s*$/i,'').trim()||'Medicatie';
 const body=<>
  <span className='portal-tile-head'><span className='portal-icon'><ShoppingCart size={20}/></span><span className='portal-chip portal-chip-white'>{copy(c,'preorder')}</span></span>
  <span className='portal-tile-label'>{fill(copy(c,'orderTile'),{medicijn:med})}</span>
  <strong className='portal-tile-value'>{win.canOrder?copy(c,'orderNow'):fill(copy(c,'orderIn'),{n:win.daysUntil})}</strong>
  <span className='portal-tile-sub'>{fill(copy(c,'orderWindow'),{d1:fmtDay(win.opens),d2:fmtDay(win.closes)})}</span>
  <span className='portal-order-bar'><span style={{width:`${Math.min(100,Math.max(4,100-win.daysUntil/7*100))}%`}}/></span></>;
 return asLink?<Link to='/mijn/bestellen' className='portal-tile portal-status-good portal-order'>{body}</Link>:<div className='portal-tile portal-status-good portal-order'>{body}</div>;
}

function agoText(c:Json,iso:string,today:string){
 const days=Math.max(0,Math.round((Date.parse(`${today}T12:00:00Z`)-Date.parse(`${iso.slice(0,10)}T12:00:00Z`))/86_400_000));
 if(days===0)return copy(c,'agoToday');if(days===1)return copy(c,'agoYesterday');if(days<7)return fill(copy(c,'agoDays'),{n:days});
 const w=Math.floor(days/7);return w===1?copy(c,'agoWeek'):fill(copy(c,'agoWeeks'),{n:w});
}

/** Start medisch afvallen (v0.1 §6, dt-1/ms-01): besteltegel + check-in + controle; gewichtsring + 2x2 raster; historie. */
function MedicalStart({historyTile}:{historyTile:React.ReactNode}){
 const {d,prac,loc,history,upcoming}=usePortalData();
 const c=d.content;
 const facts=(d.access.program_facts??{}) as Record<string,any>;
 const start=d.access.initial_weight_kg;const goal=d.access.goal_weight_kg;
 const lost=d.weight!==null&&start!==null?start-d.weight:0;
 const kg=(n:number)=>n.toLocaleString('nl-NL',{minimumFractionDigits:1,maximumFractionDigits:1});
 const goalPct=goal!==null&&start!==null&&start>goal?Math.round(Math.min(1,Math.max(0,lost/(start-goal)))*100):null;
 const lastM=[...(d.measurements??[])].filter(m=>m.weight_kg!==null).sort((a,b)=>b.measured_on.localeCompare(a.measured_on))[0];
 const next=upcoming[0];const nextP=next?prac(next.practitioner_id):null;const nextL=next?loc(next.location_id):null;
 const checkin=facts['checkin'] as {label:string;daysLeft:number}|undefined;
 const life=facts['lifestyle'] as {score:number;deltaStart:string}|undefined;
 const heart=facts['heart'] as {percent:number;level:string}|undefined;
 const tip=facts['weekTip'] as {title:string;text:string}|undefined;
 return <>
 <div className='portal-ma-row1'>
  <OrderTile/>
  {checkin&&<PortalTile icon={ClipboardCheck} label={checkin.label} value={fill(copy(c,'daysLeft'),{n:checkin.daysLeft})} sub={copy(c,'checkInSub')} status='soon' to='/mijn/voortgang'/>}
  {next&&<PortalTile icon={CalendarDays} label={copy(c,'doctorReview')} value={fmtDay(next.starts_at)} sub={<>{fmtDay(next.starts_at,{weekday:'short',day:'numeric',month:'short'})}, {fmtTime(next.starts_at)}{nextP&&<> · <Photo src={nextP.photo} size={18}/>{nextP.first_name}{nextL?.kind==='online'?`, ${copy(c,'online')}`:''}</>}</>} to='/mijn/afspraken'/>}
 </div>
 <div className='portal-ma-row2'>
  <section className='portal-card portal-weight-card'>
   <Link to='/mijn/voortgang' className='portal-btn-secondary portal-weight-update'>+ {copy(c,'update')}</Link>
   <Ring size='lg' value={lost} max={goal!==null&&start!==null?start-goal:Math.max(1,lost)}><strong>{kg(lost)} kg</strong><span>{copy(c,'weightLost')}</span>{goalPct!==null&&<span className='portal-chip'>{fill(copy(c,'goalChip'),{p:goalPct})}</span>}</Ring>
   {start!==null&&<p className='portal-sub portal-center'>{fill(copy(c,'weightLine'),{start:kg(start),nu:d.weight!==null?kg(d.weight):'',doel:goal!==null?goal.toLocaleString('nl-NL'):''})}</p>}
   {lastM&&<p className='portal-sub portal-center'>{fill(copy(c,'lastWeighed'),{wanneer:agoText(c,lastM.measured_on,d.today)})}</p>}
  </section>
  <div className='portal-ma-quad'>
   {life&&<PortalTile icon={Sparkles} label={copy(c,'lifestyleLabel')} value={String(life.score).replace('.',',')} sub={fill(copy(c,'lifestyleSub'),{d:life.deltaStart})} status='soon' to='/mijn/voortgang'/>}
   {heart&&<PortalTile icon={HeartPulse} label={copy(c,'heartLabel')} value={`${heart.percent}%`} sub={heart.level} status='action' to='/mijn/voortgang'/>}
   {typeof facts['weeksWeighed']==='number'&&<PortalTile icon={Scale} label='' value={fill(copy(c,'weeksWeighed'),{n:facts['weeksWeighed']})} sub={copy(c,'weeksWeighedSub')} status='good' to='/mijn/voortgang'/>}
   {tip&&<div className='portal-tile'><span className='portal-icon'><Star size={20} strokeWidth={1.7}/></span><span className='portal-tile-label'>{tip.title}</span><span className='portal-tile-sub'>{tip.text}</span></div>}
  </div>
 </div>
 {d.access.cosmetic_history_count>0&&history.length>0&&<div className='portal-ma-history'>{historyTile}</div>}
 </>;
}

/** Cosmetic Start (v0.2 §5): arts card, behandeltraject, feedback, opnieuw boeken, ontdekken. Desktop: twee kolommen. */
function CosmeticStart(){
 const {d,treat,prac,loc,role,siteCat,history,upcoming}=usePortalData();
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
 const hadCategories=new Set(history.map(a=>siteCat(a.treatment_id)?.id).filter(Boolean));
 const discover=d.categories.filter(cat=>!cat.parent_id&&cat.name_nl!=='Medisch afvallen'&&!hadCategories.has(cat.id)).slice(0,4);
 return <>
 <div className='portal-cos-grid'>
  <div>
   {course&&courseT(course.a,treat,c,courseDone,courseNext,prac,loc)}
  </div>
  <div>
  {doctor&&<section className='portal-card'>
   <div className='portal-doctor'><Photo src={doctor.photo} size={64}/><div className='min-w-0'><p className='portal-card-label'>{copy(c,'yourDoctor')}</p><h2>{pracName(doctor)}</h2><p className='portal-sub'>{fill(copy(c,'visitsLine'),{n:doctorVisits.length,voornaam:doctor.first_name,datum:fmtDay(doctorVisits[0]?.starts_at??d.today)})}</p></div></div>
   <Link to='/boeken' search={{t:doctorVisits[0]?.treatment_id,p:doctor.id}} className='portal-btn-primary'><CalendarDays size={16}/>{fill(copy(c,'planWith'),{voornaam:doctor.first_name})}</Link>
   {second&&<div className='portal-doctor-second'><Photo src={second.photo} size={36}/><div className='min-w-0 flex-1'><p className='portal-row-title'>{pracName(second)}</p><p className='portal-sub'>{fill(copy(c,'alsoYour'),{rol:role(second.role_id).toLowerCase()})}</p></div><Link to='/boeken' search={{p:second.id}} className='portal-chip'>{copy(c,'plan')}</Link></div>}
  </section>}
  {due&&dueT&&dueP&&<section className='portal-card portal-card-amber'>
   <div className='portal-doctor'><Photo src={dueP.photo} size={44}/><div className='min-w-0'><p className='portal-card-label'>{copy(c,'feedbackTitle')}</p><p className='portal-row-title'>{dueT.name_nl} bij {dueP.first_name}, {fmtDay(due.starts_at)}</p></div></div>
   <div className='portal-stars'>{[1,2,3,4,5].map(n=><Link key={n} to='/mijn/feedback/$appointmentId' params={{appointmentId:due.id}} search={{rating:n}} aria-label={`${n} sterren`}><Star size={30} strokeWidth={1.7}/></Link>)}</div>
   <p className='portal-sub'>{fill(copy(c,'feedbackGoesTo'),{voornaam:dueP.first_name})}</p>
  </section>}
  {rebook.length>0&&<section className='portal-card'>
   <h2 className='portal-card-heading'>{copy(c,'rebookTitle')}</h2>
   <div className='portal-rows'>{rebook.map(a=>{const t=treat(a.treatment_id),p=prac(a.practitioner_id),s=readPortalSettings(t?.portal_settings),weeks=weeksSince(a.starts_at,d.today),dueWeeks=s.reminder_weeks&&s.reminder_weeks>0&&weeks>=s.reminder_weeks;
    return <div key={a.id} className='portal-row'><Photo src={p?.photo} size={40}/><div className='min-w-0 flex-1'><p className='portal-sub'>Bij {p?pracName(p):''}</p><p className='portal-row-title'>{t?.name_nl}</p><p className='portal-sub'>{dueWeeks?<><span className='portal-dot-amber'/>{fill(copy(c,'weeksAgo'),{n:weeks})}</>:fmtDay(a.starts_at)}</p></div><Link to='/boeken' search={{t:a.treatment_id,p:a.practitioner_id??undefined}} className='portal-chip'>{copy(c,'rebook')}</Link></div>;})}</div>
   <Link to='/mijn/historie' className='portal-link'>{fill(copy(c,'viewAllHistory'),{n:history.length})}</Link>
  </section>}
  </div>
 </div>
 {discover.length>0&&<section><h2 className='portal-card-heading portal-discover-heading'>{copy(c,'discoverTitle')}</h2><div className='portal-discover'>{discover.map(cat=><Link key={cat.id} to='/boeken' search={{cat:cat.id}} className='portal-discover-card'>{cat.icon&&<img src={`/treatment-icons/${cat.icon}.png`} alt='' className='size-7'/>}<p className='portal-row-title'>{cat.name_nl}</p><p className='portal-sub'>{copy(c,'discoverPlaceholder')||'Ontdek wat deze behandeling voor je kan doen.'}</p><span className='portal-link'>{copy(c,'moreInfo')}</span></Link>)}</div></section>}
 </>;
}
function courseT(a:HistoryItem,treat:(id:string)=>{name_nl:string;icon:string|null;portal_settings?:Json}|undefined,c:Json,courseDone:number,courseNext:{id:string;starts_at:string;practitioner_id:string|null;location_id:string|null;treatment_id?:string}|undefined,prac:(id:string|null|undefined)=>PortalPractitioner|undefined,loc:(id:string|null|undefined)=>{name:string}|undefined){
 const t=treat(a.treatment_id);const s=readPortalSettings((t as {portal_settings?:unknown}|undefined)?.portal_settings);const n=s.course_count??1;const p=courseNext?prac(courseNext.practitioner_id):undefined;
 return <section className='portal-card'>
  <div className='portal-doctor'><span className='portal-icon'><CourseIcon tid={a.treatment_id} fallback={t?.icon}/></span><div><p className='portal-card-label'>{copy(c,'courseLabel')}</p><h2>{t?.name_nl}</h2></div></div>
  <div className='portal-course'><Ring value={courseDone} max={n}><strong>{courseDone} van {n}</strong><span>{copy(c,'ofTreatments')}</span></Ring>
  {courseNext&&<div className='portal-course-next'><p className='portal-sub'>{fill(copy(c,'nextTreatment'),{x:courseDone+1,n})}</p><p className='portal-row-title'>{fmtDay(courseNext.starts_at,{weekday:'short',day:'numeric',month:'short'})}, {fmtTime(courseNext.starts_at)}</p><p className='portal-sub portal-with-photo'>{p&&<Photo src={p.photo} size={18}/>}{p?pracName(p):''} · {loc(courseNext.location_id)?.name}</p></div>}</div>
  {s.course_interval&&<p className='portal-sub'>{s.course_interval}</p>}
 </section>;
}
/** Behandelicoon met categorie-fallback. */
export function CourseIcon({tid,fallback}:{tid:string;fallback:string|null|undefined}){
 const {treatIcon}=usePortalData();const icon=fallback??treatIcon(tid);
 return icon?<img src={`/treatment-icons/${icon}.png`} alt='' className='size-5'/>:<Syringe size={18}/>;
}

/** Green confirmation tile after a booking confirmed via the login link (v0.1 §2). */
function ConfirmedTile({a}:{a:{id:string;starts_at:string;treatment_id:string;practitioner_id:string|null;location_id:string|null}}){
 const {d,treat,prac,loc,role}=usePortalData();const c=d.content;
 const p=prac(a.practitioner_id);const t=treat(a.treatment_id);
 return <section className='portal-card portal-confirm'>
  <p className='portal-card-label'>{copy(c,'confirmedLabel')}</p>
  <p className='portal-confirm-big'>{fmtDay(a.starts_at,{weekday:'long',day:'numeric',month:'long'})}, {fmtTime(a.starts_at)}</p>
  <p className='portal-sub'>{t?.name_nl}{loc(a.location_id)?` · ${loc(a.location_id)!.name}`:''}</p>
  {p&&<div className='portal-confirm-row'><Photo src={p.photo} size={36}/><div className='min-w-0'><p className='portal-row-title'>{pracName(p)}</p><p className='portal-sub'>Je {role(p.role_id).toLowerCase()}</p></div></div>}
  <Link to='/boeken' search={{t:a.treatment_id,l:a.location_id??undefined,p:a.practitioner_id??undefined}} className='portal-link'>{copy(c,'confirmedAdjust')}</Link>
 </section>;
}
