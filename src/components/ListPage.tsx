import { useEffect,useRef,type ReactNode,type MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { UiIcon } from "./UiIcon";

/** Row-click delegation: a click on a marked row activates its real link or data-row-action button. Use on any container with [data-list-row] rows, also outside ListPage. */
export function rowOpen(e: MouseEvent) {
  const target = e.target;
  if (!(target instanceof Element) || target.closest("button,a,input,label,[role=combobox],select,textarea")) return;
  const row = target.closest("[data-list-row]");
  if (!row || !(e.currentTarget instanceof Element) || !e.currentTarget.contains(row)) return;
  const action = row.querySelector<HTMLAnchorElement | HTMLButtonElement>("a[href],button[data-row-action]");
  action?.click();
}

/** One overview shell. Existing row actions remain the real keyboard-accessible controls. */
export function ListPage({children,className}:{children:ReactNode;className?:string}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{const root=ref.current;if(!root)return;const mark=()=>{root.querySelectorAll("table tbody tr").forEach(row=>{if(row.querySelector("a[href],button[data-row-action]"))row.setAttribute("data-list-row","");});};mark();const observer=new MutationObserver(mark);observer.observe(root,{childList:true,subtree:true});return()=>observer.disconnect();},[]);
 return <div ref={ref} className={cn("admin-list-page flex min-w-0 flex-col gap-6",className)} onClick={rowOpen}>{children}</div>;
}
export function DataTable({children,className,loading=false,count,columnLayout}:{children:ReactNode;className?:string;loading?:boolean;count?:number;label?:string;columnLayout?:"equipment"|"mail-variants"}){
 return <div data-column-layout={columnLayout} className={cn("admin-data-table w-full min-w-0 max-w-full overflow-x-auto",className)} onClick={rowOpen}>{loading?<ListState loading/>:count===0?<ListState/>:children}</div>;
}
export function ListState({loading=false}:{loading?:boolean}){return <p role="status" className="py-8 text-sm text-muted-foreground">{loading?"Laden…":"Geen resultaten"}</p>;}
export function RowChevron(){return <UiIcon name="pijl-rechts" className="h-4 w-4 shrink-0 text-primary"/>;}
export function ListGroup({children,count}:{children:ReactNode;count?:number}){return <div className="list-group flex items-center gap-2 border-b border-line bg-sand px-3 py-2 text-xs font-medium">{children}{count!==undefined&&<span className="text-muted-foreground">{count}</span>}</div>;}
