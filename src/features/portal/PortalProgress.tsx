import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { copy } from './PortalShell';
import { usePortalData, fmtDay, fill, Ring } from './PortalStart';
import { bmiOf } from '@/domain/measurements';

const nl=(n:number,max=1)=>n.toLocaleString('nl-NL',{maximumFractionDigits:max});
type Fact={key:string;label:string;line:string;status:'good'|'soon'|'action'};

/** Voortgang (v0.1 §6): gesegmenteerde tabs Gewicht / Leefstijl / Hartrisico. */
export function PortalProgress(){
 const {d}=usePortalData();const c=d.content;
 const [tab,setTab]=useState<'gewicht'|'leefstijl'|'hartrisico'>('gewicht');
 const facts=(d.access.program_facts??{}) as Record<string,any>;
 return <><h1>{copy(c,'progressTitle')}</h1>
 <div className='portal-segmented' role='tablist'>
  {(['gewicht','leefstijl','hartrisico'] as const).map(t=><button key={t} type='button' role='tab' aria-pressed={tab===t} onClick={()=>setTab(t)}>{copy(c,t==='gewicht'?'tabWeight':t==='leefstijl'?'tabLifestyle':'tabHeart')}</button>)}
 </div>
 {tab==='gewicht'&&<WeightTab/>}
 {tab==='leefstijl'&&<LifestyleTab facts={facts['lifestyle']}/>}
 {tab==='hartrisico'&&<HeartTab facts={facts['heart']}/>}
 </>;
}

function WeightTab(){
 const {d}=usePortalData();const c=d.content;
 const ms=[...(d.measurements??[])].filter(m=>m.weight_kg!==null).sort((a,b)=>a.measured_on.localeCompare(b.measured_on));
 const last=ms.at(-1);const first=ms[0];
 const cur=last?.weight_kg??null;const height=last?.height_cm??null;
 const bmi=cur!==null?bmiOf(cur,height):null;
 const firstBmi=first?.weight_kg!=null?bmiOf(first.weight_kg,first.height_cm??height):null;
 const waist=last?.waist_cm??null;const firstWaist=first?.waist_cm??null;
 const goal=d.access.goal_weight_kg;
 const left=goal!==null&&cur!==null?cur-goal:null;
 const weeks=ms.length>1?Math.max(1,Math.round((Date.parse(last!.measured_on)-Date.parse(first!.measured_on))/(7*86_400_000))):1;
 const avg=ms.length>1&&first?.weight_kg!=null&&cur!==null?(first.weight_kg-cur)/weeks:null;
 return <>
 {cur!==null&&<section className='portal-card'>
  <div className='portal-doctor'><div><p className='portal-card-label'>{copy(c,'yourWeight')}</p><p className='portal-tile-value'>{nl(cur)} kg</p></div>{first&&first.weight_kg!==null&&<span className='portal-chip'>{nl(cur-first.weight_kg)} kg</span>}</div>
  <WeightChart ms={ms} goal={goal}/>
 </section>}
 <div className='portal-start-grid'>
  {bmi!==null&&<div className='portal-tile portal-status-action'><span className='portal-tile-label'>{copy(c,'bmiLabel')}</span><strong className='portal-tile-value'>{nl(bmi)}</strong>{firstBmi!==null&&<span className='portal-tile-sub'>{fill(copy(c,'was'),{v:nl(firstBmi)})}</span>}</div>}
  {waist!==null&&<div className='portal-tile portal-status-action'><span className='portal-tile-label'>{copy(c,'waistLabel')}</span><strong className='portal-tile-value'>{nl(waist,0)} cm</strong>{firstWaist!==null&&<span className='portal-tile-sub'>{fill(copy(c,'was'),{v:`${nl(firstWaist,0)} cm`})}</span>}</div>}
 </div>
 {goal!==null&&left!==null&&<section className='portal-card portal-status-good'>
  <p className='portal-card-label'>{fill(copy(c,'goalLabel'),{g:nl(goal,0)})}</p>
  <p className='portal-tile-value'>{fill(copy(c,'goalLeft'),{x:nl(left)})}</p>
  {avg!==null&&<p className='portal-tile-sub'>{fill(copy(c,'goalAvg'),{a:nl(avg)})}</p>}
 </section>}
 {ms.length>0&&<section className='portal-card'><h2 className='portal-card-heading'>{copy(c,'lastMeasurements')}</h2><div className='portal-rows'>
  {[...ms].reverse().slice(0,6).map((m,i,arr)=>{const prev=arr[i+1];const delta=prev&&prev.weight_kg!==null&&m.weight_kg!==null?m.weight_kg-prev.weight_kg:null;
   return <div key={m.measured_on} className='portal-row'><span className='portal-sub flex-1'>{fmtDay(m.measured_on)}</span><span className='portal-row-title'>{m.weight_kg!==null?`${nl(m.weight_kg)} kg`:''}</span>{delta!==null&&<span className='portal-sub'>{delta>0?'+':''}{nl(delta)}</span>}</div>;})}
 </div></section>}
 </>;
}

