import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  matchScore?: number;
}

export function useJobAlerts() {
  const { user } = useAuth();

  const sendJobAlert = async (jobs: Job[]) => {
    if (!user) {
      console.log("No user logged in, skipping job alert");
      return { success: false, error: "Not authenticated" };
    }

    if (jobs.length === 0) {
      return { success: false, error: "No jobs to send" };
    }

    try {
      const { data, error } = await supabase.functions.invoke("send-job-alert", {
        body: {
          userId: user.id,
          jobs: jobs.map((job) => ({
            id: job.id,
            title: job.title,
            company: job.company,
            location: job.location,
            salary: job.salary,
            matchScore: job.matchScore,
          })),
        },
      });

      if (error) throw error;

      console.log("Job alert sent:", data);
      return { success: true, data };
    } catch (error: any) {
      console.error("Error sending job alert:", error);
      return { success: false, error: error.message };
    }
  };

  const testJobAlert = async () => {
    const testJobs: Job[] = [
      {
        id: "test-1",
        title: "Senior Frontend Developer",
        company: "TechCorp",
        location: "Remote",
        salary: "$120k - $150k",
        matchScore: 95,
      },
      {
        id: "test-2",
        title: "Full Stack Engineer",
        company: "StartupXYZ",
        location: "San Francisco, CA",
        salary: "$130k - $160k",
        matchScore: 88,
      },
    ];

    const result = await sendJobAlert(testJobs);
    
    if (result.success) {
      toast.success("Test job alert email sent!");
    } else {
      toast.error(`Failed to send: ${result.error}`);
    }
    
    return result;
  };

  return {
    sendJobAlert,
    testJobAlert,
  };
}
