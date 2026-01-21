import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Job } from '@/types/job';

interface FetchJobsOptions {
  query?: string;
  location?: string;
  jobType?: string;
}

export function useRealJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async (options: FetchJobsOptions = {}) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-jobs', {
        body: options,
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch jobs');
      }

      // Transform to match the Job type
      const transformedJobs: Job[] = data.jobs.map((job: any) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary || 'Competitive',
        type: job.type || 'Full-time',
        posted: 'Recently',
        matchScore: job.matchScore || 80,
        tags: extractTags(job.title, job.description),
        description: job.description,
        requirements: [],
        url: job.url,
      }));

      setJobs(transformedJobs);
      return transformedJobs;
    } catch (err: any) {
      const message = err.message || 'Failed to fetch jobs';
      setError(message);
      toast.error(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    jobs,
    loading,
    error,
    fetchJobs,
  };
}

function extractTags(title: string, description?: string): string[] {
  const tags: string[] = [];
  const text = `${title} ${description || ''}`.toLowerCase();

  const techKeywords = [
    'react', 'javascript', 'typescript', 'node', 'python', 'java', 'go', 'rust',
    'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'sql', 'mongodb', 'graphql',
    'vue', 'angular', 'next.js', 'tailwind', 'css', 'html', 'api', 'rest',
    'machine learning', 'ai', 'data science', 'devops', 'ci/cd', 'agile',
  ];

  for (const keyword of techKeywords) {
    if (text.includes(keyword)) {
      tags.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
    }
  }

  return tags.slice(0, 5);
}
