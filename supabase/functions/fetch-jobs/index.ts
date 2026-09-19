import {
  type JobListing,
  dedupeJobs,
  hasAdzunaCredentials,
  hasJoobleCredentials,
  normalizeUrl,
  searchStructuredJobApis,
} from "../_shared/job-apis.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Per-board limits: General gets the largest share for broad coverage, while
// targeted board searches get a smaller slice. Site operators are parenthesized
// so the search engine treats the OR group correctly.
const JOB_BOARD_SEARCHES = [
  { label: "General", sites: null as string | null, limit: 8 },
  {
    label: "LinkedIn + Indeed",
    sites: "(site:linkedin.com/jobs OR site:indeed.com)",
    limit: 6,
  },
  {
    label: "EU Boards",
    sites: "(site:stepstone.de OR site:heyjobs.co OR site:xing.com)",
    limit: 6,
  },
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
  if (host.includes("adzuna")) return "Adzuna";
  if (host.includes("jooble")) return "Jooble";
  return "Web";
}

interface FirecrawlSearchHit {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
}

interface FirecrawlSearchResponse {
  data?: {
    web?: FirecrawlSearchHit[];
  } | FirecrawlSearchHit[];
  web?: FirecrawlSearchHit[];
}

async function searchFirecrawl(
  apiKey: string,
  searchQuery: string,
  limit: number,
  signal: AbortSignal,
): Promise<FirecrawlSearchHit[]> {
  const response = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: searchQuery,
      limit,
      sources: [{ type: "web" }],
      tbs: "qdr:m",
      timeout: FIRECRAWL_SCRAPE_TIMEOUT_MS,
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true,
      },
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Firecrawl ${response.status}: ${body.substring(0, 200) || response.statusText}`,
    );
  }

  const raw = await response.text();
  let data: FirecrawlSearchResponse;
  try {
    data = JSON.parse(raw) as FirecrawlSearchResponse;
  } catch {
    throw new Error(
      `Firecrawl ${response.status}: malformed JSON – ${raw.substring(0, 200)}`,
    );
  }

  if (Array.isArray(data?.data?.web)) return data.data.web;
  if (Array.isArray(data?.web)) return data.web;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

const AGGREGATOR_HOSTS = new Set([
  "linkedin.com", "indeed.com", "glassdoor.com", "glassdoor.de",
  "stepstone.de", "stepstone.com", "heyjobs.co", "xing.com",
  "monster.com", "ziprecruiter.com", "dice.com", "reed.co.uk",
  "seek.com.au", "totaljobs.com", "cwjobs.co.uk",
  "adzuna.co.uk", "adzuna.de", "adzuna.fr", "jooble.org",
]);

function isAggregatorHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  for (const agg of AGGREGATOR_HOSTS) {
    if (h === agg || h.endsWith(`.${agg}`)) return true;
  }
  return false;
}

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

  const segs = title.split(/\s[-–|·]\s/).map((s) => s.trim()).filter(Boolean);
  if (segs.length >= 2) {
    const c = valid(segs[1]);
    if (c) return c;
  }

  return null;
}

function extractCompanyFromContent(markdown: string): string | null {
  const kwMatch = markdown.match(
    /(?:company|employer|organization)\b[:\s]+["']?([A-Za-zÀ-ÿ0-9&\s.,'-]+?)["']?(?=\s+(?:is|are|hiring|seeking|looking)\b|\s*[|\-–·,;]|\n|$)/i,
  );
  if (kwMatch) {
    const name = kwMatch[1].trim();
    if (name.length >= 2 && name.length <= 80) return name;
  }
  return null;
}

function tryParsePostedDate(markdown: string): string | undefined {
  const patterns = [
    /(?:posted|published|date)[:\s]+(\d{4}-\d{2}-\d{2})/i,
    /(?:posted|published)[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
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
      if (unit.startsWith("hour")) now.setHours(now.getHours() - n);
      else if (unit.startsWith("day")) now.setDate(now.getDate() - n);
      else if (unit.startsWith("week")) now.setDate(now.getDate() - n * 7);
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
  "co.uk", "co.in", "co.jp", "co.kr", "co.nz", "co.za", "co.id",
  "com.au", "com.br", "com.cn", "com.mx", "com.sg", "com.hk",
  "org.uk", "net.au", "ac.uk",
]);

function extractSLD(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/^(www|careers|jobs)\./, "").split(".");
  const skipPrefixes = ["careers", "jobs", "career", "job", "apply", "hire"];
  while (labels.length > 1 && skipPrefixes.includes(labels[0])) labels.shift();

  if (labels.length < 2) {
    const name = labels[0] || "Company";
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  const lastTwo = labels.slice(-2).join(".");
  const sld = CCTLDS.has(lastTwo) && labels.length >= 3
    ? labels[labels.length - 3]
    : labels[labels.length - 2];
  return sld.charAt(0).toUpperCase() + sld.slice(1);
}

function cleanDescription(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[#>\s*-]+/gm, "")
    .replace(/[`*_]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 500);
}

