import {createFileRoute} from '@tanstack/react-router';
import {PortalStart} from '@/features/portal/PortalStart';
import {portalHead} from '@/features/portal/head';
export const Route=createFileRoute('/_patient/mijn/start')({head:()=>portalHead('Start'),component:PortalStart});
