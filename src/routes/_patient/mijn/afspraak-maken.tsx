import {createFileRoute} from '@tanstack/react-router';
import {PortalBook} from '@/features/portal/PortalBook';
import {portalHead} from '@/features/portal/head';
export const Route=createFileRoute('/_patient/mijn/afspraak-maken')({head:()=>portalHead('Afspraak maken'),component:PortalBook});
