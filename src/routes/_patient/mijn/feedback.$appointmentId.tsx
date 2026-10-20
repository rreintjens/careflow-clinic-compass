import {createFileRoute} from '@tanstack/react-router';
import {z} from 'zod';
import {PortalFeedback} from '@/features/portal/PortalFeedback';
import {portalHead} from '@/features/portal/head';
export const Route=createFileRoute('/_patient/mijn/feedback/$appointmentId')({validateSearch:z.object({rating:z.number().int().min(1).max(5).optional()}),head:()=>portalHead('Feedback'),component:function P(){const {appointmentId}=Route.useParams();const {rating}=Route.useSearch();return <PortalFeedback appointmentId={appointmentId} rating={rating??undefined}/>;}});
