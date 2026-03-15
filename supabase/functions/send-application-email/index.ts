import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ApplicationEmailRequest {
  jobTitle: string;
  company: string;
  applicantPhone: string;
  coverLetter?: string;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_ACTION = "send_application_email";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizePlainText(str: string): string {
  return str.replace(/[\r\n\x00-\x1f]+/g, " ").replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // --- Auth: extract and verify JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Rate limiting per user (persistent via Supabase) ---
    const { data: rateLimited, error: rlError } = await supabase.rpc(
      "check_rate_limit",
      {
        p_user_id: user.id,
        p_action: RATE_LIMIT_ACTION,
        p_window_ms: RATE_LIMIT_WINDOW_MS,
        p_max_requests: RATE_LIMIT_MAX,
      }
    );

    if (rlError) {
      console.error("Rate-limit check failed:", rlError.message);
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable. Please try again shortly." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (rateLimited === true) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a minute before trying again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      jobTitle,
      company,
      applicantPhone,
      coverLetter,
    }: ApplicationEmailRequest = await req.json();

    if (!jobTitle) {
      throw new Error("jobTitle is required");
    }

    // Recipient is always the authenticated user's email — never caller-supplied
    const recipientEmail = user.email;
    if (!recipientEmail) {
      throw new Error("Your account has no email address on file");
    }

    // Plain-text sanitized values for email subject (no HTML encoding)
    const plainJobTitle = sanitizePlainText(jobTitle);
    const plainCompany = sanitizePlainText(company || "Unknown");

    // HTML-escaped values for the email body
    const safeJobTitle = escapeHtml(jobTitle);
    const safeCompany = escapeHtml(company || "Unknown");
    const safeEmail = escapeHtml(recipientEmail);
    const safePhone = escapeHtml(applicantPhone || "Not provided");
    const safeCoverLetter = coverLetter ? escapeHtml(coverLetter) : "";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let emailResponse: Response;
    try {
      emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "JobFlow Applications <onboarding@resend.dev>",
          to: [recipientEmail],
          subject: `Application Confirmed: ${plainJobTitle} at ${plainCompany}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px;">
              <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">Application Submitted!</h1>
                </div>
                <div style="padding: 32px;">
                  <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                    Your application for <strong>${safeJobTitle}</strong> at <strong>${safeCompany}</strong> has been submitted successfully.
                  </p>
                  <div style="margin: 24px 0; padding: 16px; background: #f3f4f6; border-radius: 8px;">
                    <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;"><strong>Position:</strong> ${safeJobTitle}</p>
                    <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;"><strong>Company:</strong> ${safeCompany}</p>
                    <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;"><strong>Email:</strong> ${safeEmail}</p>
                    <p style="margin: 0; color: #6b7280; font-size: 14px;"><strong>Phone:</strong> ${safePhone}</p>
                  </div>
                  ${safeCoverLetter ? `
                  <div style="margin: 24px 0;">
                    <p style="color: #374151; font-weight: 600; margin-bottom: 8px;">Your Cover Letter:</p>
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${safeCoverLetter}</p>
                  </div>
                  ` : ""}
                  <p style="color: #9ca3af; font-size: 13px; margin-top: 24px;">
                    Track your application status in your JobFlow dashboard.
                  </p>
                </div>
              </div>
            </body>
            </html>
          `,
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        return new Response(
          JSON.stringify({ error: "Email send timed out" }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      throw new Error(emailData.message || "Failed to send confirmation email");
    }

    // Persist an in-app notification
    const { error: nErr } = await supabase.from("notifications").insert({
      user_id: user.id,
      type: "application",
      title: `Application Sent: ${sanitizePlainText(jobTitle)}`,
      body: `Your application for ${sanitizePlainText(jobTitle)} at ${sanitizePlainText(company || "Unknown")} was submitted.`,
      metadata: { job_title: jobTitle, company },
    });
    if (nErr) console.error("Failed to insert application notification:", nErr.message);

    return new Response(JSON.stringify({ success: true, ...emailData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-application-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
