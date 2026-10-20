import {createFileRoute,redirect,Outlet} from '@tanstack/react-router';
import {supabase} from '@/integrations/supabase/client';
import {portalQuery} from '@/data/portal';
export const Route=createFileRoute('/_patient')({ssr:false,beforeLoad:async({context})=>{const {data}=await supabase.auth.getUser();if(!data.user)throw redirect({to:'/mijn'});const {data:id}=await supabase.rpc('portal_patient_id');if(!id)throw redirect({to:'/mijn'});await context.queryClient.ensureQueryData(portalQuery);},component:()=> <Outlet/>});
