import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { Job } from "@/types/job";
import { toast } from "sonner";

export interface JobApplication {
  id: string;
  user_id: string;
  job_title: string;
  company: string;
  job_type: string | null;
  location: string | null;
  salary_range: string | null;
  match_score: number | null;
  status: "applied" | "viewed" | "interview" | "offer" | "rejected";
  auto_applied: boolean;
  applied_at: string;
}

export interface SavedJob {
  id: string;
  user_id: string;
  job_external_id: string;
  job_title: string;
  company: string;
  saved_at: string;
}

export function useJobApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchApplications();
      fetchSavedJobs();
    } else {
      setApplications([]);
      setSavedJobs([]);
      setLoading(false);
    }
  }, [user]);

  const fetchApplications = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("job_applications")
      .select("*")
      .eq("user_id", user.id)
      .order("applied_at", { ascending: false });
    
    if (error) {
      console.error("Error fetching applications:", error);
    }
    setApplications((data as JobApplication[]) || []);
    setLoading(false);
  };

  const fetchSavedJobs = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("saved_jobs")
      .select("*")
      .eq("user_id", user.id);
    
    if (error) {
      console.error("Error fetching saved jobs:", error);
    }
    setSavedJobs(data || []);
  };

  const applyToJob = async (job: Job, autoApplySimilar: boolean) => {
    if (!user) return;
    
    const { error } = await supabase
      .from("job_applications")
      .insert({
        user_id: user.id,
        job_title: job.title,
        company: job.company,
        job_type: job.type,
        location: job.location,
        salary_range: job.salary,
        match_score: job.matchScore,
        auto_applied: false,
      });
    
    if (error) {
      toast.error("Failed to submit application");
      console.error(error);
    } else {
      toast.success(`Applied to ${job.title} at ${job.company}!`);
      if (autoApplySimilar) {
        toast.info("Auto-apply enabled for similar roles");
      }
      fetchApplications();
    }
  };

  const saveJob = async (job: Job) => {
    if (!user) return;
    
    const existing = savedJobs.find(s => s.job_external_id === job.id);
    
    if (existing) {
      const { error } = await supabase
        .from("saved_jobs")
        .delete()
        .eq("id", existing.id);
      
      if (error) {
        toast.error("Failed to unsave job");
        console.error(error);
      } else {
        toast.info(`Removed ${job.title} from saved jobs`);
        fetchSavedJobs();
      }
    } else {
      const { error } = await supabase
        .from("saved_jobs")
        .insert({
          user_id: user.id,
          job_external_id: job.id,
          job_title: job.title,
          company: job.company,
        });
      
      if (error) {
        toast.error("Failed to save job");
        console.error(error);
      } else {
        toast.success(`Saved ${job.title}`);
        fetchSavedJobs();
      }
    }
  };

  const isJobSaved = (jobId: string) => {
    return savedJobs.some(s => s.job_external_id === jobId);
  };

  const updateApplicationStatus = async (
    applicationId: string,
    status: JobApplication["status"]
  ) => {
    if (!user) return;

    const { error } = await supabase
      .from("job_applications")
      .update({ status })
      .eq("id", applicationId)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to update status");
      console.error(error);
    } else {
      toast.success(`Status updated to ${status}`);
      fetchApplications();
    }
  };

  return {
    applications,
    savedJobs,
    loading,
    applyToJob,
    saveJob,
    isJobSaved,
    updateApplicationStatus,
    refetch: () => {
      fetchApplications();
      fetchSavedJobs();
    },
  };
}
