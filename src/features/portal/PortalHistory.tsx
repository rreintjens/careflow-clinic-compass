import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Star } from 'lucide-react';
import { copy } from './PortalShell';
import { usePortalData, fmtDay, Photo, pracName, CourseIcon } from './PortalStart';
import { readPortalSettings } from '@/domain/portal';

/** Historie (v0.1 §5.2): filter pills per sitecategorie, grouped per year, rows open the detail. */
export function PortalHistory(){
 const {d,treat,prac,loc,role,siteCat,history}=usePortalData();
 const c=d.content;
 const [filter,setFilter]=useState('all');
 const catIds=[...new Set(history.map(a=>siteCat(a.treatment_id)?.id).filter(Boolean))] as string[];
 const shown=history.filter(a=>filter==='all'||siteCat(a.treatment_id)?.id===filter);
 const years=[...new Set(shown.map(a=>new Date(a.starts_at).getFullYear()))].sort((a,b)=>b-a);
 return <><h1>{copy(c,'historyTitle')}</h1><p className='portal-sub portal-page-sub'>{copy(c,'historySub')}</p>
 {catIds.length>0&&<div className='portal-filters'><button type='button' aria-pressed={filter==='all'} className={`portal-filter${filter==='all'?' portal-filter-on':''}`} onClick={()=>setFilter('all')}>{copy(c,'filterAll')}</button>{catIds.map(id=><button key={id} type='button' aria-pressed={filter===id} className={`portal-filter${filter===id?' portal-filter-on':''}`} onClick={()=>setFilter(id)}>{d.categories.find(x=>x.id===id)?.name_nl}</button>)}</div>}
 <div className='portal-history'>
  {years.map(y=><section key={y}><h2 className='portal-year'>{y}</h2><div className='portal-card portal-rows'>
   {shown.filter(a=>new Date(a.starts_at).getFullYear()===y).map(a=>{const t=treat(a.treatment_id),p=prac(a.practitioner_id),fb=(d.feedback??[]).find(f=>f.appointment_id===a.id);
    return <Link key={a.id} to='/mijn/historie/$appointmentId' params={{appointmentId:a.id}} className='portal-row portal-row-link'>
     <span className='portal-icon'><CourseIcon tid={a.treatment_id} fallback={t?.icon}/></span>
     <div className='min-w-0 flex-1'><p className='portal-sub'>{fmtDay(a.starts_at)} · {loc(a.location_id)?.name}</p><p className='portal-row-title'>{t?.name_nl}</p><p className='portal-sub portal-with-photo'>{p&&<Photo src={p.photo} size={18}/>}{p?`${pracName(p)}, ${role(p.role_id).toLowerCase()}`:''}</p></div>
     {fb&&<span className='portal-feedback-mark' aria-label={`${fb.rating} van 5`}><Star size={14} fill='currentColor'/>{fb.rating}</span>}
     <ChevronRight size={16} className='portal-chevron'/></Link>;})}
  </div></section>)}
  {shown.length===0&&<p className='portal-pending'>{copy(c,'historyEmpty')||'Nog geen behandelingen.'}</p>}
 </div></>;
}

/** Treatment detail (v0.1 §5.3). */
export function PortalHistoryDetail({appointmentId}:{appointmentId:string}){
 const {d,treat,prac,loc,role,history}=usePortalData();
 const c=d.content;
 const a=history.find(x=>x.id===appointmentId);
 if(!a)return <p className='portal-pending'>{copy(c,'historyEmpty')||'Deze behandeling is niet gevonden.'}</p>;
 const t=treat(a.treatment_id),p=prac(a.practitioner_id),s=readPortalSettings(t?.portal_settings);
 const fb=(d.feedback??[]).find(f=>f.appointment_id===a.id);
 const isDoctor=(role(p?.role_id)||'').toLowerCase().includes('arts');
 return <><Link to='/mijn/historie' className='portal-back'>‹ {copy(c,'historyTitle')}</Link>
 <div className='portal-card'>
  <div className='portal-doctor'><span className='portal-icon'><CourseIcon tid={a.treatment_id} fallback={t?.icon}/></span><div><h1 className='portal-detail-title'>{t?.name_nl}</h1><p className='portal-sub'>{fmtDay(a.starts_at,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p></div></div>
  <div className='portal-pills'><span>{loc(a.location_id)?.name}</span><span>{t?.duration_min} min</span></div>
  {p&&<div className='portal-detail-section'><h2>{copy(c,'treatedBy')}</h2><div className='portal-doctor'><Photo src={p.photo} size={48}/><div><p className='portal-row-title'>{pracName(p)}</p><p className='portal-sub'>{role(p.role_id)}{isDoctor?` · ${copy(c,'bigRegistered')}`:''}</p></div></div></div>}
  {(s.aftercare_tips??[]).length>0&&<div className='portal-detail-section'><h2>{copy(c,'aftercare')}</h2><ul className='portal-tips'>{s.aftercare_tips!.map((tip,i)=><li key={i}><span className='portal-tip-check'>✓</span>{tip}</li>)}</ul></div>}
  {fb&&<div className='portal-detail-section'><h2>{copy(c,'feedbackTitle')}</h2><p className='portal-sub'><span className='portal-feedback-mark'><Star size={14} fill='currentColor'/>{fb.rating}</span> {fb.comment}</p></div>}
  <div className='portal-detail-actions'>
   <Link to='/boeken' search={{t:a.treatment_id,p:a.practitioner_id??undefined}} className='portal-btn-primary'>{fill(copy(c,'replanWith'),{voornaam:p?.first_name??''})}</Link>
   <Link to='/mijn/berichten' className='portal-btn-secondary'>{copy(c,'askQuestion')}</Link>
  </div>
 </div></>;
}
function fill(s:string,vars:Record<string,string|number>){return s.replace(/\{(\w+)\}/g,(_,k:string)=>String(vars[k]??''));}
