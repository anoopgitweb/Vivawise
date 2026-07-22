import { createClient } from "@supabase/supabase-js";
import { getVivaEnv } from "./runtime";

function config() {
  const env = getVivaEnv();
  const url = env.SUPABASE_URL || process.env.SUPABASE_URL;
  const publishable = env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  const secret = env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishable || !secret) throw new Error("Supabase is not configured.");
  return { url, publishable, secret };
}

export function supabasePublic() { const c=config(); return createClient(c.url,c.publishable,{auth:{persistSession:false,autoRefreshToken:false}}); }
export function supabaseAdmin() { const c=config(); return createClient(c.url,c.secret,{auth:{persistSession:false,autoRefreshToken:false}}); }

export type AppUser = { id:string; email:string; fullName:string; role:"admin"|"student"; accessToken:string };
function cookie(request:Request,name:string){return request.headers.get("cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="))?.slice(name.length+1)||"";}
export async function requireAppUser(request:Request):Promise<AppUser>{
  const token=cookie(request,"vw_access"); if(!token) throw new Response("Sign in required",{status:401});
  const client=supabasePublic(); const {data,error}=await client.auth.getUser(token); if(error||!data.user) throw new Response("Session expired",{status:401});
  const {data:profile,error:profileError}=await supabaseAdmin().from("profiles").select("full_name,role").eq("id",data.user.id).single();
  if(profileError||!profile) throw new Response("User profile is unavailable",{status:403});
  return {id:data.user.id,email:data.user.email||"",fullName:profile.full_name||data.user.email?.split("@")[0]||"Student",role:profile.role,accessToken:token};
}
export async function requireSupabaseAdmin(request:Request){const user=await requireAppUser(request);if(user.role!=="admin")throw new Response("Administrator access required",{status:403});return user;}
export function authCookies(access:string,refresh:string,maxAge=3600){return [`vw_access=${access}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,`vw_refresh=${refresh}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`];}
export function clearAuthCookies(){return [`vw_access=; Path=/; HttpOnly; Max-Age=0`,`vw_refresh=; Path=/; HttpOnly; Max-Age=0`];}
