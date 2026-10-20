import { Link } from '@tanstack/react-router';
import { TriangleAlert, Syringe } from 'lucide-react';
import { copy } from './PortalShell';
import { usePortalData, fill, Ring } from './PortalStart';

/** Programma (v0.1 §6): maandring, maandtekst, medicatiekaart, bijwerking melden, tips per thema. */
export function PortalProgram(){
 const {d}=usePortalData();const c=d.content;
 const pkg=d.landing.package;
 const facts=(d.access.program_facts??{}) as Record<string,any>;
 const prog=facts.programma as {monthText:string;strengthSince:string;nextStep:string;injectLink:string;tipCategories:{icon:string;label:string;n:number}[]}|undefined;
 if(!pkg)return <p className='portal-pending'>{copy(c,'phasePending')}</p>;
 const month=Math.max(1,(Number(d.today.slice(0,4))-Number(pkg.start_date.slice(0,4)))*12+Number(d.today.slice(5,7))-Number(pkg.start_date.slice(5,7))+1);
 const week=Math.min(4,Math.max(1,Math.ceil(Number(d.today.slice(8,10))/7)));
 const med=(d.access.medication??'').replace(/\s*[\d,.]+\s*mg\s*$/i,'').trim()||'Medicatie';
 return <><h1>{copy(c,'programTitle')}</h1>
 <section className='portal-card portal-weight'>
  <Ring value={month} max={pkg.months}><strong>Maand {month}</strong><span>{fill(copy(c,'monthOf'),{m:pkg.months})}</span></Ring>
  <div className='portal-weight-side'><span className='portal-chip'>{fill(copy(c,'weekLabel'),{w:week})}</span></div>
 </section>
 {prog?.monthText&&<section className='portal-card'><p className='portal-card-label'>{copy(c,'thisMonth')}</p><p className='portal-sub' style={{color:'var(--foreground)'}}>{prog.monthText}</p></section>}
 <section className='portal-card'>
  <div className='portal-doctor'><span className='portal-icon'><Syringe size={18}/></span><h2 className='portal-card-heading'>{fill(copy(c,'medTitle'),{medicijn:med})}</h2></div>
  <div className='portal-rows'>
   <div className='portal-row'><span className='portal-sub flex-1'>{copy(c,'strengthNow')}</span><span className='portal-row-title'>{prog?.strengthSince}</span></div>
   <div className='portal-row'><span className='portal-sub flex-1'>{copy(c,'nextStep')}</span><span className='portal-row-title'>{prog?.nextStep}</span></div>
  </div>
  {prog?.injectLink&&<span className='portal-link'>{prog.injectLink}</span>}
 </section>
 <Link to='/mijn/berichten' className='portal-card portal-card-amber' style={{textDecoration:'none'}}>
  <div className='portal-doctor'><span className='portal-icon'><TriangleAlert size={18}/></span><p className='portal-row-title'>{copy(c,'sideEffect')} <span className='portal-link'>{copy(c,'reportIt')}</span></p></div>
 </Link>
 {(prog?.tipCategories??[]).length>0&&<><h2 className='portal-card-heading portal-discover-heading'>{copy(c,'tipsLabel')}</h2>
 <div className='portal-factor-grid'>{prog!.tipCategories.map(t=><div key={t.icon} className='portal-factor' style={{background:'var(--teal-light)',color:'var(--primary-hover)'}}><p className='portal-row-title'>{t.label}</p><p className='portal-sub'>{t.n} tips</p></div>)}</div></>}
 </>;
}
