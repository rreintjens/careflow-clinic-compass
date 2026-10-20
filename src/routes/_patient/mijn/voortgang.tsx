import {createFileRoute} from '@tanstack/react-router';
import {PortalProgress} from '@/features/portal/PortalProgress';
import {portalHead} from '@/features/portal/head';
export const Route=createFileRoute('/_patient/mijn/voortgang')({head:()=>portalHead('Voortgang'),component:PortalProgress});
