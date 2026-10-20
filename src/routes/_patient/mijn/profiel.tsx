import {createFileRoute,useNavigate} from '@tanstack/react-router';
import {useSuspenseQuery,useQueryClient} from '@tanstack/react-query';
import {ChevronRight} from 'lucide-react';
import {toast} from 'sonner';
import {portalHead} from '@/features/portal/head';
import {portalQuery} from '@/data/portal';
import {copy,PillButton} from '@/features/portal/PortalShell';
import {patientInitials} from '@/domain/portal';
import {supabase} from '@/integrations/supabase/client';

/** Profiel (v0.1 §5.5): avatar, naam, e-mail, bewerken; Account-rijen; Uitloggen. */
export const Route=createFileRoute('/_patient/mijn/profiel')({head:()=>portalHead('Profiel'),component:Profile});
function Profile(){
 const {data:d}=useSuspenseQuery(portalQuery);const q=useQueryClient(),navigate=useNavigate();
 const c=d.content;
 const rows:string[]=Array.isArray((c as Record<string,unknown>)?.['profileRows'])?(c as {profileRows:string[]}).profileRows:[];
 const pending=()=>toast.info(copy(c,'phasePending'));
 return <><h1>Profiel</h1>
 <div className='portal-profile-page'>
  <span className='portal-avatar'>{patientInitials(d.patient.first_name,d.patient.last_name)}</span>
  <div><h2>{d.patient.first_name} {d.patient.last_name}</h2><p>{d.patient.email}</p></div>
  <div><PillButton variant='ghost' className='bg-teal-light text-primary-hover hover:bg-mist' onClick={pending}>{copy(c,'edit')}</PillButton></div>
 </div>
 <h2 className='portal-card-heading portal-discover-heading'>{copy(c,'account')}</h2>
 <div className='portal-card portal-rows'>
  {rows.map(r=><button key={r} type='button' className='portal-row portal-row-link portal-row-button' onClick={pending}><span className='portal-row-title flex-1 text-left'>{r}</span><ChevronRight size={16} className='portal-chevron'/></button>)}
 </div>
 <PillButton className='mt-6' onClick={async()=>{await q.cancelQueries();q.clear();await supabase.auth.signOut();await navigate({to:'/mijn',replace:true});}}>{copy(c,'signOut')}</PillButton></>;
}
