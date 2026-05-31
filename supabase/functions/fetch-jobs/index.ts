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

// Per-board limits: General gets the largest share for broad coverage, while
// targeted board searches get a smaller slice. Site operators are parenthesized
// so the search engine treats the OR group correctly.
const JOB_BOARD_SEARCHES = [
  { label: "General", sites: null, limit: 8 },
  { label: "LinkedIn + Indeed", sites: "(site:linkedin.com/jobs OR site:indeed.com)", limit: 6 },
  { label: "EU Boards", sites: "(site:stepstone.de OR site:heyjobs.co OR site:xing.com)", limit: 6 },
];

const FIRECRAWL_SCRAPE_TIMEOUT_MS = 40_000;
const FUNCTION_TIMEOUT_MS = 45_000;

function detectSource(url: string): string {
  const host = url.toLowerCase();
  if (host.includes("linkedin.com")) return "LinkedIn";
  if (host.includes("indeed.com")) return "Indeed";
  if (host.includes("stepstone")) return "StepStone";
  if (host.includes("heyjobs")) return "HeyJobs";
  if (host.includes("xing.com")) return "Xing";
  if (host.includes("glassdoor")) return "Glassdoor";
  return "Web";
}

// Normalize a URL for deduplication: drop query string, hash, trailing slash,
// and lowercase. Tracking params (?refId, ?trk, utm_*) otherwise defeat dedup.
function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.search = '';
    u.hash = '';
    let s = u.toString().toLowerCase();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return raw.toLowerCase().split('?')[0].split('#')[0].replace(/\/+$/, '');
  }
}

