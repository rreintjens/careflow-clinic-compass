import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Check } from 'lucide-react';
import { toast } from 'sonner';
import { copy } from './PortalShell';
import { usePortalData, fmtDay, Photo } from './PortalStart';
import { sendFeedback } from '@/data/portal.functions';
import { portalQuery } from '@/data/portal';

/** Feedback screen (v0.2 §6): stars, chips, comment, share toggle. */
export function PortalFeedback({appointmentId,rating:initial}:{appointmentId:string;rating?:number}){
 const {d,treat,prac,history}=usePortalData();
 const c=d.content;
 const a=history.find(x=>x.id===appointmentId);
 const t=a?treat(a.treatment_id):null,p=a?prac(a.practitioner_id):null;
 const [rating,setRating]=useState(initial??0);
 const [tags,setTags]=useState<string[]>([]);
 const [comment,setComment]=useState('');
 const [share,setShare]=useState(true);
 const navigate=useNavigate();const qc=useQueryClient();
 const save=useMutation({mutationFn:()=>sendFeedback({data:{appointmentId,rating,tags,comment,share_with_practitioner:share}}),
  onSuccess:async()=>{await qc.invalidateQueries({queryKey:portalQuery.queryKey});toast.success(copy(c,'feedbackThanks'));await navigate({to:'/mijn/start'});},
  onError:e=>toast.error(e instanceof Error?e.message:'Versturen is niet gelukt')});
 if(!a||!t)return <p className='portal-pending'>Deze behandeling is niet gevonden.</p>;
 const labels:string[]=Array.isArray(c['ratingLabels'])?c['ratingLabels'] as string[]:[];
 const tagOptions:string[]=Array.isArray(c['feedbackTags'])?c['feedbackTags'] as string[]:[];
 const toggle=(tag:string)=>setTags(tags.includes(tag)?tags.filter(x=>x!==tag):[...tags,tag]);
 return <><Link to='/mijn/start' className='portal-back'>‹ Start</Link>
 <div className='portal-feedback'>
  <div className='portal-doctor'><Photo src={p?.photo} size={60}/><div><h1 className='portal-detail-title'>{copy(c,'feedbackTitle')}</h1><p className='portal-sub'>{t.name_nl}, {fmtDay(a.starts_at)} {p?`bij ${p.first_name} ${p.last_name}`:''}</p></div></div>
  <div className='portal-card portal-feedback-stars'>
   <div className='portal-stars portal-stars-large'>{[1,2,3,4,5].map(n=><button key={n} type='button' aria-label={`${n} sterren`} aria-pressed={rating>=n} onClick={()=>setRating(n)}><Star size={36} strokeWidth={1.7} fill={rating>=n?'currentColor':'none'}/></button>)}</div>
   {rating>0&&<p className='portal-rating-label'>{labels[rating-1]}</p>}
  </div>
  <div className='portal-card'><h2 className='portal-card-heading'>{copy(c,'whatWentWell')}</h2>
   <div className='portal-chips'>{tagOptions.map(tag=>{const on=tags.includes(tag);return <button key={tag} type='button' aria-pressed={on} className={`portal-chip-select${on?' portal-chip-on':''}`} onClick={()=>toggle(tag)}>{on&&<Check size={14}/>}{tag}</button>;})}</div>
  </div>
  <div className='portal-card'><h2 className='portal-card-heading'>{copy(c,'anythingElse')}</h2>
   <textarea className='portal-textarea' rows={4} placeholder={copy(c,'anythingElseHint')} value={comment} maxLength={2000} onChange={e=>setComment(e.target.value)}/>
  </div>
  <div className='portal-card portal-row'>
   <div className='min-w-0 flex-1'><p className='portal-row-title'>{copy(c,'mayRead').replace('{voornaam}',p?.first_name??'')}</p><p className='portal-sub'>{copy(c,'mayReadSub')}</p></div>
   <button type='button' role='switch' aria-checked={share} aria-label={copy(c,'mayRead').replace('{voornaam}',p?.first_name??'')} className={`portal-switch${share?' portal-switch-on':''}`} onClick={()=>setShare(!share)}><span/></button>
  </div>
  <button type='button' className='portal-btn-primary portal-btn-block' disabled={rating===0||save.isPending} onClick={()=>save.mutate()}>{copy(c,'sendFeedback')}</button>
  <p className='portal-sub portal-center'>{copy(c,'feedbackNote').replace('{voornaam}',p?.first_name??'')}</p>
 </div></>;
}
