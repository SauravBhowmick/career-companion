# JobFlow — Product Requirements Document (PRD)

> Living doc. Update when product scope, users, or features change.  
> Last reviewed: 2026-09-19

## Vision

**JobFlow** helps job seekers find relevant roles, understand fit via AI match scores, apply with less friction, and stay notified — without manually hunting across boards.

Repo name: `career-companion`. Product brand in UI: **JobFlow**.

## Target users

- Job seekers (primary focus: **EU + US**) looking for tech / professional roles
- People who already have a CV and want **match scoring**, **application tracking**, and **email + in-app alerts**
- Not: employers posting jobs, ATS/recruiting agencies (out of scope)

## Problem

Job boards are fragmented (LinkedIn, Indeed, StepStone, HeyJobs, Xing, aggregators). Matching is noisy; applying and following up is manual; digests and alerts are either missing or hard to unsubscribe from.

## Goals

1. Search live jobs from structured APIs + board search fallback
2. Score jobs against the user’s CV / skills / preferences
3. Track applications in a simple pipeline
4. Notify via email and in-app Realtime notifications
5. Respect privacy, auth, RLS, and one-click email unsubscribe

## Non-goals (for now)

- Fully autonomous apply bots that submit to employer ATS without user confirmation
- Indeed Publisher / Job Search API (retired for consumers — do not integrate)
- Native mobile apps
- Employer-facing posting dashboard

## Core features

| Feature | Description | Status |
|---------|-------------|--------|
| Auth | Email/password signup & login (Supabase Auth) | Built |
| Profile + CV | Profile fields; PDF upload to Storage; AI parse → skills/profile | Built |
| Live job search | Adzuna + Jooble (structured) + Firecrawl multi-board fallback | Built / evolving |
| Location filters | US / EU (incl. Germany-focused) city/country filters | Built |
| AI match scores | Gemini via Lovable AI Gateway against profile + skills | Built |
| Apply flow | Apply modal → `job_applications` + confirmation email | Built |
| Applications pipeline | applied → viewed → interview → offer → rejected | Built |
| Saved jobs | Bookmark by external job id | Built |
| Settings | Match threshold, email/instant toggles, auto-apply preference | Built |
| Notifications | In-app bell + Realtime | Built |
| Job alerts | Instant alert email | Built |
| Daily digest | Cron digest email | Built |
| Unsubscribe | Token page `/unsubscribe` + edge function | Built |
| Auto-apply preference | UI flag only — not a full autonomous worker | Partial |

## Success metrics (product)

- Users can fetch real jobs with at least one provider configured
- Matched jobs show score + short reason when logged in
- Apply creates a DB row even if email fails (email is best-effort)
- Digest/alert emails include working unsubscribe links
- No cross-user data leakage (RLS + JWT checks)

## Constraints

- Edge runtime: Deno (Supabase Edge Functions)
- Frontend: React + Vite SPA
- Secrets live in Supabase; never commit keys
- Prefer official/partner APIs over scraping when available
