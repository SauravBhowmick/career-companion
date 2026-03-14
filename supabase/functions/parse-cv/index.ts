import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB
const TEXT_TARGET_LENGTH = 15_000;

/**
 * Best-effort PDF text extraction using raw BT/ET operator parsing.
 * Limitations: will not extract text from compressed streams (FlateDecode),
 * CID-keyed fonts, XObject forms, or scanned/image-only PDFs. For production
 * use with complex PDFs, consider integrating a full parser (e.g. pdf-parse
 * or pdfjs-dist). Returns empty string when no text is recoverable.
 *
 * Safety: rejects buffers larger than MAX_PDF_BYTES and stops scanning once
 * TEXT_TARGET_LENGTH characters have been collected, since the downstream AI
 * prompt is truncated to 15 000 chars anyway.
 */
function extractTextFromPdf(buffer: ArrayBuffer): string {
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new Error(
      `PDF is too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). ` +
      `Maximum supported size is ${MAX_PDF_BYTES / 1024 / 1024} MB.`
    );
  }

  const bytes = new Uint8Array(buffer);
  const raw = new TextDecoder("latin1").decode(bytes);

  const textChunks: string[] = [];
  let collectedLength = 0;

  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(raw)) !== null) {
    if (collectedLength >= TEXT_TARGET_LENGTH) break;

    const block = match[1];

    const parenRegex = /\(([^)]*)\)/g;
    let pm;
    while ((pm = parenRegex.exec(block)) !== null) {
      const chunk = pm[1].trim();
      if (chunk) {
        textChunks.push(chunk);
        collectedLength += chunk.length;
        if (collectedLength >= TEXT_TARGET_LENGTH) break;
      }
    }
    if (collectedLength >= TEXT_TARGET_LENGTH) break;

    const hexRegex = /<([0-9A-Fa-f]+)>/g;
    let hm;
    while ((hm = hexRegex.exec(block)) !== null) {
      const hex = hm[1];
      let decoded = "";
      for (let i = 0; i < hex.length; i += 2) {
        const charCode = parseInt(hex.substring(i, i + 2), 16);
        if (charCode >= 32 && charCode < 127) decoded += String.fromCharCode(charCode);
      }
      const chunk = decoded.trim();
      if (chunk) {
        textChunks.push(chunk);
        collectedLength += chunk.length;
        if (collectedLength >= TEXT_TARGET_LENGTH) break;
      }
    }
  }

  if (textChunks.length > 0) {
    return textChunks.join(" ").replace(/\s+/g, " ").trim().substring(0, TEXT_TARGET_LENGTH);
  }

  // Fallback: scan for printable ASCII words, but only up to a bounded slice
  // to avoid O(n) replacement over the full multi-MB string.
  const scanLimit = Math.min(raw.length, 500_000);
  const slice = raw.substring(0, scanLimit);
  const printable = slice.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
  const words = printable.split(" ").filter((w) => w.length > 2);
  return words.join(" ").substring(0, TEXT_TARGET_LENGTH);
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

    const { userId, cvPath } = await req.json();

    if (!userId || !cvPath) {
      throw new Error("userId and cvPath are required");
    }

    console.log(`Parsing CV for user ${userId}, path: ${cvPath}`);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("resumes")
      .download(cvPath);

    if (downloadError) {
      throw new Error(`Failed to download CV: ${downloadError.message}`);
    }

    const fileExtension = cvPath.split(".").pop()?.toLowerCase();
    let text: string;

    if (fileExtension === "doc" || fileExtension === "docx") {
      throw new Error(
        "DOC/DOCX files cannot be parsed directly. Please convert your resume to PDF and re-upload."
      );
    } else if (fileExtension === "pdf") {
      const buffer = await fileData.arrayBuffer();
      text = extractTextFromPdf(buffer);
    } else {
      text = await fileData.text();
    }

    if (!text || text.trim().length < 20) {
      throw new Error(
        "Could not extract readable text from your resume. Please upload a text-based PDF (not scanned/image-based)."
      );
    }

    console.log("CV content length:", text.length);

    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 25000);

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
      signal: aiController.signal,
    });
    } catch (err: any) {
      if (err.name === "AbortError") {
        return new Response(
          JSON.stringify({ error: "CV parsing timed out. Please try again." }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    } finally {
      clearTimeout(aiTimeout);
    }

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
