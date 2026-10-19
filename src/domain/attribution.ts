import { z } from "zod";

export const normalizeCode = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const code = z.string().transform(normalizeCode).pipe(z.string().min(1).max(60).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/));
export const attributionEntitySchema = z.object({
  kind: z.enum(["channel","place","campaign"]), id:z.string().uuid().nullable(), name:z.string().trim().min(1).max(120),
  code, medium:code.optional(), channelId:z.string().uuid().optional(), active:z.boolean(), startsOn:z.string().nullable().optional(), endsOn:z.string().nullable().optional(),
}).superRefine((value,ctx)=>{
  if(value.kind==="channel" && !value.medium) ctx.addIssue({code:"custom",message:"Kies een medium",path:["medium"]});
  if(value.kind==="place" && !value.channelId) ctx.addIssue({code:"custom",message:"Kies een kanaal",path:["channelId"]});
  if(value.startsOn && value.endsOn && value.endsOn<value.startsOn) ctx.addIssue({code:"custom",message:"Tot moet na Van liggen",path:["endsOn"]});
});
export type Attribution = {channel:string;source:string;medium:string;place:string;content:string;campaign:string;campaignCode:string;extra:string;hash:string};
export function structuredBookingUrl(value: Attribution, origin = "") {
  const query=new URLSearchParams({link:value.hash,utm_source:value.source,utm_medium:value.medium,utm_campaign:value.campaignCode,utm_content:[value.content,value.extra].filter(Boolean).join("-"),utm_id:value.hash});
  return `${origin}/boeken?${query}`;
}
export function randomLinkHash() {
  const alphabet="abcdefghijklmnopqrstuvwxyz0123456789";
  let result="";
  while(result.length<6) {
    const bytes=crypto.getRandomValues(new Uint8Array(12));
    for(const byte of bytes) { if(byte<252) result+=alphabet[byte%36]; if(result.length===6) break; }
  }
  return result;
}