import {createFileRoute} from '@tanstack/react-router';
import {PortalPending} from '@/features/portal/PortalShell';
import {portalHead} from '@/features/portal/head';
export const Route=createFileRoute('/_patient/mijn/programma')({head:()=>portalHead('Programma'),component:()=> <PortalPending page='programma'/>});
