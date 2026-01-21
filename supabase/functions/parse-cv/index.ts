import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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

    const { userId, cvPath } = await req.json();

    if (!userId || !cvPath) {
      throw new Error("userId and cvPath are required");
    }

    console.log(`Parsing CV for user ${userId}, path: ${cvPath}`);

    // Download the CV file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("resumes")
      .download(cvPath);

    if (downloadError) {
      throw new Error(`Failed to download CV: ${downloadError.message}`);
    }

    // Extract text content from the file
    const text = await fileData.text();
    
    console.log("CV content length:", text.length);

    // Use AI to parse the CV and extract structured data
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are an expert CV/resume parser. Extract structured information from resumes.
Your task is to analyze the resume text and extract:
1. Skills (technical skills, soft skills, tools, technologies)
2. Job title/current role
3. Years of experience (approximate)
4. Location if mentioned

Be thorough in extracting ALL skills mentioned, including:
- Programming languages (JavaScript, Python, etc.)
- Frameworks (React, Angular, Node.js, etc.)
- Tools (Git, Docker, AWS, etc.)
- Soft skills (Leadership, Communication, etc.)
- Certifications and specializations`,
          },
          {
            role: "user",
            content: `Parse this resume and extract the information:\n\n${text.substring(0, 15000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_cv_data",
              description: "Extract structured data from a CV/resume",
              parameters: {
                type: "object",
                properties: {
                  skills: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of all skills found in the resume (technical, soft skills, tools, etc.)",
                  },
                  current_title: {
                    type: "string",
                    description: "The person's current or most recent job title",
                  },
                  experience_years: {
                    type: "number",
                    description: "Approximate years of professional experience",
                  },
                  location: {
                    type: "string",
                    description: "Location if mentioned in the resume",
                  },
                  summary: {
                    type: "string",
                    description: "Brief 1-2 sentence summary of the candidate's profile",
                  },
                },
                required: ["skills"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_cv_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("AI response:", JSON.stringify(aiResponse, null, 2));

    // Extract the parsed data from the tool call
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("Failed to parse CV - no structured data returned");
    }

    const parsedData = JSON.parse(toolCall.function.arguments);
    console.log("Parsed CV data:", parsedData);

    // Get existing skills to avoid duplicates
    const { data: existingSkills } = await supabase
      .from("user_skills")
      .select("skill")
      .eq("user_id", userId);

    const existingSkillNames = new Set(
      existingSkills?.map((s) => s.skill.toLowerCase()) || []
    );

    // Add new skills that don't already exist
    const newSkills = (parsedData.skills || []).filter(
      (skill: string) => !existingSkillNames.has(skill.toLowerCase())
    );

    if (newSkills.length > 0) {
      const skillsToInsert = newSkills.map((skill: string) => ({
        user_id: userId,
        skill: skill,
      }));

      const { error: insertError } = await supabase
        .from("user_skills")
        .insert(skillsToInsert);

      if (insertError) {
        console.error("Error inserting skills:", insertError);
      }
    }

    // Update profile with extracted data if available
    const profileUpdates: Record<string, any> = {};
    if (parsedData.current_title) {
      profileUpdates.current_title = parsedData.current_title;
    }
    if (parsedData.experience_years) {
      profileUpdates.experience_years = parsedData.experience_years;
    }
    if (parsedData.location) {
      profileUpdates.preferred_location = parsedData.location;
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("user_id", userId);

      if (updateError) {
        console.error("Error updating profile:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        extracted: {
          skills: parsedData.skills || [],
          newSkillsAdded: newSkills.length,
          currentTitle: parsedData.current_title,
          experienceYears: parsedData.experience_years,
          location: parsedData.location,
          summary: parsedData.summary,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in parse-cv function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
