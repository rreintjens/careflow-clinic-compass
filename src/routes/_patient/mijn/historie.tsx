import {createFileRoute} from '@tanstack/react-router';
import {PortalPending} from '@/features/portal/PortalShell';
import {portalHead} from '@/features/portal/head';
export const Route=createFileRoute('/_patient/mijn/historie')({head:()=>portalHead('Historie'),component:()=> <PortalPending page='historie'/>});
