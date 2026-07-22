import { authCookies, clearAuthCookies, requireAppUser, supabasePublic } from "../../../lib/supabase";

export async function GET(request:Request){try{const user=await requireAppUser(request);return Response.json({user:{id:user.id,email:user.email,fullName:user.fullName,role:user.role}});}catch(error){if(error instanceof Response)return error;return Response.json({error:"Authentication unavailable"},{status:500});}}
export async function POST(request:Request){
  try{const body=await request.json() as {action?:string;email?:string;password?:string;fullName?:string};const client=supabasePublic();
    const result=body.action==="signup"?await client.auth.signUp({email:body.email||"",password:body.password||"",options:{data:{full_name:body.fullName||""}}}):await client.auth.signInWithPassword({email:body.email||"",password:body.password||""});
    if(result.error)return Response.json({error:result.error.message},{status:400});if(!result.data.session)return Response.json({message:"Check your email to confirm the account before signing in."});
    const headers=new Headers();for(const value of authCookies(result.data.session.access_token,result.data.session.refresh_token,result.data.session.expires_in))headers.append("Set-Cookie",value);
    return Response.json({ok:true},{headers});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Authentication failed"},{status:500});}
}
export async function DELETE(){const headers=new Headers();for(const value of clearAuthCookies())headers.append("Set-Cookie",value);return Response.json({ok:true},{headers});}
