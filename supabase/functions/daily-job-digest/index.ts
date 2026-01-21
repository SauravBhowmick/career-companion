import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Mock job data - in production, this would come from a real job API/scraper
const getMockNewJobs = () => [
  {
    id: "job-1",
    title: "Senior Frontend Developer",
    company: "TechCorp Inc",
    location: "Remote",
    salary: "$120k - $150k",
    matchScore: 95,
  },
  {
    id: "job-2",
    title: "Full Stack Engineer",
    company: "StartupXYZ",
    location: "San Francisco, CA",
    salary: "$130k - $160k",
    matchScore: 88,
  },
  {
    id: "job-3",
    title: "React Developer",
    company: "Digital Agency",
    location: "New York, NY (Hybrid)",
    salary: "$100k - $130k",
    matchScore: 82,
  },
];

const handler = async (req: Request): Promise<Response> => {
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

    console.log("Starting daily job digest...");

    // Get all users with email notifications enabled
    const { data: usersWithNotifications, error: usersError } = await supabase
      .from("user_preferences")
      .select("user_id, match_threshold")
      .eq("email_notifications", true);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!usersWithNotifications || usersWithNotifications.length === 0) {
      console.log("No users with email notifications enabled");
      return new Response(
        JSON.stringify({ message: "No users to notify", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${usersWithNotifications.length} users with notifications enabled`);

    const results = {
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Get mock jobs (in production, fetch from real job API)
    const newJobs = getMockNewJobs();

    for (const userPref of usersWithNotifications) {
      try {
        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("user_id", userPref.user_id)
          .single();

        if (profileError || !profile?.email) {
          console.log(`Skipping user ${userPref.user_id}: no email found`);
          results.skipped++;
          continue;
        }

        // Filter jobs by user's match threshold
        const matchingJobs = newJobs.filter(
          (job) => (job.matchScore || 0) >= (userPref.match_threshold || 75)
        );

        if (matchingJobs.length === 0) {
          console.log(`No matching jobs for user ${userPref.user_id}`);
          results.skipped++;
          continue;
        }

        // Build email HTML
        const jobListHtml = matchingJobs
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

        // Send email
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Job Alerts <onboarding@resend.dev>",
            to: [profile.email],
            subject: `🎯 Daily Job Digest: ${matchingJobs.length} New Matching Job${matchingJobs.length > 1 ? "s" : ""}`,
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
                    <h1 style="color: white; margin: 0; font-size: 24px;">Your Daily Job Digest 📬</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">
                      Hi ${profile.full_name || "there"}, here are today's top ${matchingJobs.length} matching job${matchingJobs.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <table style="width: 100%; border-collapse: collapse;">
                    ${jobListHtml}
                  </table>
                  <div style="padding: 24px; text-align: center; background: #f9fafb;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0;">
                      You're receiving this daily digest because you enabled job alerts.<br>
                      Manage your notification preferences in your account settings.
                    </p>
                  </div>
                </div>
              </body>
              </html>
            `,
          }),
        });

        const emailData = await emailResponse.json();

        if (!emailResponse.ok) {
          console.error(`Failed to send email to ${profile.email}:`, emailData);
          results.failed++;
          results.errors.push(`${profile.email}: ${emailData.message || "Unknown error"}`);
        } else {
          console.log(`Email sent to ${profile.email}`);
          results.sent++;
        }
      } catch (userError: any) {
        console.error(`Error processing user ${userPref.user_id}:`, userError);
        results.failed++;
        results.errors.push(`User ${userPref.user_id}: ${userError.message}`);
      }
    }

    console.log("Daily digest complete:", results);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in daily-job-digest function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
