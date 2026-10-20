import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Home, History, CalendarDays, ChartNoAxesCombined, ShoppingCart, MessageSquare, ChevronRight, type LucideIcon } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { PillButton } from '@/components/PillButton';
import { portalQuery } from '@/data/portal';
import { patientInitials } from '@/domain/portal';
import type { Json } from '@/integrations/supabase/types';

export const copy=(c:Json,k:string):string=>c&&typeof c==='object'&&!Array.isArray(c)&&typeof c[k]==='string'?String(c[k]):'';
export const navCopy=(c:Json,k:string):string=>c&&typeof c==='object'&&!Array.isArray(c)?copy(c['nav']??null,k):'';
const nav=[{key:'start',to:'/mijn/start',icon:Home},{key:'historie',to:'/mijn/historie',icon:History},{key:'afspraak-maken',to:'/mijn/afspraak-maken',icon:CalendarDays},{key:'voortgang',to:'/mijn/voortgang',icon:ChartNoAxesCombined},{key:'afspraken',to:'/mijn/afspraken',icon:CalendarDays},{key:'bestellen',to:'/mijn/bestellen',icon:ShoppingCart}] as const;
export function PortalShell(){
 const {data:d}=useSuspenseQuery(portalQuery);const medical=d.landing.kind==='active'||d.landing.kind==='starter';
 const items=nav.filter(n=>medical?['start','voortgang','afspraken','bestellen'].includes(n.key):['start','historie','afspraak-maken'].includes(n.key));
 const path=useRouterState({select:s=>s.location.pathname});const key=path.split('/').at(-1)??'start';
 const initials=patientInitials(d.patient.first_name,d.patient.last_name);
 const profile=<Link to='/mijn/profiel' className='portal-profile'><span className='portal-avatar'>{initials}</span><span className='portal-user'><strong>{d.patient.first_name} {d.patient.last_name}</strong><small>{copy(d.content,'profileSettings')}</small></span></Link>;
 const chat=<Link to='/mijn/berichten' aria-label='Berichten' className='portal-chat'><MessageSquare size={19} strokeWidth={1.7}/><span className='portal-badge'/></Link>;
 const links=items.map(n=><Link key={n.key} to={n.to} className='portal-nav-link' activeProps={{className:'portal-nav-active'}}><n.icon size={20} strokeWidth={1.7}/><span>{navCopy(d.content,n.key)}</span></Link>);
 return <div className='portal'><aside className='portal-sidebar'><Logo/><p className='portal-caption'>Mijn omgeving</p><nav>{links}</nav><div className='portal-sidebar-user'>{profile}</div></aside><div className='portal-body'><header className='portal-topbar'><div className='portal-mobile-logo'><Logo mark/></div><div className='portal-breadcrumb'>Mijn omgeving <span>/</span> <strong>{navCopy(d.content,key)}</strong></div><div className='portal-header-actions'>{chat}<div className='portal-mobile-avatar'>{profile}</div></div></header><main className='portal-content'><Outlet/></main><nav className='portal-bottom-nav'>{links}</nav></div></div>;
}
export function PortalTile({icon:Icon,label,value,sub,status='neutral',to,children}:{icon:LucideIcon;label:string;value:string;sub?:string;status?:'neutral'|'good'|'soon'|'action';to:'/mijn/historie'|'/mijn/afspraken'|'/mijn/voortgang'|'/mijn/profiel';children?:React.ReactNode}){
 return <Link to={to} className={`portal-tile portal-status-${status}`}><span className='portal-icon'><Icon size={20} strokeWidth={1.7}/></span><span className='portal-tile-label'>{label}</span><strong className={`portal-tile-value${value.length>10?' portal-tile-value-long':''}`}>{value}</strong>{sub&&<span className='portal-tile-sub'>{sub}</span>}{children}</Link>;
}
export function PortalPending({page}:{page:string}){const {data:d}=useSuspenseQuery(portalQuery);return <><h1>{navCopy(d.content,page)}</h1><p className='portal-pending'>{copy(d.content,'phasePending')}</p></>;}
export { ChevronRight, PillButton };
