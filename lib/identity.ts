export type VivaUser = { userId: string; email: string; displayName: string };
import { requireAppUser } from "./supabase";

export async function requireVivaUser(request: Request): Promise<VivaUser> {
  const user=await requireAppUser(request);
  return {userId:user.id,email:user.email,displayName:user.fullName};
}

export async function userIdFromEmail(value: string) {
  value = value.trim().toLowerCase();
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
