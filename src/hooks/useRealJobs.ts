import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Job } from '@/types/job';

interface FetchJobsOptions {
  query?: string;
  location?: string;
  jobType?: string;
  forceRefresh?: boolean;
}

export function useRealJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  // TODO: supabase.functions.invoke does not support AbortSignal yet —
  // revisit when https://github.com/supabase/supabase-js/issues/797 lands.
  const cacheRef = useRef<Map<string, { jobs: Job[]; sources: string[]; ts: number }>>(new Map());

  const fetchJobs = useCallback(async (options: FetchJobsOptions = {}) => {
    const { forceRefresh, ...searchParams } = options;
    const cacheKey = JSON.stringify(searchParams);

    if (forceRefresh) {
      cacheRef.current.delete(cacheKey);
    } else {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
        setJobs(cached.jobs);
        setSources(cached.sources);
        return cached.jobs;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-jobs', {
        body: searchParams,
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch jobs');
      }

      if (data.warnings) {
        toast.warning(data.warnings);
      }

      const transformedJobs: Job[] = data.jobs.map((job: any) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        companyLogo: `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company.substring(0, 2))}&background=6366f1&color=fff&size=80`,
        location: job.location,
        salary: job.salary || 'Competitive',
        type: job.type || 'Full-time',
        postedAt: job.postedAt ? formatPostedDate(job.postedAt) : 'Recently',
        matchScore: job.matchScore,
        tags: extractTags(job.title, job.description),
        description: job.description || '',
        requirements: [],
        website: job.url,
        source: job.source,
      }));

      const fetchedSources: string[] = data.sources || [];
      setJobs(transformedJobs);
      setSources(fetchedSources);
      cacheRef.current.set(cacheKey, { jobs: transformedJobs, sources: fetchedSources, ts: Date.now() });
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
    sources,
    fetchJobs,
  };
}

function formatPostedDate(isoDate: string): string {
  const posted = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - posted.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  const weeks = Math.floor(diffDays / 7);
  return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
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
