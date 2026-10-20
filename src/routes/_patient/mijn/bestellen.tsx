import {createFileRoute} from '@tanstack/react-router';
import {PortalOrder} from '@/features/portal/PortalOrder';
import {portalHead} from '@/features/portal/head';
export const Route=createFileRoute('/_patient/mijn/bestellen')({head:()=>portalHead('Bestellen'),component:PortalOrder});