/** Monotone kubische curve (Fritsch–Carlson) door de punten; geen rechte segmenten. */
export function monotonePath(P:{x:number;y:number}[]){
 const n=P.length;if(n<2)return '';
 const dx=P.slice(1).map((p,i)=>p.x-P[i]!.x),sl=P.slice(1).map((p,i)=>(p.y-P[i]!.y)/(dx[i]||1));
 const m=P.map((_,i)=>i===0?sl[0]!:i===n-1?sl[n-2]!:sl[i-1]!*sl[i]!<=0?0:3*(dx[i-1]!+dx[i]!)/((2*dx[i]!+dx[i-1]!)/sl[i-1]!+(dx[i]!+2*dx[i-1]!)/sl[i]!));
 let d=`M${P[0]!.x.toFixed(1)},${P[0]!.y.toFixed(1)}`;
 for(let i=0;i<n-1;i++){const h=dx[i]!/3;d+=` C${(P[i]!.x+h).toFixed(1)},${(P[i]!.y+m[i]!*h).toFixed(1)} ${(P[i+1]!.x-h).toFixed(1)},${(P[i+1]!.y-m[i+1]!*h).toFixed(1)} ${P[i+1]!.x.toFixed(1)},${P[i+1]!.y.toFixed(1)}`;}
 return d;
}

function WeightChart({ms,goal}:{ms:{measured_on:string;weight_kg:number|null}[];goal:number|null}){
 const {d}=usePortalData();const c=d.content;
 const pts=ms.filter(m=>m.weight_kg!==null) as {measured_on:string;weight_kg:number}[];
 if(pts.length<2)return null;
 const w=340,h=220,l=40,r=12,t=14,b=26;
 const vals=[...pts.map(p=>p.weight_kg),...(goal!==null?[goal]:[])];
 const min=Math.floor(Math.min(...vals)-2),max=Math.ceil(Math.max(...vals)+2);
 const t0=Date.parse(pts[0]!.measured_on),t1=Date.parse(pts.at(-1)!.measured_on);
 const x=(iso:string)=>l+(Date.parse(iso)-t0)/(t1-t0||1)*(w-l-r);
 const y=(v:number)=>t+(max-v)/(max-min)*(h-t-b);
 const P=pts.map(p=>({x:x(p.measured_on),y:y(p.weight_kg)}));
 const step=Math.max(1,Math.round((max-min)/4));const ticks:number[]=[];for(let v=min;v<=max;v+=step)ticks.push(v);
 const week=(iso:string)=>Math.round((Date.parse(iso)-t0)/(7*86_400_000));
 const xl=[pts[0]!,pts[Math.floor((pts.length-1)/2)]!,pts.at(-1)!].filter((p,i,a)=>a.findIndex(q=>q.measured_on===p.measured_on)===i);
 return <svg className='portal-chart portal-chart-weight' viewBox={`0 0 ${w} ${h}`} role='img' aria-label='Gewichtsverloop'>
  {ticks.map(v=><g key={v}><line x1={l} x2={w-r} y1={y(v)} y2={y(v)} stroke='var(--portal-row-line)'/><text x={l-6} y={y(v)+3} textAnchor='end' fontSize='10' fill='var(--muted-foreground)'>{v} kg</text></g>)}
  {goal!==null&&<><line x1={l} x2={w-r} y1={y(goal)} y2={y(goal)} stroke='var(--portal-good-stroke)' strokeDasharray='4 4' strokeWidth='1.5'/><text x={w-r} y={y(goal)-5} textAnchor='end' fontSize='10' fontWeight='600' fill='var(--portal-good-text)'>{fill(copy(c,'goalLine'),{g:nl(goal,0)})}</text></>}
  <path d={monotonePath(P)} fill='none' stroke='var(--primary)' strokeWidth='2.5' strokeLinecap='round'/>
  {P.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r='3.5' fill='var(--primary)'/>)}
  {xl.map((p,i)=><text key={p.measured_on} x={x(p.measured_on)} y={h-6} textAnchor={i===0?'start':i===xl.length-1?'end':'middle'} fontSize='10' fill='var(--muted-foreground)'>{i===0?copy(c,'chartStart'):fill(copy(c,'chartWeek'),{n:week(p.measured_on)})}</text>)}
 </svg>;
}

