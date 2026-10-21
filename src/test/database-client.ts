import {createClient} from '@supabase/supabase-js';
import type {Database} from '@/integrations/supabase/types';

export const integrationEnabled=Boolean(process.env['SUPABASE_URL']&&process.env['SUPABASE_PUBLISHABLE_KEY']&&process.env['SUPABASE_SERVICE_ROLE_KEY']);
let clientNumber=0;
export function databaseClient(privileged=false){
 const url=process.env['SUPABASE_URL'];const key=process.env[privileged?'SUPABASE_SERVICE_ROLE_KEY':'SUPABASE_PUBLISHABLE_KEY'];
 if(!url||!key)throw new Error('Integration database configuration missing');
 return createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false,storageKey:`integration-${++clientNumber}`},global:{fetch:(input,init)=>{
  const headers=new Headers(init?.headers);if(key.startsWith('sb_')&&headers.get('Authorization')===`Bearer ${key}`)headers.delete('Authorization');headers.set('apikey',key);return fetch(input,{...init,headers});
 }}});
}
/** Test runner only: no application endpoint, password changes or owner MFA changes. */
export async function testRoleSession(email:string){
 const admin=databaseClient(true);const link=await admin.auth.admin.generateLink({type:'magiclink',email});
 if(link.error)throw link.error;const hash=link.data.properties.hashed_token;
 const client=databaseClient();const verified=await client.auth.verifyOtp({type:'magiclink',token_hash:hash});
 if(verified.error||!verified.data.user)throw verified.error??new Error('Test sign-in failed');
 return {client,user:verified.data.user};
}