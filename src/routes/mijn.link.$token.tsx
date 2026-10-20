import {createFileRoute,useNavigate,Link} from '@tanstack/react-router';
import {useEffect,useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {redeemPortalLink} from '@/data/portal.functions';
import {portalHead} from '@/features/portal/head';
import {Logo} from '@/components/Logo';
import {supabase} from '@/integrations/supabase/client';
import {toast} from 'sonner';
export const Route=createFileRoute('/mijn/link/$token')({head:()=>portalHead('Inloglink'),component:Redeem});
function Redeem(){
 const {token}=Route.useParams();const [error,setError]=useState('');const [unknown,setUnknown]=useState<string|null>(null);const started=useRef(false);const navigate=useNavigate(),q=useQueryClient();
 useEffect(()=>{if(started.current)return;started.current=true;
 async function redeem(){try{
 const r=await redeemPortalLink({data:{token}});
 if('unknownEmail' in r&&r.unknownEmail){setUnknown(r.returnTo??'');return;}
 await q.cancelQueries();q.clear();
 const result=await supabase.auth.setSession({access_token:r.access_token,refresh_token:r.refresh_token});if(result.error)throw result.error;
 toast.dismiss();
 if('confirmed' in r&&r.confirmed){await navigate({to:'/mijn/start',search:{bevestigd:true},replace:true});return;}
 if(r.returnTo){if('holdToken' in r&&r.holdToken)sessionStorage.setItem('tbc-booking-hold',JSON.stringify({token:r.holdToken}));window.location.assign(`/boeken?${r.returnTo}`);return;}
 await navigate({to:'/mijn/start',replace:true});
 }catch(e){
 // Reopening an already consumed link must not strand a patient whose verified session is still valid.
 const {data:user}=await supabase.auth.getUser();
 if(user.user){const {data:patientId}=await supabase.rpc('portal_patient_id');if(patientId){await navigate({to:'/mijn/start',replace:true});return;}}
 setError(e instanceof Error?e.message:'De link is ongeldig of verlopen.');}}
 void redeem();
 },[token,q,navigate]);
 return <div className='portal portal-login'><div className='portal-login-inner'><Logo/><h1>Mijn omgeving</h1>{unknown?<><p role='alert'>We kennen dit e-mailadres niet. Ga verder als nieuwe patiënt.</p><a href={`/boeken${unknown?`?${unknown}`:''}`} className='portal-demo-link'>Ga verder als nieuwe patiënt</a></>:error?<><p role='alert'>{error}</p><Link to='/mijn'>Stuur een nieuwe inloglink</Link></>:<p role='status'>Inloggen…</p>}</div></div>;
}
