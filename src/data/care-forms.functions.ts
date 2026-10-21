import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {careFormSchema} from '@/domain/care-forms';

export const saveCareForm=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(careFormSchema).handler(async({data,context})=>{
 const result=await context.supabase.rpc('manage_care_form',{_action:'save',...(data.id?{_id:data.id}:{}),_code:data.code,_kind:data.kind,...(data.templateId?{_template:data.templateId}:{}),_name:data.name,_nl:data.textNl,_en:data.textEn});
 if(result.error)throw new Error(result.error.message);return result.data;
});
export const changeCareForm=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),action:z.enum(['concept','publish'])})).handler(async({data,context})=>{
 const result=await context.supabase.rpc('manage_care_form',{_action:data.action,_id:data.id});
 if(result.error)throw new Error(result.error.message);return result.data;
});