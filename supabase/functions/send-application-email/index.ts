const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ApplicationEmailRequest {
  jobTitle: string;
  company: string;
  applicantEmail: string;
  applicantPhone: string;
  coverLetter?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const {
      jobTitle,
      company,
      applicantEmail,
      applicantPhone,
      coverLetter,
    }: ApplicationEmailRequest = await req.json();

    if (!applicantEmail || !jobTitle) {
      throw new Error("applicantEmail and jobTitle are required");
    }

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
          to: [applicantEmail],
          subject: `Application Confirmed: ${jobTitle} at ${company}`,
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
                    Your application for <strong>${jobTitle}</strong> at <strong>${company}</strong> has been submitted successfully.
                  </p>
                  <div style="margin: 24px 0; padding: 16px; background: #f3f4f6; border-radius: 8px;">
                    <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;"><strong>Position:</strong> ${jobTitle}</p>
                    <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;"><strong>Company:</strong> ${company}</p>
                    <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;"><strong>Email:</strong> ${applicantEmail}</p>
                    <p style="margin: 0; color: #6b7280; font-size: 14px;"><strong>Phone:</strong> ${applicantPhone}</p>
                  </div>
                  ${coverLetter ? `
                  <div style="margin: 24px 0;">
                    <p style="color: #374151; font-weight: 600; margin-bottom: 8px;">Your Cover Letter:</p>
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${coverLetter}</p>
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
