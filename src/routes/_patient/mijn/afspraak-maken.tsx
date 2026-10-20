import {createFileRoute} from '@tanstack/react-router';
import {PortalPending} from '@/features/portal/PortalShell';
import {portalHead} from '@/features/portal/head';
export const Route=createFileRoute('/_patient/mijn/afspraak-maken')({head:()=>portalHead('Afspraak maken'),component:()=> <PortalPending page='afspraak-maken'/>});
