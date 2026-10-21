import {queryOptions} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import type {Database} from '@/integrations/supabase/types';
export type CareForm=Database['public']['Tables']['care_form_versions']['Row'];
export const careFormKindsQuery=queryOptions({queryKey:['care-form-kinds'],queryFn:async()=>{
 const r=await supabase.from('option_lists').select('value,label_nl').eq('list_key','care_form_kind').order('sort');
 if(r.error)throw new Error('Formulierkeuzes konden niet worden geladen.');return r.data.map(o=>({value:o.value,label:o.label_nl}));
}});
export const careFormsQuery=queryOptions({queryKey:['care-forms'],queryFn:async()=>{
 const r=await supabase.from('care_form_versions').select('*').order('name').order('version',{ascending:false});
 if(r.error)throw new Error('Formulieren konden niet worden geladen.');return r.data;
}});