async function searchFirecrawl(
  apiKey: string,
  searchQuery: string,
  limit: number,
  signal: AbortSignal,
): Promise<any[]> {
  const response = await fetch('https://api.firecrawl.dev/v2/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: searchQuery,
      limit,
      sources: [{ type: 'web' }],
      tbs: 'qdr:m',
      timeout: FIRECRAWL_SCRAPE_TIMEOUT_MS,
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true,
      },
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

  // v2 nests web results under data.web; v1 returned a flat data array.
  // Accept either shape for resilience.
  if (Array.isArray(data?.data?.web)) return data.data.web;
  if (Array.isArray(data?.web)) return data.web;
  if (Array.isArray(data?.data)) return data.data;
  return [];
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

// Aggregator result titles encode the employer, e.g.
//   "Acme Corp hiring Senior Engineer in Berlin | LinkedIn"
//   "Senior Engineer - Acme Corp - Berlin, BE"
//   "Senior Engineer at Acme Corp"
function extractCompanyFromTitle(title: string): string | null {
  const valid = (c: string) => {
    const t = c.trim();
    return t.length >= 2 && t.length <= 80 && !/^job position$/i.test(t) ? t : null;
  };

  const hiring = title.match(/^(.+?)\s+hiring\b/i);
  if (hiring) {
    const c = valid(hiring[1]);
    if (c) return c;
  }

  const at = title.match(/\bat\s+([^|\-–·]+?)(?:\s+in\b|[|\-–·]|$)/i);
  if (at) {
    const c = valid(at[1]);
    if (c) return c;
  }

  // "Title - Company - City" / "Title | Company | Board" → 2nd segment is usually the company
  const segs = title.split(/\s[-–|·]\s/).map((s) => s.trim()).filter(Boolean);
  if (segs.length >= 2) {
    const c = valid(segs[1]);
    if (c) return c;
  }

  return null;
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

// Strip markdown noise (images, link syntax, heading/formatting markers) and
// collapse whitespace so the stored description is human-readable.
function cleanDescription(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')      // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // links → link text
    .replace(/^[#>\s*-]+/gm, '')               // leading md markers
    .replace(/[`*_]+/g, '')                    // inline formatting
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 500);
}

// Extract a "City, ST" or "City, Country" location from a title suffix.
function extractLocationFromTitle(title: string): string | null {
  const m = title.match(/\bin\s+([A-Za-zÀ-ÿ .'-]{2,40}(?:,\s*[A-Za-zÀ-ÿ .'-]{2,40})?)(?:\s*[|\-–·]|$)/i);
  if (m) {
    const loc = m[1].trim();
    if (loc.length >= 2 && loc.length <= 60) return loc;
  }
  return null;
}

function parseJobFromResult(
  result: any,
  index: number,
  fallbackLocation: string | undefined,
  batchTs: number,
): JobListing | null {
  const title = typeof result.title === 'string' ? result.title : 'Job Position';
  const url = typeof result.url === 'string' ? result.url : '';
  const markdown =
    (typeof result.markdown === 'string' && result.markdown) ||
    (typeof result.description === 'string' && result.description) ||
    '';

  if (!url) return null;

  let company = 'Company';
  const urlMatch = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
  if (urlMatch) {
    const hostname = urlMatch[1];
    if (isAggregatorHost(hostname)) {
      // For aggregators the title is the most reliable company source.
      company = extractCompanyFromTitle(title) || extractCompanyFromContent(markdown) || 'Company';
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

  // Location: bounded, single-line patterns to avoid greedy multiline capture.
  let jobLocation = fallbackLocation || '';
  const locationPatterns = [
    /(?:location|based in|located in|office in|standort)[:\s]+([A-Za-zÀ-ÿ .'-]{2,40}(?:,\s*[A-Za-zÀ-ÿ .'-]{2,40})?)/i,
    /\b([A-Za-zÀ-ÿ .'-]{2,40},\s*[A-Z]{2})\b/,
    /\b([A-Za-zÀ-ÿ .'-]{2,40},\s*(?:Germany|Deutschland|France|Netherlands|Ireland|Spain|Italy|Sweden|Poland|Austria))\b/i,
  ];
  for (const pattern of locationPatterns) {
    const match = markdown.match(pattern);
    if (match) {
      jobLocation = match[1].trim();
      break;
    }
  }
  if (!jobLocation) jobLocation = extractLocationFromTitle(title) || fallbackLocation || 'Unknown';
  if (jobLocation.length > 60) jobLocation = jobLocation.substring(0, 60).trim();

  const cleanTitle = title.replace(/\s+[-|–·]\s+.*$/, '').trim().substring(0, 100);

  if (
    !cleanTitle ||
    cleanTitle.toLowerCase() === 'job position' ||
    cleanTitle.toLowerCase().includes('sign in') ||
    cleanTitle.toLowerCase().includes('log in') ||
    cleanTitle.toLowerCase().includes('page not found')
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
    description: cleanDescription(markdown),
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
    const body = await req.json().catch(() => ({}));
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const location = typeof body?.location === 'string' ? body.location.trim() : '';
    const jobType = typeof body?.jobType === 'string' ? body.jobType.trim() : '';

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured. Please connect Firecrawl in settings.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentYear = new Date().getFullYear();
    const terms = [query || 'software developer', location, jobType].filter(Boolean);
    const baseQuery = `${terms.join(' ')} jobs hiring ${currentYear}`.replace(/\s+/g, ' ').trim();

    console.log('Searching for jobs across platforms:', baseQuery);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FUNCTION_TIMEOUT_MS);

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

      // Flatten and deduplicate by normalized URL (URL-less results are skipped)
      const seenUrls = new Set<string>();
      const allResults: any[] = [];
      for (const results of searchResults) {
        for (const r of results) {
          const rawUrl = typeof r?.url === 'string' ? r.url : '';
          if (!rawUrl) continue;
          const key = normalizeUrl(rawUrl);
          if (!key || seenUrls.has(key)) continue;
          seenUrls.add(key);
          allResults.push(r);
        }
      }

      console.log(`Aggregated ${allResults.length} unique results from ${JOB_BOARD_SEARCHES.length} searches (${searchErrors.length} failed)`);

      let idCounter = 0;
      const batchTs = Date.now();
      const jobs: JobListing[] = allResults
        .map((result) => parseJobFromResult(result, idCounter++, location || undefined, batchTs))
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