function extractLocationFromTitle(title: string): string | null {
  const m = title.match(
    /\bin\s+([A-Za-zÀ-ÿ .'-]{2,40}(?:,\s*[A-Za-zÀ-ÿ .'-]{2,40})?)(?:\s*[|\-–·]|$)/i,
  );
  if (m) {
    const loc = m[1].trim();
    if (loc.length >= 2 && loc.length <= 60) return loc;
  }
  return null;
}

function parseJobFromResult(
  result: FirecrawlSearchHit,
  index: number,
  fallbackLocation: string | undefined,
  batchTs: number,
): JobListing | null {
  const title = typeof result.title === "string" ? result.title : "Job Position";
  const url = typeof result.url === "string" ? result.url : "";
  const markdown =
    (typeof result.markdown === "string" && result.markdown) ||
    (typeof result.description === "string" && result.description) ||
    "";

  if (!url) return null;

  let company = "Company";
  const urlMatch = url.match(/https?:\/\/(?:www\.)?([^/]+)/);
  if (urlMatch) {
    const hostname = urlMatch[1];
    if (isAggregatorHost(hostname)) {
      company =
        extractCompanyFromTitle(title) ||
        extractCompanyFromContent(markdown) ||
        "Company";
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

  let type: string | undefined;
  const lower = markdown.toLowerCase();
  if (/\bremote\b/.test(lower)) type = "Remote";
  else if (/\bhybrid\b/.test(lower)) type = "Hybrid";
  else if (/\bpart[-\s]?time\b/.test(lower)) type = "Part-time";
  else if (/\bcontract\b/.test(lower)) type = "Contract";
  else if (/\bfull[-\s]?time\b/.test(lower)) type = "Full-time";

  let jobLocation = fallbackLocation || "";
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
  if (!jobLocation) {
    jobLocation = extractLocationFromTitle(title) || fallbackLocation || "Unknown";
  }
  if (jobLocation.length > 60) jobLocation = jobLocation.substring(0, 60).trim();

  const cleanTitle = title.replace(/\s+[-|–·]\s+.*$/, "").trim().substring(0, 100);
  if (
    !cleanTitle ||
    cleanTitle.toLowerCase() === "job position" ||
    cleanTitle.toLowerCase().includes("sign in") ||
    cleanTitle.toLowerCase().includes("log in") ||
    cleanTitle.toLowerCase().includes("page not found")
  ) {
    return null;
  }

  const postedAt = tryParsePostedDate(markdown);
  const job: JobListing = {
    id: `job-${batchTs}-${index}`,
    title: cleanTitle,
    company,
    location: jobLocation,
    description: cleanDescription(markdown),
    url,
    source: detectSource(url),
  };
  if (salary) job.salary = salary;
  if (type) job.type = type;
  if (postedAt) job.postedAt = postedAt;
  return job;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const location = typeof body?.location === "string" ? body.location.trim() : "";
    const jobType = typeof body?.jobType === "string" ? body.jobType.trim() : "";

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const hasStructured = hasAdzunaCredentials() || hasJoobleCredentials();

    if (!firecrawlKey && !hasStructured) {
      console.error("No job providers configured");
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "No job search providers configured. Set ADZUNA_APP_ID + ADZUNA_APP_KEY and/or JOOBLE_API_KEY and/or FIRECRAWL_API_KEY.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const currentYear = new Date().getFullYear();
    const terms = [query || "software developer", location, jobType].filter(Boolean);
    const baseQuery = `${terms.join(" ")} jobs hiring ${currentYear}`.replace(/\s+/g, " ").trim();
    const structuredQuery = query || "software developer";

    console.log("Searching for jobs:", {
      query: baseQuery,
      adzuna: hasAdzunaCredentials(),
      jooble: hasJoobleCredentials(),
      firecrawl: !!firecrawlKey,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FUNCTION_TIMEOUT_MS);

    try {
      const searchErrors: string[] = [];
      let structuredJobs: JobListing[] = [];
      let scrapedJobs: JobListing[] = [];
      const parallel: Promise<void>[] = [];

      if (hasStructured) {
        parallel.push((async () => {
          const result = await searchStructuredJobApis({
            query: structuredQuery,
            location: location || undefined,
            jobType: jobType || undefined,
            limit: 20,
            signal: controller.signal,
          });
          structuredJobs = result.jobs;
          searchErrors.push(...result.errors);
          console.log(
            `Structured APIs (${result.providersTried.join(", ") || "none"}): ${structuredJobs.length} jobs`,
          );
        })());
      }

      if (firecrawlKey) {
        parallel.push((async () => {
          const settled = await Promise.allSettled(
            JOB_BOARD_SEARCHES.map((board) => {
              const fullQuery = board.sites ? `${baseQuery} ${board.sites}` : baseQuery;
              return searchFirecrawl(firecrawlKey, fullQuery, board.limit, controller.signal);
            }),
          );

          const searchResults: FirecrawlSearchHit[][] = [];
          for (let i = 0; i < settled.length; i++) {
            const entry = settled[i];
            const label = JOB_BOARD_SEARCHES[i].label;
            if (entry.status === "fulfilled") {
              searchResults.push(entry.value);
            } else {
              if (entry.reason?.name === "AbortError") throw entry.reason;
              console.error(`Search failed for ${label}:`, entry.reason?.message);
              searchErrors.push(`${label}: ${entry.reason?.message || "unknown error"}`);
              searchResults.push([]);
            }
          }

          const seenUrls = new Set<string>();
          const allResults: FirecrawlSearchHit[] = [];
          for (const results of searchResults) {
            for (const r of results) {
              const rawUrl = typeof r?.url === "string" ? r.url : "";
              if (!rawUrl) continue;
              const key = normalizeUrl(rawUrl);
              if (!key || seenUrls.has(key)) continue;
              seenUrls.add(key);
              allResults.push(r);
            }
          }

          let idCounter = 0;
          const batchTs = Date.now();
          scrapedJobs = allResults
            .map((result) =>
              parseJobFromResult(result, idCounter++, location || undefined, batchTs),
            )
            .filter((j): j is JobListing => j !== null);
        })());
      }

      await Promise.all(parallel);

      const jobs = dedupeJobs([...structuredJobs, ...scrapedJobs]);

      if (jobs.length === 0 && searchErrors.length > 0) {
        const firstError = searchErrors[0];
        const is429 = firstError.includes("429");
        return new Response(
          JSON.stringify({
            success: false,
            error: is429
              ? "Job search rate limit exceeded. Please try again in a moment."
              : `All job providers failed. ${firstError}`,
          }),
          {
            status: is429 ? 429 : 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      console.log(
        `Parsed ${jobs.length} jobs (structured=${structuredJobs.length}, scraped=${scrapedJobs.length}, errors=${searchErrors.length})`,
      );

      const sources = [
        ...new Set(jobs.map((j) => j.source).filter((s): s is string => !!s)),
      ];

      return new Response(
        JSON.stringify({
          success: true,
          jobs,
          query: baseQuery,
          total: jobs.length,
          sources,
          warnings: searchErrors.length > 0
            ? `${searchErrors.length} provider search(es) failed`
            : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Job search timed out. Please try again.",
          }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("Error fetching jobs:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch jobs";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
