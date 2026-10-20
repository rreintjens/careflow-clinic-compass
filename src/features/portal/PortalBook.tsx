import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { copy } from './PortalShell';
import { usePortalData, fmtDay, Photo } from './PortalStart';

/** Afspraak maken (v0.1 §5.4 + v0.2 §7): next appointment, opnieuw bij je behandelaar, of kies een behandeling. */
export function PortalBook(){
 const {d,treat,prac,loc,history,upcoming}=usePortalData();
 const c=d.content;
 const next=upcoming[0];
 const nextT=next?treat(next.treatment_id):null,nextP=next?prac(next.practitioner_id):null;
 // One row per practitioner+treatment from the history, most recent first, max 3.
 const again=[...new Map([...history].sort((a,b)=>b.starts_at.localeCompare(a.starts_at)).map(a=>[`${a.practitioner_id}:${a.treatment_id}`,a])).values()].slice(0,3);
 const mains=d.categories.filter(cat=>!cat.parent_id);
 return <><h1>{copy(c,'bookTitle')||'Afspraak maken'}</h1>
 {next&&nextT&&<div className='portal-card portal-row'>
  <span className='portal-icon'>{nextT.icon?<img src={`/treatment-icons/${nextT.icon}.png`} alt='' className='size-5'/>:null}</span>
  <div className='min-w-0 flex-1'><p className='portal-card-label'>{copy(c,'nextAppointment')}</p><p className='portal-row-title'>{fmtDay(next.starts_at,{weekday:'long',day:'numeric',month:'long'})}, {new Date(next.starts_at).toLocaleTimeString('nl-NL',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit'})}</p><p className='portal-sub portal-with-photo'>{nextP&&<Photo src={nextP.photo} size={18}/>}{nextT.name_nl} · {nextP?`${nextP.first_name} ${nextP.last_name}`:''} · {loc(next.location_id)?.name}</p></div>
  <Link to='/mijn/afspraken' className='portal-chip'>{copy(c,'reschedule')}</Link>
 </div>}
 {again.length>0&&<section className='portal-card'><h2 className='portal-card-heading'>{copy(c,'againWithPractitioner')}</h2><div className='portal-rows'>
  {again.map(a=>{const t=treat(a.treatment_id),p=prac(a.practitioner_id);
   return <div key={a.id} className='portal-row'><Photo src={p?.photo} size={40}/><div className='min-w-0 flex-1'><p className='portal-row-title'>{t?.name_nl}</p><p className='portal-sub'>{p?`${p.first_name} ${p.last_name}`:''} · {fmtDay(a.starts_at)}</p></div><Link to='/boeken' search={{t:a.treatment_id,p:a.practitioner_id??undefined}} className='portal-chip'>{copy(c,'plan')}</Link></div>;})}
 </div></section>}
 <section><h2 className='portal-card-heading portal-discover-heading'>{copy(c,'orChooseTreatment')}</h2><div className='portal-card portal-rows'>
  {mains.map(cat=><Link key={cat.id} to='/boeken' search={{cat:cat.id}} className='portal-row portal-row-link'><span className='portal-icon'>{cat.icon?<img src={`/treatment-icons/${cat.icon}.png`} alt='' className='size-5'/>:null}</span><span className='portal-row-title flex-1'>{cat.name_nl}</span><ChevronRight size={16} className='portal-chevron'/></Link>)}
 </div></section></>;
}
