import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JobToMatch {
  id: string;
  title: string;
  company: string;
  description?: string;
  requirements?: string[];
  tags?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, jobs } = await req.json() as { userId: string; jobs: JobToMatch[] };

    if (!userId || !jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, matchedJobs: jobs.map(j => ({ ...j, matchScore: 50 })) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user skills and profile
    const [{ data: skillsData }, { data: profileData }] = await Promise.all([
      supabase.from("user_skills").select("skill").eq("user_id", userId),
      supabase.from("profiles").select("current_title, experience_years, preferred_location").eq("user_id", userId).single(),
    ]);

    const userSkills = skillsData?.map(s => s.skill) || [];
    const userTitle = profileData?.current_title || "";
    const experienceYears = profileData?.experience_years || 0;

    if (userSkills.length === 0 && !userTitle) {
      // No skills or profile data, return default scores
      return new Response(
        JSON.stringify({ 
          success: true, 
          matchedJobs: jobs.map(j => ({ ...j, matchScore: 50 })) 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Matching ${jobs.length} jobs for user with ${userSkills.length} skills`);

    // Prepare job summaries for AI
    const jobSummaries = jobs.map((job, index) => ({
      index,
      title: job.title,
      company: job.company,
      requirements: job.requirements?.join(", ") || "",
      tags: job.tags?.join(", ") || "",
      description: (job.description || "").substring(0, 300),
    }));

    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 20000);

    let response: Response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are an expert job matching AI. Analyze how well a candidate matches job listings based on their skills and experience.

Candidate Profile:
- Current/Target Title: ${userTitle || "Not specified"}
- Skills: ${userSkills.join(", ") || "Not specified"}
- Years of Experience: ${experienceYears || "Not specified"}

Score each job from 0-100 based on:
- Skill match (40%): How many required skills does the candidate have?
- Title relevance (30%): How related is the job to their experience/target role?
- Overall fit (30%): Considering all factors, how good is this match?

Be realistic: a perfect match is rare. Most matches should be 40-80.`,
            },
            {
              role: "user",
              content: `Analyze these ${jobs.length} jobs and provide match scores:\n\n${JSON.stringify(jobSummaries, null, 2)}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_match_scores",
                description: "Return match scores for each job",
                parameters: {
                  type: "object",
                  properties: {
                    matches: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          index: { type: "number", description: "The job index from the input" },
                          score: { type: "number", description: "Match score from 0-100" },
                          reason: { type: "string", description: "Brief reason for the score (max 50 chars)" },
                        },
                        required: ["index", "score"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["matches"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "return_match_scores" } },
        }),
        signal: aiController.signal,
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.warn("AI matching timed out, returning default scores");
        return new Response(
          JSON.stringify({
            success: true,
            matchedJobs: jobs.map(j => ({ ...j, matchScore: 50 })),
            timedOut: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    } finally {
      clearTimeout(aiTimeout);
    }

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("Rate limited, returning default scores");
        return new Response(
          JSON.stringify({ 
            success: true, 
            matchedJobs: jobs.map(j => ({ ...j, matchScore: 50 })),
            rateLimited: true
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        console.warn("Credits exhausted, returning default scores");
        return new Response(
          JSON.stringify({ 
            success: true, 
            matchedJobs: jobs.map(j => ({ ...j, matchScore: 50 })),
            creditsExhausted: true
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.warn("No structured response from AI, returning default scores");
      return new Response(
        JSON.stringify({ 
          success: true, 
          matchedJobs: jobs.map(j => ({ ...j, matchScore: 50 })) 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const matchResults = parsed.matches || [];

    // Create a map of index to score
    const scoreMap = new Map<number, { score: number; reason?: string }>();
    for (const match of matchResults) {
      scoreMap.set(match.index, { score: match.score, reason: match.reason });
    }

    // Apply scores to jobs
    const matchedJobs = jobs.map((job, index) => {
      const matchData = scoreMap.get(index);
      return {
        ...job,
        matchScore: matchData?.score ?? 50,
        matchReason: matchData?.reason,
      };
    });

    console.log(`Successfully matched ${jobs.length} jobs`);

    return new Response(
      JSON.stringify({ success: true, matchedJobs }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in match-jobs function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
