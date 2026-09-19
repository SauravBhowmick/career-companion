/**
 * Official / partner job APIs (Adzuna, Jooble).
 * Indeed Publisher / Job Search API was retired for consumers (2023) — not integrated.
 */

export interface JobListing {
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

export interface JobSearchInput {
  query: string;
  location?: string;
  jobType?: string;
  limit?: number;
  signal?: AbortSignal;
}

/** Adzuna country codes available on the self-serve API. */
export const ADZUNA_COUNTRIES = new Set([
  "gb", "us", "de", "fr", "au", "nz", "ca", "in", "pl", "br", "at", "za",
]);

const CITY_TO_COUNTRY: Record<string, string> = {
  berlin: "de", munich: "de", "münchen": "de", hamburg: "de", cologne: "de",
  "köln": "de", frankfurt: "de", stuttgart: "de", "düsseldorf": "de",
  paris: "fr", lyon: "fr", marseille: "fr", toulouse: "fr",
  vienna: "at", wien: "at", graz: "at",
  warsaw: "pl", warszawa: "pl", krakow: "pl", "kraków": "pl",
  london: "gb", manchester: "gb", edinburgh: "gb", bristol: "gb",
};

const COUNTRY_ALIASES: Array<{ re: RegExp; code: string }> = [
  { re: /\b(germany|deutschland|de)\b/i, code: "de" },
  { re: /\b(france|frankreich|fr)\b/i, code: "fr" },
  { re: /\b(austria|österreich|oesterreich|at)\b/i, code: "at" },
  { re: /\b(poland|polska|pl)\b/i, code: "pl" },
  { re: /\b(united kingdom|uk|great britain|england|scotland|wales|gb)\b/i, code: "gb" },
  { re: /\b(united states|usa|us)\b/i, code: "us" },
];

export function resolveAdzunaCountry(location?: string): string | null {
  if (!location?.trim()) return null;
  const loc = location.trim();

  for (const { re, code } of COUNTRY_ALIASES) {
    if (re.test(loc) && ADZUNA_COUNTRIES.has(code)) return code;
  }

  const cityKey = loc.split(",")[0].trim().toLowerCase();
  return CITY_TO_COUNTRY[cityKey] ?? null;
}

export function defaultEuAdzunaCountries(): string[] {
  const raw = Deno.env.get("ADZUNA_COUNTRIES") || "de,fr,gb,at,pl";
  return raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => ADZUNA_COUNTRIES.has(c));
}

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.search = "";
    u.hash = "";
    let s = u.toString().toLowerCase();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return raw.toLowerCase().split("?")[0].split("#")[0].replace(/\/+$/, "");
  }
}

function cleanSnippet(text: string, max = 500): string {
  return text.replace(/\s+/g, " ").trim().substring(0, max);
}

function formatSalaryRange(
  min?: number | null,
  max?: number | null,
  currencyHint?: string,
): string | undefined {
  if (min == null && max == null) return undefined;
  const fmt = (n: number) =>
    n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n));
  const prefix = currencyHint || "€";
  if (min != null && max != null && min !== max) {
    return `${prefix}${fmt(min)}–${prefix}${fmt(max)}`;
  }
  return `${prefix}${fmt(min ?? max!)}+`;
}

function mapContractType(
  contractType?: string | null,
  contractTime?: string | null,
  jobTypeHint?: string,
): string {
  const blob =
    `${contractType || ""} ${contractTime || ""} ${jobTypeHint || ""}`.toLowerCase();
  if (blob.includes("remote")) return "Remote";
  if (blob.includes("hybrid")) return "Hybrid";
  if (blob.includes("part")) return "Part-time";
  if (blob.includes("contract") || blob.includes("temporary")) return "Contract";
  return "Full-time";
}

function currencyForCountry(country: string): string {
  if (country === "gb") return "£";
  if (country === "pl") return "zł";
  if (["us", "ca", "au", "nz", "za"].includes(country)) return "$";
  if (country === "in") return "₹";
  if (country === "br") return "R$";
  return "€";
}

export function hasAdzunaCredentials(): boolean {
  return !!(Deno.env.get("ADZUNA_APP_ID") && Deno.env.get("ADZUNA_APP_KEY"));
}

