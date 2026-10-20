import { useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ShoppingCart, Check, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';
import { copy } from './PortalShell';
import { usePortalData, fill, OrderTile } from './PortalStart';
import { readMaConfig, monthPrice, packageTotal, packageSavings, strengthState, type MaConfig } from '@/domain/portal';
import { placePortalOrder } from '@/data/portal.functions';

const eur=(n:number)=>`€ ${n.toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const mg=(v:number)=>`${String(v).replace('.',',')} mg`;

type Draft={months:number;strengths:number[];support:string;extras:string[];remark:string;mode:'deliver'|'pickup';delivery:string;payment:string};

/** Bestellen (v0.1 §6 + v0.2): medicatiekaart, voorbestellen, pakketkiezer met states, afrekenflow. */
export function PortalOrder(){
 const {d}=usePortalData();const c=d.content;
 const cfg=readMaConfig((c as Record<string,unknown>)?.['maConfig']);
 const pkg=d.landing.package;
 const [draft,setDraft]=useState<Draft|null>(null);
 if(!cfg||!pkg)return <p className='portal-pending'>{copy(c,'phasePending')}</p>;
 if(draft)return <Checkout draft={draft} setDraft={setDraft} cfg={cfg}/>;
 return <OrderPicker cfg={cfg} onStart={setDraft}/>;
}

function OrderPicker({cfg,onStart}:{cfg:MaConfig;onStart:(d:Draft)=>void}){
 const {d}=usePortalData();const c=d.content;
 const pkg=d.landing.package!;
 const month=Math.max(1,(Number(d.today.slice(0,4))-Number(pkg.start_date.slice(0,4)))*12+Number(d.today.slice(5,7))-Number(pkg.start_date.slice(5,7))+1);
 const curStrengths=((pkg as {strengths?:unknown}).strengths as number[]|null)??[];
 const curIdx=Math.max(0,cfg.strengths.indexOf(curStrengths[Math.min(month,curStrengths.length)-1]??cfg.strengths[0]??0));
 const med=(d.access.medication??'').replace(/\s*[\d,.]+\s*mg\s*$/i,'').trim()||'Medicatie';
 const facts=(d.access.program_facts??{}) as Record<string,any>;
 const prog=facts['programma'] as {strengthSince:string;nextStep:string}|undefined;
 const [open,setOpen]=useState<number|null>(null);
 const [choice,setChoice]=useState<{months:number;strengths:number[]}|null>(null);
 const total=choice?packageTotal(cfg,choice.strengths,choice.months):0;
 const savings=choice?packageSavings(cfg,choice.strengths,choice.months):0;
 const hasReview=choice?choice.strengths.some((s,i)=>strengthState(s,i===0?curIdx:choice.strengths[i-1]!)==='review'):false;
 return <><h1>{copy(c,'orderTitle')}</h1>
 <section className='portal-card'>
  <p className='portal-card-label'>{copy(c,'yourMedication')}</p>
  <p className='portal-detail-title'>{med}</p>
  <p className='portal-sub'>{prog?.strengthSince?fill(copy(c,'strengthSince'),{s:String(cfg.strengths[curIdx]!).replace('.',','),datum:prog.strengthSince.replace(/^.*?sinds /,'')}):''}</p>
  {prog?.nextStep&&<p className='portal-sub'>{fill(copy(c,'checkinNote'),{s:String(cfg.strengths[curIdx]!).replace('.',','),n:prog.nextStep.match(/^[\d,]+/)?.[0]??''})}</p>}
 </section>
 <OrderTile asLink={false}/>
 <h2 className='portal-card-heading portal-discover-heading'>{copy(c,'choosePackage')}</h2>
 <p className='portal-sub' style={{marginTop:-8,marginBottom:12}}>{copy(c,'choosePackageSub')}</p>
 <p className='portal-sub' style={{marginBottom:10}}>{copy(c,'legendSentence')}</p>
 <div className='portal-legend'>
  <span><i className='lg-sel'/>{copy(c,'legendSelected')}</span><span><i className='lg-allow'/>{copy(c,'legendAllowed')}</span><span><i className='lg-review'/>{copy(c,'legendReview')}</span><span><i className='lg-block'/>{copy(c,'legendBlocked')}</span>
 </div>
 {cfg.packages.map(m=>{
  const isOpen=open===m;const chosen=choice?.months===m?choice.strengths:null;
  const from=monthPrice(cfg,0,m);
  return <div key={m} className='portal-package'>
   <button type='button' className='portal-package-head' aria-expanded={isOpen} onClick={()=>setOpen(isOpen?null:m)}>
    <span className='portal-row-title flex-1'>{m===1?copy(c,'monthsOne'):fill(copy(c,'monthsN'),{n:m})}</span>
    <span className='portal-sub'>{fill(copy(c,'fromPerMonth'),{p:from})}</span>
    <ChevronDown size={16} className='portal-chevron' style={{transform:isOpen?'rotate(180deg)':undefined,transition:'transform 140ms'}}/>
   </button>
   {isOpen&&<div className='portal-package-body'>
    {Array.from({length:m},(_,i)=>{
     const prev=i===0?curIdx:(chosen?.[i-1]??null);
     const unlocked=prev!==null;
     return <div key={i}>
      <p className='portal-card-label' style={{marginBottom:6}}>{fill(copy(c,'monthN'),{n:i+1})}</p>
      <div className='portal-months'>{cfg.strengths.map((s,si)=>{
       const state=!unlocked?'blocked':chosen?.[i]===si?'selected':strengthState(si,prev);
       return <button key={s} type='button' disabled={state==='blocked'} aria-pressed={chosen?.[i]===si}
        className={`portal-strength${state==='selected'?' portal-strength-selected':state==='review'?' portal-strength-review':''}`}
        onClick={()=>{const next=(chosen??Array.from({length:m},()=>null) as (number|null)[]).slice();next[i]=si;setChoice({months:m,strengths:next as number[]});}}>
        {mg(s)}<small>{eur(monthPrice(cfg,si,m))}</small>
       </button>;})}
      </div>
     </div>;})}
    {hasReview&&<p className='portal-sub' style={{color:'#7A5410'}}>{copy(c,'reviewNote')}</p>}
   </div>}
  </div>;})}
 {choice&&choice.strengths.length===choice.months&&choice.strengths.every(s=>s!==null&&s!==undefined)&&<section className='portal-card'>
  <div className='portal-chips'>{choice.strengths.map((s,i)=><span key={i} className='portal-chip'>{fill(copy(c,'monthN'),{n:i+1})}: {mg(cfg.strengths[s]!)}</span>)}</div>
  <div className='portal-summary'>
   {savings>0&&<span className='portal-save'>{fill(copy(c,'youSave'),{x:eur(savings).replace('€ ','')})}</span>}
   <span className='portal-sum-row portal-sum-total'><span>{copy(c,'total')}</span><span>{eur(total)}</span></span>
  </div>
  <button type='button' className='portal-btn-primary portal-btn-block' onClick={()=>onStart({months:choice.months,strengths:choice.strengths,support:'care',extras:[],remark:'',mode:'deliver',delivery:'amp',payment:'ideal'})}>{copy(c,'orderBtn')}</button>
 </section>}
 </>;
}

/** Afrekenflow (v0.1 §6, screenshot 07): zeven stappen met volle rijen; betaling is demo. */
function Checkout({draft,setDraft,cfg}:{draft:Draft;setDraft:(d:Draft|null)=>void;cfg:MaConfig}){
 const {d}=usePortalData();const c=d.content;const navigate=useNavigate();const qc=useQueryClient();
 const [step,setStep]=useState(1);
 const [cur,setCur]=useState(draft);
 const pkg=d.landing.package!;
 const med=(d.access.medication??'').replace(/\s*[\d,.]+\s*mg\s*$/i,'').trim()||'Medicatie';
 const packTotal=packageTotal(cfg,cur.strengths,cur.months);
 const support=cfg.support.find(s=>s.key===cur.support);
 const extras=cfg.extras.filter(e=>cur.extras.includes(e.key));
 const delivery=cur.mode==='deliver'?cfg.delivery.find(x=>x.key===cur.delivery):undefined;
 const total=packTotal+(support?.price??0)*cur.months+extras.reduce((s,e)=>s+e.price,0)+(delivery?.price??0);
 const order=useMutation({mutationFn:()=>placePortalOrder({data:{months:cur.months,strengths:cur.strengths.map(i=>cfg.strengths[i]!),support:cur.support,extras:cur.extras,remark:cur.remark,mode:cur.mode,delivery:cur.mode==='deliver'?cur.delivery:null,payment:cur.payment,total}}),
  onSuccess:()=>{setStep(8);void qc.invalidateQueries({queryKey:['portal']});},onError:e=>toast.error(e.message)});
 const head=<div className='portal-tile-head' style={{marginBottom:16}}>{step>1?<button type='button' className='portal-link' onClick={()=>setStep(step-1)}>‹ {copy(c,'back')}</button>:<span/>}<span className='portal-sub'>{fill(copy(c,'stepOf'),{n:step,m:7})}</span></div>;
 const next=<button type='button' className='portal-btn-primary portal-btn-block' onClick={()=>setStep(step+1)}>{copy(c,'continueBtn')}</button>;
 if(step===8)return <section className='portal-card portal-center' style={{alignItems:'center',textAlign:'center',padding:'40px 24px'}}>
  <span className='portal-icon' style={{width:56,height:56}}><PartyPopper size={26}/></span>
  <h1>{copy(c,'orderDone')}</h1><p className='portal-sub'>{copy(c,'orderDoneSub')}</p>
  <Link to='/mijn/start' className='portal-btn-primary portal-btn-block'>{copy(c,'backToStart')}</Link>
 </section>;
 return <>{head}
 {step===1&&<><h1>{copy(c,'packageReady')}</h1><p className='portal-sub' style={{marginBottom:16}}>{copy(c,'packageReadySub')}</p>
  <section className='portal-card'><div className='portal-doctor'><span className='portal-icon'><ShoppingCart size={18}/></span><div><p className='portal-row-title'>{med}</p><p className='portal-sub'>{cur.months===1?copy(c,'monthsOne'):fill(copy(c,'monthsN'),{n:cur.months})} · {cur.strengths.map(i=>mg(cfg.strengths[i]!)).join(' · ')}</p></div><span className='portal-check'><Check size={13}/></span></div></section>
  <div className='portal-summary' style={{margin:'16px 0'}}><span className='portal-sum-row portal-sum-total'><span>{eur(packTotal)}</span><button type='button' className='portal-btn-primary' onClick={()=>setStep(2)}>{copy(c,'startOrder')}</button></span></div></>}
 {step===2&&<><h1>{copy(c,'chooseSupport')}</h1><p className='portal-sub' style={{marginBottom:16}}>{copy(c,'supportSub')}</p>
  <div className='portal-step-rows'>{cfg.support.map(s=><button key={s.key} type='button' className='portal-choice-row' aria-pressed={cur.support===s.key} onClick={()=>setCur({...cur,support:s.key})}>
   <span className='min-w-0 flex-1'><span className='portal-row-title'>{s.name}{s.tag?<span className='portal-chip' style={{marginLeft:8}}>{s.tag}</span>:null}</span><span className='portal-sub' style={{display:'block'}}>{s.lines.join(' · ')}</span><span className='portal-sub' style={{display:'block'}}>{s.price>0?`+ ${eur(s.price)} ${copy(c,'perMonthSuffix')}`:copy(c,'free')}</span></span><span className='portal-check'><Check size={13}/></span></button>)}</div>
  <div style={{marginTop:20}}>{next}</div></>}
 {step===3&&<><h1>{copy(c,'extrasTitle')}</h1><p className='portal-sub' style={{marginBottom:16}}>{copy(c,'extrasSub')}</p>
  <div className='portal-step-rows'>{cfg.extras.map(e=>{const on=cur.extras.includes(e.key);return <button key={e.key} type='button' className='portal-choice-row' aria-pressed={on} onClick={()=>setCur({...cur,extras:on?cur.extras.filter(k=>k!==e.key):[...cur.extras,e.key]})}>
   <span className='min-w-0 flex-1'><span className='portal-row-title'>{e.name}</span><span className='portal-sub' style={{display:'block'}}>{e.line}</span></span><span className='portal-choice-price'>+ {eur(e.price)}</span><span className='portal-check'><Check size={13}/></span></button>;})}</div>
  <div style={{marginTop:20}}>{next}</div>
  <button type='button' className='portal-link' style={{marginTop:12}} onClick={()=>setStep(4)}>{copy(c,'noExtras')}</button></>}
 {step===4&&<><h1>{copy(c,'remarkTitle')}</h1><p className='portal-sub' style={{marginBottom:16}}>{copy(c,'remarkSub')}</p>
  <textarea className='portal-textarea' rows={4} placeholder={copy(c,'remarkPlaceholder')} value={cur.remark} onChange={e=>setCur({...cur,remark:e.target.value})}/>
  <div style={{marginTop:20}}>{next}</div></>}
 {step===5&&<><h1>{copy(c,'deliveryTitle')}</h1>
  <div className='portal-segmented' style={{marginTop:16}}><button type='button' aria-pressed={cur.mode==='deliver'} onClick={()=>setCur({...cur,mode:'deliver'})}>{copy(c,'deliver')}</button><button type='button' aria-pressed={cur.mode==='pickup'} onClick={()=>setCur({...cur,mode:'pickup'})}>{copy(c,'pickup')}</button></div>
  {cur.mode==='deliver'?<><p className='portal-sub' style={{marginBottom:12}}>{copy(c,'deliveryHow')}</p>
   <div className='portal-step-rows'>{cfg.delivery.map(x=><button key={x.key} type='button' className='portal-choice-row' aria-pressed={cur.delivery===x.key} onClick={()=>setCur({...cur,delivery:x.key})}>
    <span className='min-w-0 flex-1'><span className='portal-row-title'>{x.name}</span><span className='portal-sub' style={{display:'block'}}>{x.line}</span></span><span className='portal-choice-price'>{eur(x.price)}</span><span className='portal-check'><Check size={13}/></span></button>)}</div></>
  :<p className='portal-sub' style={{marginBottom:12}}>{fill(copy(c,'pickupAt'),{kliniek:d.access.clinic_label})}</p>}
  <div style={{marginTop:20}}>{next}</div></>}
 {step===6&&<><h1>{copy(c,'checkTitle')}</h1>
  <section className='portal-card' style={{marginTop:16}}><div className='portal-summary'>
   <span className='portal-sum-row'><span>{copy(c,'medicationLabel')}</span><span>{med}</span></span>
   <span className='portal-sum-row'><span>{copy(c,'packageLabel')}</span><span>{cur.months===1?copy(c,'monthsOne'):fill(copy(c,'monthsN'),{n:cur.months})} · {cur.strengths.map(i=>mg(cfg.strengths[i]!)).join(' · ')}</span></span>
   <span className='portal-sum-row'><span>{copy(c,'supportLabel')}</span><span>{support?.name}{support?.price?` · ${eur(support.price)} ${copy(c,'perMonthSuffix')}`:''}</span></span>
   {extras.length>0&&<span className='portal-sum-row'><span>{copy(c,'extrasLabel')}</span><span>{extras.map(e=>e.name).join(', ')}</span></span>}
   <span className='portal-sum-row'><span>{copy(c,'deliveryLabel')}</span><span>{cur.mode==='pickup'?copy(c,'pickup'):`${delivery?.name} · ${eur(delivery?.price??0)}`}</span></span>
   {cur.remark&&<span className='portal-sum-row'><span>{copy(c,'remarkLabel')}</span><span className='portal-sub'>{cur.remark}</span></span>}
   <span className='portal-sum-row portal-sum-total'><span>{copy(c,'totalLabel')}</span><span>{eur(total)}</span></span>
  </div></section>
  <button type='button' className='portal-btn-primary portal-btn-block' onClick={()=>setStep(7)}>{copy(c,'toPayment')}</button>
  <button type='button' className='portal-link' style={{marginTop:12}} onClick={()=>setDraft(null)}>{copy(c,'cancelOrder')}</button></>}
 {step===7&&<><h1>{copy(c,'payTitle')}</h1>
  <div className='portal-step-rows' style={{marginTop:16}}>{cfg.payment.map(p=><button key={p.key} type='button' className='portal-choice-row' aria-pressed={cur.payment===p.key} onClick={()=>setCur({...cur,payment:p.key})}>
   <span className='min-w-0 flex-1'><span className='portal-row-title'>{p.name}</span><span className='portal-sub' style={{display:'block'}}>{p.line}</span></span><span className='portal-check'><Check size={13}/></span></button>)}</div>
  <p className='portal-sub' style={{margin:'14px 0'}}>{copy(c,'payNote')}</p>
  <div className='portal-summary' style={{marginBottom:16}}><span className='portal-sum-row portal-sum-total'><span>{eur(total)}</span><span>{copy(c,'totalLabel').toLowerCase()}</span></span></div>
  <button type='button' className='portal-btn-primary portal-btn-block' disabled={order.isPending} onClick={()=>order.mutate()}>{copy(c,'pay')}</button>
  <p className='portal-sub portal-center' style={{marginTop:10}}>{copy(c,'payDemo')}</p></>}
 </>;
}
