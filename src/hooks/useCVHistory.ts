import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CVUploadRecord {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  uploaded_at: string;
  skills_extracted: number;
  parsing_status: string;
}

export function useCVHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<CVUploadRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!user) {
      setHistory([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("cv_upload_history")
        .select("*")
        .eq("user_id", user.id)
        .order("uploaded_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Error fetching CV history:", error);
    } finally {
      setLoading(false);
    }
  };

  const addHistoryRecord = async (
    fileName: string,
    filePath: string,
    fileSize: number
  ): Promise<string | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("cv_upload_history")
        .insert({
          user_id: user.id,
          file_name: fileName,
          file_path: filePath,
          file_size: fileSize,
          parsing_status: "pending",
        })
        .select("id")
        .single();

      if (error) throw error;
      await fetchHistory();
      return data.id;
    } catch (error) {
      console.error("Error adding CV history record:", error);
      return null;
    }
  };

  const updateParsingStatus = async (
    recordId: string,
    status: "completed" | "failed",
    skillsExtracted?: number
  ) => {
    try {
      const { error } = await supabase
        .from("cv_upload_history")
        .update({
          parsing_status: status,
          skills_extracted: skillsExtracted || 0,
        })
        .eq("id", recordId);

      if (error) throw error;
      await fetchHistory();
    } catch (error) {
      console.error("Error updating parsing status:", error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  return {
    history,
    loading,
    addHistoryRecord,
    updateParsingStatus,
    refetch: fetchHistory,
  };
}
