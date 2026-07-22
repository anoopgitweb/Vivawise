export type VivaUser = { userId: string; email: string; displayName: string };

export async function requireVivaUser(request: Request): Promise<VivaUser> {
  const url = new URL(request.url);
  const emailHeader = request.headers.get("oai-authenticated-user-email");
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const email = emailHeader?.trim().toLowerCase() || (isLocal ? "local-student@vivawise.dev" : "");
  if (!email) throw new Response("Sign in is required", { status: 401 });

  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  const displayName = encodedName && encoding === "percent-encoded-utf-8"
    ? safeDecode(encodedName) ?? email.split("@")[0]
    : email.split("@")[0];

  return { userId: await sha256(email), email, displayName };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeDecode(value: string) {
  try { return decodeURIComponent(value); } catch { return null; }
}
