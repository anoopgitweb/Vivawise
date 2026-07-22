import { adminCookie, clearAdminCookie, isAdmin, verifyAdmin } from "../../../../lib/admin-auth";

export async function GET(request: Request) { return Response.json({ authenticated: await isAdmin(request) }); }

export async function POST(request: Request) {
  const { username = "", password = "" } = await request.json() as { username?: string; password?: string };
  if (!await verifyAdmin(username, password)) return Response.json({ error: "Invalid admin credentials." }, { status: 401 });
  return Response.json({ authenticated: true }, { headers: { "Set-Cookie": await adminCookie() } });
}

export async function DELETE() { return Response.json({ authenticated: false }, { headers: { "Set-Cookie": clearAdminCookie() } }); }
