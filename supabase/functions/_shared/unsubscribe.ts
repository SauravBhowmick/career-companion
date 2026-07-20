/**
 * Signed unsubscribe tokens for marketing/alert emails.
 * Format: base64url(payload).base64url(hmac-sha256)
 * Payload: { uid: userId, exp: unixSeconds }
 */

const encoder = new TextEncoder();

function getSecret(): string {
  const secret =
    Deno.env.get("UNSUBSCRIBE_SECRET") ||
    Deno.env.get("CRON_SECRET") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) {
    throw new Error("UNSUBSCRIBE_SECRET (or CRON_SECRET) is not configured");
  }
  return secret;
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sign(message: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toBase64Url(sig);
}

async function verifySig(message: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await hmacKey(secret);
    const sigBytes = fromBase64Url(signature);
    return await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(message));
  } catch {
    return false;
  }
}

/** Create a signed unsubscribe token (valid 90 days by default). */
export async function createUnsubscribeToken(
  userId: string,
  ttlSeconds = 90 * 24 * 60 * 60
): Promise<string> {
  const secret = getSecret();
  const payload = JSON.stringify({
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
  const payloadB64 = toBase64Url(encoder.encode(payload));
  const signature = await sign(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

/** Verify token and return the user id, or null if invalid/expired. */
export async function verifyUnsubscribeToken(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const secret = getSecret();
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return null;

    const valid = await verifySig(payloadB64, signature, secret);
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
    if (!payload?.uid || typeof payload.uid !== "string") return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return { userId: payload.uid };
  } catch {
    return null;
  }
}

/** Public app origin used in unsubscribe links (no trailing slash). */
export function getAppOrigin(): string {
  const origin =
    Deno.env.get("APP_URL") ||
    Deno.env.get("SITE_URL") ||
    Deno.env.get("VITE_APP_URL") ||
    "http://localhost:5173";
  return origin.replace(/\/+$/, "");
}

/** Full browser URL for the unsubscribe page. */
export async function buildUnsubscribeUrl(userId: string): Promise<string> {
  const token = await createUnsubscribeToken(userId);
  return `${getAppOrigin()}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** One-click List-Unsubscribe HTTP endpoint (edge function). */
export async function buildListUnsubscribeUrl(userId: string): Promise<string> {
  const token = await createUnsubscribeToken(userId);
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  return `${supabaseUrl}/functions/v1/unsubscribe?token=${encodeURIComponent(token)}`;
}
