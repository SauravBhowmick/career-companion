# JobFlow — Architecture

> Living doc. Update when stack, folders, data flow, or edge functions change.  
> Last reviewed: 2026-09-19

## High-level

```
React SPA (Vite)
    │  supabase-js invoke / DB / Auth / Storage / Realtime
    ▼
Supabase
  ├── Auth (JWT)
  ├── Postgres + RLS
  ├── Storage (resumes)
  ├── Realtime (notifications)
  └── Edge Functions (Deno)
        ├── fetch-jobs               → Adzuna, Jooble, Firecrawl
        ├── match-jobs               → Lovable AI (Gemini)
        ├── parse-cv                 → Storage + Lovable AI
        ├── send-application-email   → Resend + notifications
        ├── send-job-alert           → Resend
        ├── daily-job-digest         → jobs APIs + Resend (cron)
        └── unsubscribe              → HMAC token, verify_jwt=false
```

## Tech stack

| Layer | Choice |
|-------|--------|
| UI | React 18, TypeScript, Vite 5, Tailwind, shadcn/Radix, Framer Motion |
| Data client | TanStack Query, Supabase JS |
| Backend | Supabase Auth, Postgres RLS, Storage, Realtime, Edge Functions |
| AI | Lovable AI Gateway → `google/gemini-3-flash-preview` (or current flash model) |
| Email | Resend |
| Jobs | Adzuna + Jooble (structured); Firecrawl `/v2/search` fallback |

## Folder map

```
src/
  pages/           Index, Applications, Unsubscribe, NotFound
  components/      Header, Hero, JobCard, filters, modals, notifications, ui/
  hooks/           useRealJobs, useJobMatcher, useCVParser, useAuth, …
  integrations/supabase/
  types/
  data/            mockJobs (default until live fetch)
supabase/
  functions/       edge functions + _shared/
  migrations/
# Living AI docs at repo root (not a subdirectory):
#   PRD.md, Architecture.md, Rules.md, Phases.md,
#   Design.md, Memory.md, Agents.md
```

Project guidance files at **repo root**:

- `PRD.md`, `Architecture.md`, `Rules.md`, `Phases.md`, `Design.md`, `Memory.md`, `Agents.md`

## Primary flows

### 1. Search jobs

1. User clicks **Fetch Real Jobs** (or equivalent) on `Index`
2. `useRealJobs` → `supabase.functions.invoke('fetch-jobs', { query, location, jobType })`
3. `fetch-jobs` runs structured APIs (if secrets set) **in parallel** with Firecrawl board searches
4. Results normalized to `JobListing`, URL-deduped, returned as `{ success, jobs, sources, warnings? }`
5. Client caches ~5 minutes; may show mock jobs until first successful fetch

### 2. Match

1. Logged-in user with jobs loaded → `useJobMatcher` → `match-jobs`
2. Function loads profile + `user_skills`, scores each job via AI
3. UI shows `matchScore` / reason on cards

### 3. Apply

1. `ApplyModal` → insert `job_applications`
2. Best-effort `send-application-email` (failure should not wipe the application)
3. Notification row → Realtime → bell

### 4. Digest / unsubscribe

1. Cron invokes `daily-job-digest` with `CRON_SECRET`
2. Emails include unsubscribe URLs signed with `UNSUBSCRIBE_SECRET`
3. `Unsubscribe` page → `unsubscribe` function sets email notifications off

## Shared modules

| Path | Role |
|------|------|
| `supabase/functions/_shared/job-apis.ts` | Adzuna + Jooble search, country mapping, dedupe |
| `supabase/functions/_shared/unsubscribe.ts` | HMAC token helpers |

## Database (main tables)

- `profiles` — user profile + CV URL  
- `user_skills` — extracted / stored skills  
- `user_preferences` — thresholds, notification toggles, auto-apply flag  
- `job_applications` — pipeline statuses  
- `saved_jobs` — bookmarks  
- `cv_upload_history` — upload/parse audit  
- `notifications` — in-app feed (Realtime)  
- `rate_limits` — sliding-window RPC  

Storage bucket: **`resumes`** (per-user path policies).

## Auth & security model

- Client uses anon/publishable key; privileged work uses user JWT on edge functions
- Service role only inside edge functions
- RLS on user tables; notifications clients typically limited to marking `read`
- Rate limiting on sensitive email paths
- HTML escape / PII masking in email logs

## External secrets (edge)

`ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ADZUNA_COUNTRIES?`, `JOOBLE_API_KEY`, `JOOBLE_API_BASE?`, `FIRECRAWL_API_KEY`, `LOVABLE_API_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `UNSUBSCRIBE_SECRET`, `UNSUBSCRIBE_SECRET_PREVIOUS?`, `APP_URL`/`SITE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ENABLE_DEV_FALLBACK?`

Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
