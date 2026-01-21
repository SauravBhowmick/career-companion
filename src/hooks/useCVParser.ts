import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ParsedCVData {
  skills: string[];
  newSkillsAdded: number;
  currentTitle?: string;
  experienceYears?: number;
  location?: string;
  summary?: string;
}

export function useCVParser() {
  const parseCV = async (
    userId: string,
    cvPath: string
  ): Promise<{ success: boolean; data?: ParsedCVData; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke("parse-cv", {
        body: { userId, cvPath },
      });

      if (error) {
        console.error("CV parsing error:", error);
        return { success: false, error: error.message };
      }

      if (data.error) {
        return { success: false, error: data.error };
      }

      return { success: true, data: data.extracted };
    } catch (error: any) {
      console.error("CV parsing error:", error);
      return { success: false, error: error.message };
    }
  };

  const parseAndNotify = async (
    userId: string,
    cvPath: string,
    onComplete?: () => void
  ) => {
    toast.loading("Analyzing your resume with AI...", { id: "cv-parse" });

    const result = await parseCV(userId, cvPath);

    if (result.success && result.data) {
      const { newSkillsAdded, currentTitle, summary } = result.data;
      
      let message = "";
      if (newSkillsAdded > 0) {
        message += `Found ${newSkillsAdded} new skill${newSkillsAdded > 1 ? "s" : ""}`;
      }
      if (currentTitle) {
        message += message ? ` • Updated title to "${currentTitle}"` : `Updated title to "${currentTitle}"`;
      }
      if (!message) {
        message = "Resume analyzed successfully";
      }

      toast.success(message, { id: "cv-parse", duration: 5000 });
      
      if (summary) {
        console.log("CV Summary:", summary);
      }
      
      onComplete?.();
    } else {
      toast.error(result.error || "Failed to analyze resume", { id: "cv-parse" });
    }

    return result;
  };

  return {
    parseCV,
    parseAndNotify,
  };
}
