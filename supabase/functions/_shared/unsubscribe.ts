/**
 * Signed unsubscribe tokens for marketing/alert emails.
 * Format: base64url(payload).base64url(hmac-sha256)
 * Payload: { uid: userId, exp: unixSeconds }
 *
 * Required env:
 *   UNSUBSCRIBE_SECRET — HMAC signing key (mandatory; no cron/service-role fallback)
 *   APP_URL or SITE_URL — public app origin for browser unsubscribe links
 * Optional:
 *   UNSUBSCRIBE_SECRET_PREVIOUS — previous key for rotation (verify only)
 *   ENABLE_DEV_FALLBACK=true — allow localhost origin in local/dev only
 */

const encoder = new TextEncoder();

/** Signing key for new tokens — must be dedicated; never reuse CRON_SECRET. */
function getSigningSecret(): string {
  const secret = Deno.env.get("UNSUBSCRIBE_SECRET");
  if (!secret) {
    throw new Error(
      "UNSUBSCRIBE_SECRET is not configured. Set a dedicated secret for unsubscribe token signing."
    );
  }
  return secret;
}

/** Secrets accepted when verifying tokens (current + optional previous for rotation). */
function getVerificationSecrets(): string[] {
  const current = getSigningSecret();
  const previous = Deno.env.get("UNSUBSCRIBE_SECRET_PREVIOUS");
  return previous ? [current, previous] : [current];
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
  const secret = getSigningSecret();
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
    const secrets = getVerificationSecrets();
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return null;

    let valid = false;
    for (const secret of secrets) {
      if (await verifySig(payloadB64, signature, secret)) {
        valid = true;
        break;
      }
    }
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

/**
 * Public app origin used in unsubscribe links (no trailing slash).
 * Throws if unset in production; localhost only when ENABLE_DEV_FALLBACK=true.
 */
export function getAppOrigin(): string {
  const configured =
    Deno.env.get("APP_URL") ||
    Deno.env.get("SITE_URL") ||
    Deno.env.get("VITE_APP_URL");

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (Deno.env.get("ENABLE_DEV_FALLBACK") === "true") {
    return "http://localhost:5173";
  }

  throw new Error(
    "APP_URL (or SITE_URL) is not configured. Set the public app origin so unsubscribe links are valid."
  );
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
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not configured");
  }
  return `${supabaseUrl}/functions/v1/unsubscribe?token=${encodeURIComponent(token)}`;
}
