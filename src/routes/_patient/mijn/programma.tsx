import {createFileRoute} from '@tanstack/react-router';
import {PortalProgram} from '@/features/portal/PortalProgram';
import {portalHead} from '@/features/portal/head';
export const Route=createFileRoute('/_patient/mijn/programma')({head:()=>portalHead('Programma'),component:PortalProgram});
