const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Vivawise@2026";
const COOKIE = "vivawise_admin";
const SECRET = "vivawise-prototype-admin-cookie-2026";

async function digest(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyAdmin(username: string, password: string) {
  return (await digest(username)) === (await digest(ADMIN_USERNAME)) && (await digest(password)) === (await digest(ADMIN_PASSWORD));
}

async function token() { return digest(`${ADMIN_USERNAME}:${SECRET}`); }

export async function isAdmin(request: Request) {
  const value = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return Boolean(value && value === await token());
}

export async function requireAdmin(request: Request) {
  if (!await isAdmin(request)) throw new Response("Admin sign-in required", { status: 401 });
}

export async function adminCookie() {
  return `${COOKIE}=${await token()}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=28800`;
}

export function clearAdminCookie() { return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0`; }
