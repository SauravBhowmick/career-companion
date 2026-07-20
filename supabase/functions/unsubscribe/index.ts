import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyUnsubscribeToken } from "../_shared/unsubscribe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function htmlPage(title: string, message: string, ok: boolean) {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #f9fafb; margin: 0; min-height: 100vh; display: flex;
           align-items: center; justify-content: center; padding: 24px; color: #111827; }
    .card { max-width: 420px; width: 100%; background: white; border-radius: 16px;
            padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,.08); text-align: center; }
    .icon { font-size: 40px; margin-bottom: 12px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { color: #6b7280; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${ok ? "✓" : "!"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`,
    {
      status: ok ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

async function unsubscribeUser(userId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { error } = await supabase
    .from("user_preferences")
    .update({
      email_notifications: false,
      instant_notifications: false,
    })
    .eq("user_id", userId);

  if (error) throw error;
}

async function resolveToken(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("token");
  if (fromQuery) return fromQuery;

  // RFC 8058 one-click: POST body is List-Unsubscribe=One-Click
  // Token still comes from the List-Unsubscribe URL query string.
  if (req.method === "POST") {
    try {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await req.json();
        if (typeof body?.token === "string") return body.token;
      }
    } catch {
      // ignore — query token may still be present
    }
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const token = await resolveToken(req);
    if (!token) {
      if (req.method === "GET") {
        return htmlPage(
          "Invalid link",
          "This unsubscribe link is missing a token. Open the link from your email, or manage preferences in JobFlow settings.",
          false
        );
      }
      return json({ error: "Missing unsubscribe token" }, 400);
    }

    const verified = await verifyUnsubscribeToken(token);
    if (!verified) {
      if (req.method === "GET" && !req.headers.get("accept")?.includes("application/json")) {
        return htmlPage(
          "Link expired",
          "This unsubscribe link is invalid or has expired. Sign in to JobFlow and turn off email alerts in Settings.",
          false
        );
      }
      return json({ error: "Invalid or expired unsubscribe token" }, 400);
    }

    await unsubscribeUser(verified.userId);

    // Email clients doing one-click POST expect 200; browsers hitting GET get HTML.
    const wantsJson =
      req.method === "POST" ||
      (req.headers.get("accept") || "").includes("application/json");

    if (wantsJson) {
      return json({
        success: true,
        message: "You have been unsubscribed from JobFlow emails.",
      });
    }

    return htmlPage(
      "You're unsubscribed",
      "You will no longer receive job alert or digest emails from JobFlow. You can re-enable them anytime in Settings.",
      true
    );
  } catch (error: any) {
    console.error("Unsubscribe error:", error);
    return json(
      { error: error?.message || "Failed to unsubscribe" },
      500
    );
  }
});
