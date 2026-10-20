import {queryOptions} from "@tanstack/react-query";
import {supabase} from "@/integrations/supabase/client";
export const addressBookQuery=queryOptions({queryKey:["address-book"],queryFn:async()=>{const r=await supabase.from("address_book").select("*").order("name");if(r.error)throw r.error;return r.data;}});
export const addressOptionsQuery=queryOptions({queryKey:["address-options"],queryFn:async()=>{const r=await supabase.from("option_lists").select("list_key,value,label_nl").in("list_key",["address_kind","secure_mail_channel"]).order("sort");if(r.error)throw r.error;return r.data;}});