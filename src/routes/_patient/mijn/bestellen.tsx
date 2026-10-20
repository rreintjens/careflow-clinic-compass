import {createFileRoute} from '@tanstack/react-router';
import {PortalPending} from '@/features/portal/PortalShell';
import {portalHead} from '@/features/portal/head';
export const Route=createFileRoute('/_patient/mijn/bestellen')({head:()=>portalHead('Bestellen'),component:()=> <PortalPending page='bestellen'/>});
