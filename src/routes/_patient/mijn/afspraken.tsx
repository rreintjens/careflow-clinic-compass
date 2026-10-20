import {createFileRoute} from '@tanstack/react-router';
import {PortalAppointments} from '@/features/portal/PortalAppointments';
import {portalHead} from '@/features/portal/head';
export const Route=createFileRoute('/_patient/mijn/afspraken')({head:()=>portalHead('Afspraken'),component:PortalAppointments});
