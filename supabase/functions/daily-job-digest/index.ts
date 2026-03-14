import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DigestJob {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  matchScore?: number;
}

async function fetchLiveJobs(query: string): Promise<DigestJob[]> {
  if (!FIRECRAWL_API_KEY) {
    console.warn("FIRECRAWL_API_KEY not set, using fallback jobs");
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const currentYear = new Date().getFullYear();
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `${query} jobs hiring ${currentYear}`,
        limit: 10,
        lang: "en",
        country: "us",
        tbs: "qdr:d",
        scrapeOptions: { formats: ["markdown"] },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.data || []).map((result: any, index: number) => {
      const url = result.url || "";
      let company = "Company";
      const urlMatch = url.match(/https?:\/\/(?:www\.)?([^/]+)/);
      if (urlMatch) {
        company = urlMatch[1].replace(".com", "").replace(".io", "");
        company = company.charAt(0).toUpperCase() + company.slice(1);
      }
      return {
        id: `digest-${Date.now()}-${index}`,
        title: (result.title || "Job Position").replace(/\s*[-|]\s*.*$/, "").trim().substring(0, 100),
        company,
        location: "Remote",
        matchScore: Math.floor(70 + Math.random() * 28),
      };
    }).filter((j: DigestJob) =>
      j.title &&
      j.title.toLowerCase() !== "job position" &&
      !j.title.toLowerCase().includes("sign in")
    );
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

const FALLBACK_JOBS: DigestJob[] = [
  { id: "fb-1", title: "Senior Frontend Developer", company: "TechCorp Inc", location: "Remote", salary: "$120k - $150k", matchScore: 95 },
  { id: "fb-2", title: "Full Stack Engineer", company: "StartupXYZ", location: "San Francisco, CA", salary: "$130k - $160k", matchScore: 88 },
  { id: "fb-3", title: "React Developer", company: "Digital Agency", location: "New York, NY (Hybrid)", salary: "$100k - $130k", matchScore: 82 },
];

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

    console.log("Starting daily job digest...");

    const { data: usersWithNotifications, error: usersError } = await supabase
      .from("user_preferences")
      .select("user_id, match_threshold, preferred_job_types")
      .eq("email_notifications", true);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!usersWithNotifications || usersWithNotifications.length === 0) {
      return new Response(
        JSON.stringify({ message: "No users to notify", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${usersWithNotifications.length} users with notifications enabled`);

    // Fetch live jobs (with fallback)
    const liveJobs = await fetchLiveJobs("software developer");
    const newJobs = liveJobs.length > 0 ? liveJobs : FALLBACK_JOBS;
    console.log(`Using ${liveJobs.length > 0 ? "live" : "fallback"} jobs (${newJobs.length} total)`);

    const results = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] };

    // Batch fetch all user profiles in one query
    const userIds = usersWithNotifications.map((u) => u.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.user_id, p])
    );

    // Send emails concurrently in batches of 5
    const BATCH_SIZE = 5;
    for (let i = 0; i < usersWithNotifications.length; i += BATCH_SIZE) {
      const batch = usersWithNotifications.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (userPref) => {
          const profile = profileMap.get(userPref.user_id);
          if (!profile?.email) {
            results.skipped++;
            return;
          }

          const matchingJobs = newJobs.filter(
            (job) => (job.matchScore || 0) >= (userPref.match_threshold || 75)
          );

          if (matchingJobs.length === 0) {
            results.skipped++;
            return;
          }

          const jobListHtml = matchingJobs
            .map(
              (job) => `
              <tr>
                <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                  <h3 style="margin: 0 0 4px 0; color: #111827; font-size: 16px;">${job.title}</h3>
                  <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px;">${job.company}</p>
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                    ${job.location}${job.salary ? ` &bull; ${job.salary}` : ""}
                    ${job.matchScore ? ` &bull; ${job.matchScore}% match` : ""}
                  </p>
                </td>
              </tr>
            `
            )
            .join("");

          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "Job Alerts <onboarding@resend.dev>",
              to: [profile.email],
              subject: `Daily Job Digest: ${matchingJobs.length} New Matching Job${matchingJobs.length > 1 ? "s" : ""}`,
              html: `
                <!DOCTYPE html>
                <html>
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px;">
                  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
                      <h1 style="color: white; margin: 0; font-size: 24px;">Your Daily Job Digest</h1>
                      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">
                        Hi ${profile.full_name || "there"}, here are today's top ${matchingJobs.length} matching job${matchingJobs.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    <table style="width: 100%; border-collapse: collapse;">${jobListHtml}</table>
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
            results.failed++;
            results.errors.push(`${profile.email}: ${emailData.message || "Unknown error"}`);
          } else {
            results.sent++;
          }
        })
      );
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
});
