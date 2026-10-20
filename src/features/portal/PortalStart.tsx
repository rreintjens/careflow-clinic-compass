import { useSuspenseQuery } from '@tanstack/react-query';
import { History, ClipboardCheck, CalendarDays, ShieldCheck, Footprints, MapPin, Syringe } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useEffect,useState } from 'react';
import { portalQuery } from '@/data/portal';
import { copy, PortalTile } from './PortalShell';

export function PortalStart(){
 const {data:d}=useSuspenseQuery(portalQuery);const [greeting,setGreeting]=useState('Goedemorgen');
 useEffect(()=>{const hour=Number(new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',hour:'numeric',hourCycle:'h23'}).format(new Date()));setGreeting(hour<12?'Goedemorgen':hour<18?'Goedemiddag':'Goedenavond');},[]);
 const c=d.content;const lost=d.weight!==null&&d.access.initial_weight_kg!==null?(d.access.initial_weight_kg-d.weight).toLocaleString('nl-NL',{maximumFractionDigits:1}):'';
 const month=d.landing.package?Math.max(1,(Number(d.today.slice(0,4))-Number(d.landing.package.start_date.slice(0,4)))*12+Number(d.today.slice(5,7))-Number(d.landing.package.start_date.slice(5,7))+1):1;
 const history=<PortalTile icon={History} label={copy(c,d.landing.kind==='active'?'combinedHistory':'history')} value={String(d.access.cosmetic_history_count)} sub={copy(c,'historySub')} to='/mijn/historie'/>;
 return <><p className='portal-date'>{new Date(`${d.today}T12:00:00Z`).toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'})}</p><h1>{greeting}, <span>{d.patient.first_name}</span></h1><div className='portal-pills'>{d.landing.kind==='active'?<><span><CalendarDays size={14}/>Maand {month} {copy(c,'programme')}</span><span><Syringe size={14}/>{d.access.medication}</span></>:<span><MapPin size={14}/>Kliniek {d.access.clinic_label}</span>}</div>
 <div className='portal-start-grid'>
 {d.landing.kind==='active'&&<><PortalTile icon={CalendarDays} label={copy(c,'activeLabel')} value={`Maand ${month}`} sub={d.access.medication??''} status='neutral' to='/mijn/afspraken'/><PortalTile icon={Footprints} label={copy(c,'lost')} value={`${lost} kg`} status='good' to='/mijn/voortgang'/>{d.access.cosmetic_history_count>0&&history}</>}
 {d.landing.kind==='starter'&&<><PortalTile icon={ClipboardCheck} label={copy(c,'starterLabel')} value={copy(c,'questionnaire')} sub={copy(c,'questionnaireSub')} status='soon' to='/mijn/afspraken'/><PortalTile icon={ShieldCheck} label={copy(c,'starterLabel')} value={copy(c,'consents')} sub={copy(c,'consentsSub')} status='soon' to='/mijn/profiel'/></>}
 {d.landing.kind==='stopped'&&<div className='portal-tile portal-status-good portal-stopped'><span className='portal-icon'><Footprints size={20}/></span><span className='portal-tile-label'>{copy(c,'stoppedLabel').replace('{datum}',new Date(`${d.landing.stoppedOn}T12:00:00Z`).toLocaleDateString('nl-NL',{day:'numeric',month:'long'}))}</span><strong className='portal-tile-value'>{lost} kg</strong><span className='portal-tile-sub'>{copy(c,'lost')}</span><Link to='/boeken' className='portal-restart'>{copy(c,'restart')}</Link></div>}
 {(d.landing.kind==='general'||d.landing.kind==='stopped')&&history}
 </div></>;
}