function LifestyleTab({facts}:{facts:any}){
 const {d}=usePortalData();const c=d.content;
 if(!facts)return <p className='portal-pending'>{copy(c,'phasePending')}</p>;
 const subs=(facts.subs??[]) as Fact[];
 return <>
 <section className='portal-card portal-weight'>
  <Ring value={facts.score} max={10}><strong>{nl(facts.score)}</strong><span>{copy(c,'scoreOf')}</span></Ring>
  <div className='portal-weight-side'><span className='portal-chip'>{facts.deltaStart} {copy(c,'sinceStart')}</span></div>
 </section>
 <div className='portal-factor-grid'>{subs.map(s=><div key={s.key} className={`portal-factor portal-factor-${s.status}`}><p className='portal-row-title'>{s.label}</p><p className='portal-sub'>{s.line}</p></div>)}</div>
 {facts.advice&&<section className='portal-card portal-status-good'><p className='portal-card-label'>{copy(c,'adviceForYou')}</p><p className='portal-row-title'>{facts.advice.title}</p><p className='portal-tile-sub'>{facts.advice.text}</p></section>}
 </>;
}

function HeartTab({facts}:{facts:any}){
 const {d}=usePortalData();const c=d.content;
 if(!facts)return <p className='portal-pending'>{copy(c,'phasePending')}</p>;
 const factors=(facts.factors??[]) as Fact[];
 const age=facts.age??41;
 return <>
 <section className='portal-card portal-status-action'>
  <p className='portal-card-label'>{copy(c,'heartLabel')}</p>
  <p className='portal-tile-value'>{facts.percent}% <span className='portal-tile-sub'>· {facts.level}</span></p>
  <p className='portal-tile-sub'>{copy(c,'heartIntro')}</p>
  <HeartChart percent={facts.percent} age={age} nowLabel={copy(c,'heartNow')} healthyLabel={copy(c,'heartHealthy')}/>
 </section>
 <div className='portal-factor-grid'>{factors.map(f=><div key={f.key} className={`portal-factor portal-factor-${f.status}`}><p className='portal-row-title'>{f.label}</p><p className='portal-sub'>{f.line}</p></div>)}</div>
 {facts.help&&<section className='portal-card portal-status-good'><p className='portal-card-label'>{copy(c,'whatHelps')}</p><p className='portal-row-title'>{facts.help.title}</p><p className='portal-tile-sub'>{facts.help.text}</p></section>}
 </>;
}

/** Vereenvoudigde verlooplijn: huidig pad naar 80 jaar en een gezonde lijn. */
function HeartChart({percent,age,nowLabel,healthyLabel}:{percent:number;age:number;nowLabel:string;healthyLabel:string}){
 const w=320,h=140,pad=10;
 const years=Math.max(5,80-age);
 const x=(i:number)=>pad+i*(w-2*pad)/4;
 const y=(v:number)=>h-pad-Math.min(1,v/100)*(h-2*pad);
 const nowEnd=Math.min(95,percent+years*1.2);
 const healthyEnd=Math.max(5,percent*0.4);
 return <svg className='portal-chart' viewBox={`0 0 ${w} ${h}`} role='img' aria-label='Hartrisico-verloop'>
  <path d={`M${x(0)},${y(percent)} L${x(4)},${y(nowEnd)}`} fill='none' stroke='var(--portal-action-stroke)' strokeWidth='2.5' strokeLinecap='round'/>
  <path d={`M${x(0)},${y(percent)} L${x(4)},${y(healthyEnd)}`} fill='none' stroke='var(--portal-good-stroke)' strokeWidth='2.5' strokeLinecap='round'/>
  <circle cx={x(0)} cy={y(percent)} r='4' fill='var(--portal-action-stroke)'/>
  <text x={x(4)} y={y(nowEnd)-6} textAnchor='end' fontSize='10' fill='var(--portal-action-text)'>{nowLabel}</text>
  <text x={x(4)} y={y(healthyEnd)+14} textAnchor='end' fontSize='10' fill='var(--portal-good-text)'>{healthyLabel}</text>
  <text x={x(0)} y={h-2} fontSize='10' fill='var(--muted-foreground)'>{age}</text>
  <text x={x(4)} y={h-2} textAnchor='end' fontSize='10' fill='var(--muted-foreground)'>80</text>
 </svg>;
}
