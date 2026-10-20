import {createFileRoute} from '@tanstack/react-router';
import {PortalStart} from '@/features/portal/PortalStart';
import {portalHead} from '@/features/portal/head';
export const Route=createFileRoute('/_patient/mijn/start')({validateSearch:(s:Record<string,unknown>):{bevestigd?:boolean}=>({bevestigd:s['bevestigd']===true||s['bevestigd']==='true'?true:undefined}),head:()=>portalHead('Start'),component:PortalStart});
