# JobFlow — Phases

> Living doc. Mark phase status as work lands.  
> Last reviewed: 2026-09-19

## Phase status legend

- ✅ Done  
- 🔄 In progress / evolving  
- ⬜ Not started  
- ⚠️ Partial / known gaps  

---

## Phase 0 — Foundation ✅

- React + Vite + TypeScript app shell  
- Supabase project wiring (Auth, DB, Storage)  
- shadcn/ui + Tailwind design tokens  
- Basic routing (`Index`, `Applications`, `NotFound`)

## Phase 1 — Auth & profile ✅

- Email/password auth modal  
- Profiles + preferences tables + RLS  
- CV upload to `resumes` bucket  
- `parse-cv` edge function → skills / profile fields  

## Phase 2 — Job discovery ✅ / 🔄

- Mock jobs for empty state  
- `fetch-jobs` with Firecrawl multi-board search  
- Location / job-type filters (EU + US)  
- 🔄 Structured providers: Adzuna + Jooble in `_shared/job-apis.ts`  
- ⚠️ Soft-fail when no providers configured; document secrets  

## Phase 3 — Matching & apply ✅ / ⚠️

- `match-jobs` AI scoring UI  
- Apply modal + `job_applications` pipeline  
- Saved jobs  
- ⚠️ Harden JWT/ownership on all match paths  
- ⚠️ Auto-apply preference is UI-only  

## Phase 4 — Notifications & email ✅

- In-app notifications + Realtime panel  
- `send-application-email`, `send-job-alert`  
- `daily-job-digest` cron  
- Unsubscribe tokens + `/unsubscribe` page  
- Rate limiting on sensitive email paths  

## Phase 5 — Product polish 🔄

- Empty/error/loading states consistency  
- Dark mode product toggle (tokens exist; app defaults light)  
- README + living AI docs (`PRD`, `Architecture`, …)  
- Performance / cache tuning for live fetch  

## Phase 6 — Growth / ops ⬜

- Monitoring & alerting on edge failures  
- Stronger EU coverage (more countries / Jooble regional keys)  
- Optional additional official job APIs (not Indeed consumer search)  
- True assisted auto-apply workflows (explicit user confirmation gates)  

---

## Suggested next slices

1. Deploy secrets for Adzuna (and optional Jooble); verify `fetch-jobs` sources in UI  
2. Audit `match-jobs` auth vs README security claims  
3. Turn dark-mode tokens into a real Settings toggle if desired  
4. Keep `Memory.md` current after each slice  
