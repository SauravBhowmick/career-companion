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

// Per-board limits: General gets the largest share (8) for broad coverage,
// while targeted board searches get 5 each. Total ≈18 raw results before
// dedup; after dedup + filtering, typically 10-15 unique jobs are returned.
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

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Firecrawl ${response.status}: ${body.substring(0, 200) || response.statusText}`
    );
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    const raw = await response.text().catch(() => '');
    throw new Error(
      `Firecrawl ${response.status}: malformed JSON – ${raw.substring(0, 200)}`
    );
  }

  if (typeof data !== 'object' || data === null || !Array.isArray(data.data)) {
    return [];
  }

  return data.data;
}

const AGGREGATOR_HOSTS = new Set([
  'linkedin.com', 'indeed.com', 'glassdoor.com', 'glassdoor.de',
  'stepstone.de', 'stepstone.com', 'heyjobs.co', 'xing.com',
  'monster.com', 'ziprecruiter.com', 'dice.com', 'reed.co.uk',
  'seek.com.au', 'totaljobs.com', 'cwjobs.co.uk',
]);

function isAggregatorHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  for (const agg of AGGREGATOR_HOSTS) {
    if (h === agg || h.endsWith(`.${agg}`)) return true;
  }
  return false;
}

function extractCompanyFromContent(markdown: string): string | null {
  const kwMatch = markdown.match(
    /(?:company|employer|organization)\b[:\s]+["']?([A-Za-zÀ-ÿ0-9&\s.,'-]+?)["']?(?=\s+(?:is|are|hiring|seeking|looking)\b|\s*[|\-–·,;]|\n|$)/i
  );
  if (kwMatch) {
    const name = kwMatch[1].trim();
    if (name.length >= 2 && name.length <= 80) return name;
  }

  const atMatch = markdown.match(
    /(?:^|\n)\s*(?:at|@)\s+([A-Z][A-Za-zÀ-ÿ0-9&.,'-]+(?:\s+[A-Z][A-Za-zÀ-ÿ0-9&.,'-]*)*)(?=\s+(?:is|are|hiring|seeking|looking|we)\b|\s*[|\-–·,;]|\n|$)/m
  );
  if (atMatch) {
    const name = atMatch[1].trim();
    if (name.length >= 2 && name.length <= 80) return name;
  }

  return null;
}

function tryParsePostedDate(markdown: string): string | undefined {
  const patterns = [
    /(?:posted|published|date)[:\s]+(\d{4}-\d{2}-\d{2})/i,
    /(?:posted|published)[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
    /(?:posted|published)[:\s]+(\d{1,2}\s+\w+\s+\d{4})/i,
    /(\d{1,2})\s+(hours?|days?|weeks?)\s+ago/i,
  ];

  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (!match) continue;

    const relativeMatch = match[0].match(/(\d{1,2})\s+(hours?|days?|weeks?)\s+ago/i);
    if (relativeMatch) {
      const n = parseInt(relativeMatch[1], 10);
      const unit = relativeMatch[2].toLowerCase();
      const now = new Date();
      if (unit.startsWith('hour')) now.setHours(now.getHours() - n);
      else if (unit.startsWith('day')) now.setDate(now.getDate() - n);
      else if (unit.startsWith('week')) now.setDate(now.getDate() - n * 7);
      return now.toISOString();
    }

    const parsed = new Date(match[1]);
    const ts = parsed.getTime();
    if (!isNaN(ts) && ts <= Date.now() && ts > Date.now() - 365 * 24 * 60 * 60 * 1000) {
      return parsed.toISOString();
    }
  }

  return undefined;
}

const CCTLDS = new Set([
  'co.uk', 'co.in', 'co.jp', 'co.kr', 'co.nz', 'co.za', 'co.id',
  'com.au', 'com.br', 'com.cn', 'com.mx', 'com.sg', 'com.hk',
  'org.uk', 'net.au', 'ac.uk',
]);

function extractSLD(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/^(www|careers|jobs)\./, '').split('.');
  const skipPrefixes = ['careers', 'jobs', 'career', 'job', 'apply', 'hire'];
  while (labels.length > 1 && skipPrefixes.includes(labels[0])) {
    labels.shift();
  }

  if (labels.length < 2) {
    const name = labels[0] || 'Company';
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  const lastTwo = labels.slice(-2).join('.');
  const sld = CCTLDS.has(lastTwo) && labels.length >= 3
    ? labels[labels.length - 3]
    : labels[labels.length - 2];

  return sld.charAt(0).toUpperCase() + sld.slice(1);
}

function parseJobFromResult(
  result: any,
  index: number,
  fallbackLocation: string | undefined,
  batchTs: number,
): JobListing | null {
  const title = result.title || 'Job Position';
  const url = result.url || '';
  const markdown = result.markdown || result.description || '';

  if (!url) return null;

  let company = 'Company';
  const urlMatch = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
  if (urlMatch) {
    const hostname = urlMatch[1];
    if (isAggregatorHost(hostname)) {
      company = extractCompanyFromContent(markdown) || 'Company';
    } else {
      company = extractSLD(hostname);
    }
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

  const postedAt = tryParsePostedDate(markdown);

  const job: JobListing = {
    id: `job-${batchTs}-${index}`,
    title: cleanTitle,
    company,
    location: jobLocation,
    salary,
    type,
    description: markdown.substring(0, 500),
    url,
    source: detectSource(url),
  };

  if (postedAt) job.postedAt = postedAt;

  return job;
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
      const settled = await Promise.allSettled(
        JOB_BOARD_SEARCHES.map((board) => {
          const fullQuery = board.sites ? `${baseQuery} ${board.sites}` : baseQuery;
          return searchFirecrawl(apiKey, fullQuery, board.limit, controller.signal);
        })
      );

      // Separate successes from failures; propagate AbortError immediately
      const searchErrors: string[] = [];
      const searchResults: any[][] = [];

      for (let i = 0; i < settled.length; i++) {
        const entry = settled[i];
        const label = JOB_BOARD_SEARCHES[i].label;
        if (entry.status === 'fulfilled') {
          searchResults.push(entry.value);
        } else {
          if (entry.reason?.name === 'AbortError') throw entry.reason;
          console.error(`Search failed for ${label}:`, entry.reason?.message);
          searchErrors.push(`${label}: ${entry.reason?.message || 'unknown error'}`);
          searchResults.push([]);
        }
      }

      // If every search failed, surface the error to the client
      if (searchErrors.length === JOB_BOARD_SEARCHES.length) {
        const firstError = searchErrors[0];
        const is429 = firstError.includes('429');
        return new Response(
          JSON.stringify({
            success: false,
            error: is429
              ? 'Job search rate limit exceeded. Please try again in a moment.'
              : `All job board searches failed. ${firstError}`,
          }),
          {
            status: is429 ? 429 : 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Flatten and deduplicate by URL (URL-less results are skipped)
      const seenUrls = new Set<string>();
      const allResults: any[] = [];
      for (const results of searchResults) {
        for (const r of results) {
          const url = (r.url || '').toLowerCase();
          if (!url) continue;
          if (seenUrls.has(url)) continue;
          seenUrls.add(url);
          allResults.push(r);
        }
      }

      console.log(`Aggregated ${allResults.length} unique results from ${JOB_BOARD_SEARCHES.length} searches (${searchErrors.length} failed)`);

      let idCounter = 0;
      const batchTs = Date.now();
      const jobs: JobListing[] = allResults
        .map((result) => parseJobFromResult(result, idCounter++, location, batchTs))
        .filter((j): j is JobListing => j !== null);

      console.log('Parsed', jobs.length, 'valid job listings');

      const sources = [...new Set(jobs.map((j) => j.source).filter((s): s is string => !!s))];

      return new Response(
        JSON.stringify({
          success: true,
          jobs,
          query: baseQuery,
          total: jobs.length,
          sources,
          warnings: searchErrors.length > 0
            ? `${searchErrors.length} of ${JOB_BOARD_SEARCHES.length} searches failed`
            : undefined,
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
