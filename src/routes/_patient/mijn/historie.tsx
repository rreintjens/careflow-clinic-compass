import {createFileRoute} from '@tanstack/react-router';
import {PortalHistory} from '@/features/portal/PortalHistory';
import {portalHead} from '@/features/portal/head';
export const Route=createFileRoute('/_patient/mijn/historie')({head:()=>portalHead('Historie'),component:PortalHistory});
