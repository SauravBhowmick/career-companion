# Agents.md — JobFlow

Instructions for any coding agent (Cursor, Claude Code, Codex, etc.) working in this repo.

## Before you code

1. Read **`Memory.md`** (latest snapshot + gaps).  
2. Skim **`PRD.md`** for scope and non-goals.  
3. Use **`Architecture.md`** for paths, edge functions, and data flow.  
4. Obey **`Rules.md`** (hard constraints).  
5. Match **`Design.md`** for UI work.  
6. Check **`Phases.md`** so you extend the right phase instead of reinventing.

## While you code

- Prefer smallest change that satisfies the request.  
- Reuse `supabase/functions/_shared/*` for cross-function logic.  
- Keep `JobListing` / client job types compatible when touching fetch/match UI.  
- Do not add Indeed consumer search APIs.  
- Do not put local-only tools (e.g. Agent Reach CLIs) into Edge Functions.

## After you finish a non-trivial task

Update docs in the same session:

| If you changed… | Update… |
|-----------------|---------|
| Features / users / non-goals | `PRD.md` |
| Folders, flows, functions, secrets | `Architecture.md` |
| Conventions / bans | `Rules.md` |
| Roadmap status | `Phases.md` |
| Colors, type, UI patterns | `Design.md` |
| **Anything meaningful** | **`Memory.md`** (append dated entry + refresh snapshot) |

Also follow `.cursor/rules/keep-project-docs-updated.mdc`.

## Project identity

- **Product:** JobFlow  
- **Repo:** career-companion  
- **App:** React + Vite SPA → Supabase (Auth, Postgres RLS, Storage, Realtime, Edge)  
- **Jobs:** Adzuna + Jooble + Firecrawl fallback  
- **AI:** Lovable gateway / Gemini for match + CV parse  
- **Email:** Resend + unsubscribe tokens  

## Quick command map

```sh
npm run dev
npm run build
npm run lint
npm run test
supabase functions deploy <name>
supabase secrets set KEY=value
```

## Definition of done (agent)

- [ ] Behavior matches the user request  
- [ ] No secrets committed  
- [ ] `Memory.md` updated  
- [ ] Other living docs updated if their domain changed  
- [ ] No drive-by refactors unrelated to the ask  
