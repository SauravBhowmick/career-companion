import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Job } from "@/types/job";
import { toast } from "sonner";

export function useJobMatcher() {
  const { user } = useAuth();
  const [matching, setMatching] = useState(false);

  const matchJobs = useCallback(
    async (jobs: Job[]): Promise<Job[]> => {
      if (!user || jobs.length === 0) {
        return jobs;
      }

      setMatching(true);

      try {
        const { data, error } = await supabase.functions.invoke("match-jobs", {
          body: {
            userId: user.id,
            jobs: jobs.map((job) => ({
              id: job.id,
              title: job.title,
              company: job.company,
              description: job.description,
              requirements: job.requirements,
              tags: job.tags,
            })),
          },
        });

        if (error) {
          console.error("Match jobs error:", error);
          return jobs;
        }

        if (data.rateLimited) {
          toast.warning("AI matching rate limited. Showing default scores.");
        } else if (data.creditsExhausted) {
          toast.warning("AI credits exhausted. Showing default scores.");
        }

        if (!data.success || !data.matchedJobs) {
          return jobs;
        }

        // Merge match scores back into original jobs
        const matchedMap = new Map<string, { matchScore: number; matchReason?: string }>(
          data.matchedJobs.map((mj: { id: string; matchScore: number; matchReason?: string }) => [
            mj.id,
            { matchScore: mj.matchScore, matchReason: mj.matchReason },
          ])
        );

        return jobs.map((job) => {
          const matched = matchedMap.get(job.id);
          if (matched) {
            return {
              ...job,
              matchScore: matched.matchScore,
              matchReason: matched.matchReason,
            };
          }
          return job;
        });
      } catch (error) {
        console.error("Error matching jobs:", error);
        return jobs;
      } finally {
        setMatching(false);
      }
    },
    [user]
  );

  return {
    matchJobs,
    matching,
  };
}
