import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";
import {requireSupabaseAuth} from "@/integrations/supabase/auth-middleware";
export const saveAddress=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 .inputValidator(z.object({id:z.string().uuid().optional(),name:z.string().trim().min(1).max(200),kind:z.string().max(40),city:z.string().max(120),phone:z.string().max(40),send_channel:z.string().max(40)}))
 .handler(async({data,context})=>{
  const db=context.supabase;if(!(await db.rpc("is_aal2")).data||!(await db.rpc("has_permission",{_perm:"patients.edit"})).data)throw new Error("Geen toegang.");
  const options=await db.from("option_lists").select("list_key,value").in("list_key",["address_kind","secure_mail_channel"]);
  if(!options.data?.some(o=>o.list_key==="address_kind"&&o.value===data.kind)||!options.data?.some(o=>o.list_key==="secure_mail_channel"&&o.value===data.send_channel))throw new Error("Kies een soort en verzendkanaal.");
  const {id,...row}=data;
  const r=id?await db.from("address_book").update(row).eq("id",id).select("id").single():await db.from("address_book").insert(row).select("id").single();if(r.error)throw new Error(r.error.message);return r.data;
 });