import {createFileRoute,useNavigate} from '@tanstack/react-router';
import {useSuspenseQuery,useQueryClient} from '@tanstack/react-query';
import {portalHead} from '@/features/portal/head';
import {portalQuery} from '@/data/portal';
import {copy,PillButton} from '@/features/portal/PortalShell';
import {supabase} from '@/integrations/supabase/client';
export const Route=createFileRoute('/_patient/mijn/profiel')({head:()=>portalHead('Profiel'),component:Profile});
function Profile(){const {data:d}=useSuspenseQuery(portalQuery);const q=useQueryClient(),navigate=useNavigate();return <><h1>Profiel</h1><div className='portal-profile-page'><span className='portal-avatar'>{d.patient.first_name[0]}{d.patient.last_name[0]}</span><h2>{d.patient.first_name} {d.patient.last_name}</h2><p>{d.patient.email}</p></div><PillButton onClick={async()=>{await q.cancelQueries();q.clear();await supabase.auth.signOut();await navigate({to:'/mijn',replace:true});}}>{copy(d.content,'signOut')}</PillButton></>;}
