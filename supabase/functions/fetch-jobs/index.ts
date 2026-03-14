const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  type?: string;
  description?: string;
  url?: string;
  postedAt?: string;
  source?: string;
}

const JOB_BOARD_SEARCHES = [
  { label: "General",   sites: null,                                           limit: 8 },
  { label: "LinkedIn + Indeed", sites: "site:linkedin.com/jobs OR site:indeed.com", limit: 5 },
  { label: "EU Boards", sites: "site:stepstone.de OR site:heyjobs.co OR site:xing.com", limit: 5 },
];

function detectSource(url: string): string {
  const host = url.toLowerCase();
  if (host.includes("linkedin.com"))  return "LinkedIn";
  if (host.includes("indeed.com"))    return "Indeed";
  if (host.includes("stepstone"))     return "StepStone";
  if (host.includes("heyjobs"))       return "HeyJobs";
  if (host.includes("xing.com"))      return "Xing";
  if (host.includes("glassdoor"))     return "Glassdoor";
  return "Web";
}

async function searchFirecrawl(
  apiKey: string,
  searchQuery: string,
  limit: number,
  signal: AbortSignal,
): Promise<any[]> {
  const response = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: searchQuery,
      limit,
      lang: 'en',
      tbs: 'qdr:w',
      scrapeOptions: { formats: ['markdown'] },
    }),
    signal,
  });

  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}

function parseJobFromResult(
  result: any,
  index: number,
  fallbackLocation: string | undefined,
): JobListing | null {
  const title = result.title || 'Job Position';
  const url = result.url || '';
  const markdown = result.markdown || result.description || '';

  let company = 'Company';
  const urlMatch = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
  if (urlMatch) {
    company = urlMatch[1]
      .replace('.com', '').replace('.io', '').replace('.de', '')
      .replace('.co', '').replace('careers.', '').replace('jobs.', '');
    company = company.charAt(0).toUpperCase() + company.slice(1);
  }

  let salary: string | undefined;
  const salaryMatch =
    markdown.match(/\$[\d,]+\s*[-–]\s*\$[\d,]+(?:\s*(?:\/yr|\/year|annually|per year))?/i) ||
    markdown.match(/€[\d.,]+\s*[-–]\s*€[\d.,]+/i) ||
    markdown.match(/\$[\d,]+(?:\s*(?:\/yr|\/year|annually|per year|k))/i);
  if (salaryMatch) salary = salaryMatch[0];

  let type = 'Full-time';
  const lower = markdown.toLowerCase();
  if (lower.includes('remote')) type = 'Remote';
  else if (lower.includes('hybrid')) type = 'Hybrid';
  else if (lower.includes('part-time') || lower.includes('part time')) type = 'Part-time';
  else if (lower.includes('contract')) type = 'Contract';

  let jobLocation = fallbackLocation || 'Unknown';
  const locationPatterns = [
    /(?:location|based in|located in|office in|standort)[:\s]+([A-Za-zÀ-ÿ\s,]+?)(?:\.|,|$)/i,
    /([A-Za-zÀ-ÿ\s]+,\s*[A-Z]{2})/,
    /([A-Za-zÀ-ÿ\s]+,\s*(?:Germany|Deutschland|France|Netherlands|Ireland|Spain|Italy|Sweden|Poland|Austria))/i,
  ];
  for (const pattern of locationPatterns) {
    const match = markdown.match(pattern);
    if (match) {
      jobLocation = match[1].trim();
      break;
    }
  }

  const cleanTitle = title.replace(/\s+[-|]\s+.*$/, '').trim().substring(0, 100);

  if (
    !cleanTitle ||
    cleanTitle.toLowerCase() === 'job position' ||
    cleanTitle.toLowerCase().includes('sign in') ||
    cleanTitle.toLowerCase().includes('log in')
  ) {
    return null;
  }

  return {
    id: `job-${Date.now()}-${index}`,
    title: cleanTitle,
    company,
    location: jobLocation,
    salary,
    type,
    description: markdown.substring(0, 500),
    url,
    postedAt: new Date().toISOString(),
    source: detectSource(url),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, location, jobType } = await req.json();

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured. Please connect Firecrawl in settings.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchTerms = [];
    if (query) searchTerms.push(query);
    if (location) searchTerms.push(location);
    if (jobType) searchTerms.push(jobType);

    const currentYear = new Date().getFullYear();
    const baseQuery = `${searchTerms.join(' ')} jobs hiring ${currentYear}`;

    console.log('Searching for jobs across platforms:', baseQuery);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      // Fire parallel searches across job boards
      const searchPromises = JOB_BOARD_SEARCHES.map((board) => {
        const fullQuery = board.sites ? `${baseQuery} ${board.sites}` : baseQuery;
        return searchFirecrawl(apiKey, fullQuery, board.limit, controller.signal)
          .catch((err) => {
            if (err.name === 'AbortError') throw err;
            console.error(`Search failed for ${board.label}:`, err.message);
            return [] as any[];
          });
      });

      const searchResults = await Promise.all(searchPromises);

      // Flatten and deduplicate by URL
      const seenUrls = new Set<string>();
      const allResults: any[] = [];
      for (const results of searchResults) {
        for (const r of results) {
          const url = (r.url || '').toLowerCase();
          if (url && seenUrls.has(url)) continue;
          if (url) seenUrls.add(url);
          allResults.push(r);
        }
      }

      console.log(`Aggregated ${allResults.length} unique results from ${JOB_BOARD_SEARCHES.length} searches`);

      let idCounter = 0;
      const jobs: JobListing[] = allResults
        .map((result) => parseJobFromResult(result, idCounter++, location))
        .filter((j): j is JobListing => j !== null);

      console.log('Parsed', jobs.length, 'valid job listings');

      const sources = [...new Set(jobs.map((j) => j.source))];

      return new Response(
        JSON.stringify({
          success: true,
          jobs,
          query: baseQuery,
          total: jobs.length,
          sources,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return new Response(
          JSON.stringify({ success: false, error: 'Job search timed out. Please try again.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching jobs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch jobs';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
