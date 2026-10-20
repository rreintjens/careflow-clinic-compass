import {createFileRoute} from '@tanstack/react-router';
import {PortalHistoryDetail} from '@/features/portal/PortalHistory';
import {portalHead} from '@/features/portal/head';
export const Route=createFileRoute('/_patient/mijn/historie_/$appointmentId')({head:()=>portalHead('Behandeling'),component:function P(){const {appointmentId}=Route.useParams();return <PortalHistoryDetail appointmentId={appointmentId}/>;}});
