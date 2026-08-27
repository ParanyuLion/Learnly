const SESSION_MARKER = "authenticated";

async function hmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signSession(secret: string): Promise<string> {
  return hmac(secret, SESSION_MARKER);
}

export async function verifySession(token: string, secret: string): Promise<boolean> {
  const expected = await hmac(secret, SESSION_MARKER);
  return token === expected;
}
