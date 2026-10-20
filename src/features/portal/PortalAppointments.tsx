import { Link } from '@tanstack/react-router';
import { Video, Check, CalendarPlus } from 'lucide-react';
import { copy } from './PortalShell';
import { usePortalData, fmtDay, fmtTime, fill, Photo, pracName } from './PortalStart';

/** Afspraken (v0.1 §6): volgende afspraak met deelnameknop, extra afspraak, eerdere afspraken. */
export function PortalAppointments(){
 const {d,treat,prac,loc,role,history,upcoming}=usePortalData();
 const c=d.content;
 const next=upcoming[0];
 const nextT=next?treat(next.treatment_id):null,nextP=next?prac(next.practitioner_id):null;
 const days=next?Math.max(0,Math.ceil((Date.parse(next.starts_at)-Date.now())/86_400_000)):0;
 const joinable=next?Date.parse(next.starts_at)-Date.now()<=10*60_000:false;
 const online=next?loc(next.location_id)?.kind==='online'||!!next.meet_link:false;
 return <><h1>{copy(c,'apptsTitle')}</h1>
 {next&&nextT&&<section className='portal-card'>
  <div className='portal-tile-head'><span className='portal-icon'>{online?<Video size={18}/>:<CalendarPlus size={18}/>}</span><span className='portal-chip'>{days===0?copy(c,'today'):fill(copy(c,'inDays'),{n:days})}</span></div>
  <div><p className='portal-card-label'>{nextT.name_nl}</p><p className='portal-detail-title'>{fmtDay(next.starts_at,{weekday:'short',day:'numeric',month:'short'})}, {fmtTime(next.starts_at)}</p><p className='portal-sub'>{online?copy(c,'videoVia'):loc(next.location_id)?.name}</p></div>
  {nextP&&<div className='portal-doctor'><Photo src={nextP.photo} size={40}/><div><p className='portal-row-title'>{pracName(nextP)}</p><p className='portal-sub'>Je {role(nextP.role_id).toLowerCase()}</p></div></div>}
  <div className='portal-detail-actions' style={{flexDirection:'row',gap:10}}>
   {online&&next.meet_link?<a href={next.meet_link} target='_blank' rel='noreferrer' className='portal-btn-primary' style={{flex:1,pointerEvents:joinable?'auto':'none',opacity:joinable?1:.5}} aria-disabled={!joinable}>{copy(c,'join')}</a>:null}
   <Link to='/boeken' search={{t:next.treatment_id,p:next.practitioner_id??undefined}} className='portal-btn-secondary' style={{flex:1}}>{copy(c,'reschedule')}</Link>
  </div>
  {online&&<p className='portal-sub'>{copy(c,'joinNote')}</p>}
 </section>}
 <Link to='/boeken' className='portal-btn-secondary portal-btn-block'>+ {copy(c,'planExtra')}</Link>
 {history.length>0&&<section className='portal-card' style={{marginTop:16}}><h2 className='portal-card-heading'>{copy(c,'earlier')}</h2><div className='portal-rows'>
  {history.slice(0,8).map((a,i)=>{const t=treat(a.treatment_id),p=prac(a.practitioner_id);
   return <div key={a.id} className='portal-row'><span className='portal-icon' style={{fontSize:13,fontWeight:600,color:'var(--primary-hover)'}}>{history.length-i}</span><div className='min-w-0 flex-1'><p className='portal-row-title'>{t?.name_nl}</p><p className='portal-sub'>{fmtDay(a.starts_at)} · {p?pracName(p):''}{loc(a.location_id)?.kind==='online'?' · video':''}</p></div><span className='portal-tip-check'><Check size={12}/></span></div>;})}
 </div></section>}
 </>;
}
