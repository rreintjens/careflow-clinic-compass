import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attributionEntitySchema } from "@/domain/attribution";

export const saveAttributionEntity=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>attributionEntitySchema.parse(input)).handler(async({data,context})=>{
  const db=context.supabase;
  if(!(await db.rpc("is_aal2")).data || !(await db.rpc("has_permission",{_perm:"booking_links.manage"})).data) throw new Error("Geen toegang");
  const tenantId=(await db.rpc("current_tenant")).data;
  if(!tenantId) throw new Error("Geen merk gekozen");
  const table=data.kind==="channel"?"booking_channels":data.kind==="place"?"booking_places":"booking_campaigns";
  if(data.kind==="place") {const channel=await db.from("booking_channels").select("id").eq("tenant_id",tenantId).eq("id",data.channelId??"").maybeSingle();if(!channel.data) throw new Error("Kies een kanaal van dit merk");}
  let result;
  if(data.kind==="channel") {const values={name:data.name,utm_source:data.code,utm_medium:data.medium??"",active:data.active};result=data.id?await db.from("booking_channels").update(values).eq("tenant_id",tenantId).eq("id",data.id).select("id").single():await db.from("booking_channels").insert({...values,tenant_id:tenantId}).select("id").single();}
  else if(data.kind==="place") {const values={name:data.name,code:data.code,channel_id:data.channelId??"",active:data.active};result=data.id?await db.from("booking_places").update(values).eq("tenant_id",tenantId).eq("id",data.id).select("id").single():await db.from("booking_places").insert({...values,tenant_id:tenantId}).select("id").single();}
  else {const values={name:data.name,code:data.code,starts_on:data.startsOn??null,ends_on:data.endsOn??null,active:data.active};result=data.id?await db.from("booking_campaigns").update(values).eq("tenant_id",tenantId).eq("id",data.id).select("id").single():await db.from("booking_campaigns").insert({...values,tenant_id:tenantId}).select("id").single();}
  if(result.error) throw new Error(result.error.message.includes("in gebruik")?"Een code die in gebruik is kun je niet wijzigen":"Opslaan is niet gelukt; controleer of deze code al bestaat");
  return result.data;
});