import {createFileRoute,useNavigate,Link} from '@tanstack/react-router';
import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {redeemPortalLink} from '@/data/portal.functions';
import {portalHead} from '@/features/portal/head';
import {PillButton} from '@/components/PillButton';
import {Logo} from '@/components/Logo';
import {supabase} from '@/integrations/supabase/client';
import {toast} from 'sonner';
export const Route=createFileRoute('/mijn/link/$token')({head:()=>portalHead('Inloglink'),component:Redeem});
function Redeem(){const {token}=Route.useParams();const [error,setError]=useState(''),[busy,setBusy]=useState(false);const navigate=useNavigate(),q=useQueryClient();return <div className='portal portal-login'><div className='portal-login-inner'><Logo/><h1>Mijn omgeving</h1>{error?<><p role='alert'>{error}</p><Link to='/mijn'>Stuur een nieuwe inloglink</Link></>:<PillButton block disabled={busy} onClick={async()=>{setBusy(true);try{const session=await redeemPortalLink({data:{token}});await q.cancelQueries();q.clear();const result=await supabase.auth.setSession(session);if(result.error)throw result.error;toast.dismiss();await navigate({to:'/mijn/start',replace:true});}catch(e){setError(e instanceof Error?e.message:'De link is ongeldig of verlopen.');}finally{setBusy(false);}}}>Inloggen</PillButton>}</div></div>;}
