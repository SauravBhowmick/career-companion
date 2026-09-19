# JobFlow — Memory

> Session handoff log for AI agents. **Update this after every non-trivial change.**  
> Do not replace history wholesale — append dated entries; prune only when stale.

## Current snapshot (2026-09-19)

- Product: **JobFlow** (repo `career-companion`) — React/Vite + Supabase Edge  
- Live jobs: **Adzuna + Jooble** (`_shared/job-apis.ts`) + **Firecrawl** fallback in `fetch-jobs` / digest  
- Indeed consumer Publisher API: **out of scope** (retired)  
- Email: Resend; unsubscribe HMAC + `/unsubscribe`  
- AI docs added at repo root: `PRD.md`, `Architecture.md`, `Rules.md`, `Phases.md`, `Design.md`, `Memory.md`, `Agents.md`  
- Cursor rule: `.cursor/rules/keep-project-docs-updated.mdc` (always apply)

## Active branch / WIP notes

- Structured job API work lives under edge `_shared/job-apis.ts` and is wired into `fetch-jobs` and `daily-job-digest`  
- Function folder names in this repo: `fetch-jobs`, `match-jobs`, `parse-cv`, `send-application-email`, `send-job-alert`, `daily-job-digest`, `unsubscribe`  
- Provider secrets: `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`, optional `JOOBLE_API_KEY` / `JOOBLE_API_BASE`, optional `FIRECRAWL_API_KEY`

## Known gaps

1. Auto-apply is a preference flag — not a full autonomous apply worker  
2. `match-jobs` auth/ownership should stay aligned with JWT-verified patterns used elsewhere  
3. Dark mode tokens exist; no first-class user toggle yet  
4. Jooble needs regional API keys/base URL for good EU coverage  
5. Production must set `APP_URL`/`SITE_URL` + `UNSUBSCRIBE_SECRET` (no silent localhost in prod)

## Decision log

| Date | Decision | Why |
|------|----------|-----|
| 2026-09 | Prefer Adzuna/Jooble over scrape-first | Structured EU results; Firecrawl for board gaps |
| 2026-09 | Skip Indeed Publisher API | Retired for consumers |
| 2026-09 | Skip Agent-Reach in edge | Local agent CLI, not serverless multi-tenant scrape |
| 2026-09 | Application row before email | Email outages must not block apply |
| 2026-09 | Add living AI docs + Agents.md | Multi-chat continuity; fewer hallucinations |

## Change log

### 2026-09-19 (review fixes)

- Architecture folder map: living docs listed at repo root (no fake `docs-of-record/` dir)  
- `job-apis`: salary “up to max” when only max; URL dedupe strips tracking params only (preserves path case + job-id query); Jooble base must be `https://…/api/`; contract type from provider metadata only (no Full-time default / no `jobType` hint); provider `any` → minimal interfaces  
- `fetch-jobs` / digest: Firecrawl hits typed; digest structured vs Firecrawl use separate abort timeouts  
- Client: optional `Job.type`; no `Full-time` fallback in `useRealJobs`

### 2026-09-19

- Created `PRD.md`, `Architecture.md`, `Rules.md`, `Phases.md`, `Design.md`, `Memory.md`, `Agents.md`  
- Added Cursor rule to keep these docs updated on future changes  
- Prior context: Headroom wrap for Cursor (local proxy); Agent-Reach evaluated and rejected for production scrape path; Adzuna/Jooble integration designed into fetch/digest  

## Open follow-ups

- [ ] User sets Adzuna (and optional Jooble) secrets + redeploys `fetch-jobs`, `daily-job-digest`  
- [ ] Confirm production unsubscribe + Resend secrets on latest deploy URL  
- [ ] Security pass on `match-jobs` JWT handling  