export function hasJoobleCredentials(): boolean {
  return !!Deno.env.get("JOOBLE_API_KEY");
}

async function searchAdzunaCountry(
  country: string,
  input: JobSearchInput,
  resultsPerPage: number,
): Promise<JobListing[]> {
  const appId = Deno.env.get("ADZUNA_APP_ID");
  const appKey = Deno.env.get("ADZUNA_APP_KEY");
  if (!appId || !appKey) return [];

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(Math.min(Math.max(resultsPerPage, 1), 50)),
    what: input.query || "software developer",
    "content-type": "application/json",
    max_days_old: "30",
    sort_by: "date",
  });

  if (input.location?.trim()) {
    const where = input.location
      .replace(
        /\b(germany|deutschland|france|austria|poland|uk|united kingdom)\b/gi,
        "",
      )
      .replace(/,\s*$/, "")
      .trim();
    if (where) params.set("where", where);
  }

  const jt = (input.jobType || "").toLowerCase();
  if (jt.includes("full")) params.set("full_time", "1");
  if (jt.includes("part")) params.set("part_time", "1");
  if (jt.includes("contract")) params.set("contract", "1");
  if (jt.includes("permanent")) params.set("permanent", "1");

  const url =
    `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`;

  const response = await fetch(url, { signal: input.signal });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Adzuna ${country} ${response.status}: ${
        body.substring(0, 200) || response.statusText
      }`,
    );
  }

  const data = await response.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  const currency = currencyForCountry(country);
  const batchTs = Date.now();

  return results
    .map((r: any, index: number): JobListing | null => {
      const title = typeof r.title === "string" ? r.title.trim() : "";
      const urlOut =
        (typeof r.redirect_url === "string" && r.redirect_url) ||
        (typeof r.url === "string" && r.url) ||
        "";
      if (!title || !urlOut) return null;

      const company =
        (typeof r.company?.display_name === "string" &&
          r.company.display_name.trim()) ||
        "Company";
      const location =
        (typeof r.location?.display_name === "string" &&
          r.location.display_name.trim()) ||
        input.location ||
        country.toUpperCase();

      const salary = formatSalaryRange(
        typeof r.salary_min === "number" ? r.salary_min : null,
        typeof r.salary_max === "number" ? r.salary_max : null,
        currency,
      );
      const description =
        typeof r.description === "string"
          ? cleanSnippet(r.description)
          : undefined;

      const job: JobListing = {
        id: `adzuna-${country}-${batchTs}-${index}`,
        title: title.substring(0, 100),
        company: company.substring(0, 80),
        location: location.substring(0, 60),
        type: mapContractType(r.contract_type, r.contract_time, input.jobType),
        url: urlOut,
        source: "Adzuna",
      };
      if (salary) job.salary = salary;
      if (description) job.description = description;
      if (typeof r.created === "string" && r.created) job.postedAt = r.created;
      return job;
    })
    .filter((j: JobListing | null): j is JobListing => j !== null);
}

export async function searchAdzuna(
  input: JobSearchInput,
): Promise<JobListing[]> {
  if (!hasAdzunaCredentials()) return [];

  const limit = input.limit ?? 12;
  const resolved = resolveAdzunaCountry(input.location);
  const countries = resolved ? [resolved] : defaultEuAdzunaCountries();
  if (countries.length === 0) return [];

  const perCountry = Math.max(3, Math.ceil(limit / countries.length));
  const settled = await Promise.allSettled(
    countries.map((c) => searchAdzunaCountry(c, input, perCountry)),
  );

  const jobs: JobListing[] = [];
  const errors: string[] = [];
  for (let i = 0; i < settled.length; i++) {
    const entry = settled[i];
    if (entry.status === "fulfilled") {
      jobs.push(...entry.value);
    } else {
      if (entry.reason?.name === "AbortError") throw entry.reason;
      errors.push(`${countries[i]}: ${entry.reason?.message || "unknown"}`);
    }
  }

  if (jobs.length === 0 && errors.length > 0) {
    throw new Error(`Adzuna: ${errors[0]}`);
  }
  if (errors.length) {
    console.warn("Adzuna partial failures:", errors.join("; "));
  }

  return jobs.slice(0, limit);
}

/**
 * Jooble REST — one API key per regional domain.
 * JOOBLE_API_KEY required; JOOBLE_API_BASE optional (default https://jooble.org/api/).
 * For EU results, register on e.g. de.jooble.org and set JOOBLE_API_BASE accordingly.
 */
export async function searchJooble(
  input: JobSearchInput,
): Promise<JobListing[]> {
  const apiKey = Deno.env.get("JOOBLE_API_KEY");
  if (!apiKey) return [];

  const base = (Deno.env.get("JOOBLE_API_BASE") || "https://jooble.org/api/")
    .replace(/\/?$/, "/");
  const limit = Math.min(input.limit ?? 12, 50);
  const location = input.location?.trim() || "Europe";

  const response = await fetch(`${base}${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keywords: input.query || "software developer",
      location,
      page: 1,
      ResultOnPage: limit,
      radius: "80",
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Jooble ${response.status}: ${
        body.substring(0, 200) || response.statusText
      }`,
    );
  }

  const data = await response.json();
  const results = Array.isArray(data?.jobs)
    ? data.jobs
    : Array.isArray(data?.elements)
    ? data.elements
    : [];

  const batchTs = Date.now();
  return results
    .map((r: any, index: number): JobListing | null => {
      const title = typeof r.title === "string" ? r.title.trim() : "";
      const urlOut =
        (typeof r.link === "string" && r.link) ||
        (typeof r.url === "string" && r.url) ||
        "";
      if (!title || !urlOut) return null;

      const company =
        (typeof r.company === "string" && r.company.trim()) || "Company";
      const loc =
        (typeof r.location === "string" && r.location.trim()) || location;
      const salary =
        typeof r.salary === "string" && r.salary.trim()
          ? r.salary.trim()
          : undefined;
      const description =
        typeof r.snippet === "string"
          ? cleanSnippet(r.snippet)
          : typeof r.description === "string"
          ? cleanSnippet(r.description)
          : undefined;

      const job: JobListing = {
        id: `jooble-${batchTs}-${index}`,
        title: title.substring(0, 100),
        company: company.substring(0, 80),
        location: loc.substring(0, 60),
        type: mapContractType(r.type, null, input.jobType),
        url: urlOut,
        source: "Jooble",
      };
      if (salary) job.salary = salary;
      if (description) job.description = description;
      if (typeof r.updated === "string" && r.updated) {
        const parsed = new Date(r.updated);
        if (!isNaN(parsed.getTime())) job.postedAt = parsed.toISOString();
      }
      return job;
    })
    .filter((j: JobListing | null): j is JobListing => j !== null);
}

export function dedupeJobs(jobs: JobListing[]): JobListing[] {
  const seen = new Set<string>();
  const out: JobListing[] = [];
  for (const job of jobs) {
    const raw = job.url || "";
    if (!raw) continue;
    const key = normalizeUrl(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(job);
  }
  return out;
}

export interface ProviderSearchResult {
  jobs: JobListing[];
  errors: string[];
  providersTried: string[];
}

/** Run configured structured providers in parallel (Firecrawl is separate). */
export async function searchStructuredJobApis(
  input: JobSearchInput,
): Promise<ProviderSearchResult> {
  const tasks: Array<{ name: string; run: () => Promise<JobListing[]> }> = [];

  if (hasAdzunaCredentials()) {
    tasks.push({ name: "Adzuna", run: () => searchAdzuna(input) });
  }
  if (hasJoobleCredentials()) {
    tasks.push({ name: "Jooble", run: () => searchJooble(input) });
  }

  if (tasks.length === 0) {
    return { jobs: [], errors: [], providersTried: [] };
  }

  const settled = await Promise.allSettled(tasks.map((t) => t.run()));
  const jobs: JobListing[] = [];
  const errors: string[] = [];

  for (let i = 0; i < settled.length; i++) {
    const entry = settled[i];
    if (entry.status === "fulfilled") {
      jobs.push(...entry.value);
    } else {
      if (entry.reason?.name === "AbortError") throw entry.reason;
      errors.push(`${tasks[i].name}: ${entry.reason?.message || "unknown error"}`);
    }
  }

  return {
    jobs: dedupeJobs(jobs),
    errors,
    providersTried: tasks.map((t) => t.name),
  };
}
