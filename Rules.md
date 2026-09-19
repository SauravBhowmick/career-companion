# JobFlow — Rules (for AI & humans)

> Living doc. Update when conventions, allowed libraries, or hard constraints change.  
> Last reviewed: 2026-09-19

## Always do

1. Read `Agents.md`, then `Memory.md`, then the relevant of `PRD.md` / `Architecture.md` / `Design.md` / `Phases.md` before large changes.
2. After meaningful work, **update `Memory.md`** (what changed, decisions, follow-ups). Update other docs if product/architecture/design/phases changed.
3. Keep diffs surgical — only what the task needs.
4. Match existing patterns in the touched area (hooks vs components, edge function style).
5. Prefer structured job APIs (Adzuna/Jooble) over scraping when both can satisfy the need.
6. Treat email as **best-effort** after durable DB writes (applications, preferences).
7. Escape HTML in emails; never log full PII.

## Never do

1. Do **not** integrate Indeed Publisher / Job Search API (retired for consumers).
2. Do **not** commit secrets (`.env`, API keys, service role keys).
3. Do **not** disable RLS or use service role from the browser.
4. Do **not** trust `userId` from the request body without verifying JWT / ownership (especially `match-jobs` and similar).
5. Do **not** invent new UI libraries when shadcn/Radix + Tailwind already cover the need.
6. Do **not** add Agent Reach / local CLI scrapers into production edge functions.
7. Do **not** rewrite README or docs wholesale unless asked — keep living docs accurate and concise.
8. Do **not** skip updating `Memory.md` after a non-trivial change.

## Stack preferences

| Prefer | Avoid |
|--------|--------|
| React + existing hooks | New global state libraries |
| shadcn/ui + Tailwind tokens | One-off CSS frameworks; purple-glow AI aesthetics |
| Supabase Edge (Deno) | New Node backends for the same job |
| `supabase.functions.invoke` | Ad-hoc fetch to function URLs with hardcoded keys |
| Shared `_shared/*.ts` | Copy-paste across edge functions |
| Official APIs | Fragile HTML scrapers as the primary path |

## Error handling

- Edge: return `{ success: false, error }` with sensible HTTP status; log server-side detail.
- Partial provider failure: return remaining jobs + `warnings` when possible.
- Client: toast errors; don’t wipe successful local/DB state because a secondary call failed.

## Frontend rules

- Path alias `@/`
- Domain logic in `src/hooks/`; presentational pieces in `src/components/`
- Toasts via `sonner`
- Follow `Design.md` tokens (Inter + Space Grotesk, primary blue / accent orange)

## Edge function rules

- `Deno.serve` + CORS `OPTIONS` short-circuit
- Verify JWT for privileged user actions; cron via shared secret header
- Timeouts with `AbortController`
- Normalize jobs to the shared `JobListing` shape when adding providers

## Git / PR

- Only commit when the user asks
- No force-push to main; no `--no-verify` unless explicitly requested
