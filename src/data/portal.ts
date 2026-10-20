import { queryOptions } from '@tanstack/react-query';
import { readPortal } from './portal.functions';
export const portalQuery=queryOptions({queryKey:['portal'],queryFn:()=>readPortal()});
export type PortalData=Awaited<ReturnType<typeof readPortal>>;
