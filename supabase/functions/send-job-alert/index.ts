import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface JobAlertRequest {
  userId: string;
  jobs: {
    id: string;
    title: string;
    company: string;
    location: string;
    salary?: string;
    matchScore?: number;
  }[];
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, jobs }: JobAlertRequest = await req.json();

    const [{ data: profile, error: profileError }, { data: preferences }] = await Promise.all([
      supabase.from("profiles").select("email, full_name").eq("user_id", userId).single(),
      supabase.from("user_preferences").select("email_notifications").eq("user_id", userId).single(),
    ]);

    if (profileError || !profile?.email) {
      throw new Error("User profile not found or missing email");
    }

    if (!preferences?.email_notifications) {
      return new Response(
        JSON.stringify({ message: "Email notifications disabled" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const jobListHtml = jobs
      .map(
        (job) => `
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
            <h3 style="margin: 0 0 4px 0; color: #111827; font-size: 16px;">${job.title}</h3>
            <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px;">${job.company}</p>
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
              ${job.location}${job.salary ? ` • ${job.salary}` : ""}
              ${job.matchScore ? ` • ${job.matchScore}% match` : ""}
            </p>
          </td>
        </tr>
      `
      )
      .join("");

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
          from: "Job Alerts <onboarding@resend.dev>",
          to: [profile.email],
          subject: `${jobs.length} New Job${jobs.length > 1 ? "s" : ""} Matching Your Profile`,
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
                  <h1 style="color: white; margin: 0; font-size: 24px;">New Jobs For You!</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">
                    Hi ${profile.full_name || "there"}, we found ${jobs.length} new job${jobs.length > 1 ? "s" : ""} matching your profile
                  </p>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                  ${jobListHtml}
                </table>
                <div style="padding: 24px; text-align: center; background: #f9fafb;">
                  <p style="color: #6b7280; font-size: 12px; margin: 0;">
                    You're receiving this because you enabled job alerts.<br>
                    Manage your notification preferences in your account settings.
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
          { status: 504, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      throw new Error(emailData.message || "Failed to send email");
    }

    console.log("Job alert email sent successfully:", emailData);

    return new Response(JSON.stringify(emailData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-job-alert function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
