# JobFlow — Design

> Living doc. Update when tokens, typography, or UI patterns change.  
> Last reviewed: 2026-09-19  
> Source of truth for values: `src/index.css`, Tailwind theme, `Header` / `HeroSection`

## Brand

- **Name:** JobFlow (⚡ / Zap mark in header)  
- **Feel:** Clean SaaS productivity — confident blue primary, warm orange accent, calm neutrals  
- **Avoid:** Generic purple-on-white AI gradients, heavy glow stacks, emoji-as-UI, newspaper/broadsheet layouts

## Typography

| Role | Font | Notes |
|------|------|--------|
| Body / UI | **Inter** | 300–800; default `font-sans` |
| Display / headings | **Space Grotesk** | 500–700; `font-display` |

Loaded via Google Fonts in `src/index.css`.

## Color tokens (light — default)

HSL CSS variables (no `hsl()` wrapper in the var itself):

| Token | HSL | Use |
|-------|-----|-----|
| `--primary` | `221 83% 53%` | Buttons, links, brand |
| `--accent` | `24 95% 53%` | Highlights, CTAs secondary |
| `--success` | `142 76% 36%` | Positive / match cues |
| `--destructive` | `0 84% 60%` | Errors |
| `--background` | `210 20% 98%` | Page |
| `--foreground` | `222 47% 11%` | Text |
| `--muted-foreground` | `215 16% 47%` | Secondary text |
| `--radius` | `0.75rem` | Default rounding |

Gradients:

- `--gradient-primary` — blue → violet  
- `--gradient-accent` — orange range  
- `--gradient-hero` — dark navy hero plane  

Utilities: `.gradient-primary`, `.text-gradient`, `.shadow-glow`, etc.

## Dark mode

- `.dark` token set exists in `src/index.css`  
- Tailwind `darkMode: ["class"]`  
- **Product default:** light (no first-class theme toggle in Settings yet)  
- Prefer extending tokens over hard-coded hex in components

## Layout & UI patterns

- SPA shell: sticky header + main content; not a dense multi-widget dashboard on first paint of marketing/hero  
- Job results: cards / list with match score affordances  
- Modals: Auth, Profile, Settings, Apply (centered; Framer Motion)  
- Notifications: panel from header bell  
- Prefer existing `src/components/ui/*` (shadcn) over new primitives  

## Motion

- Use Framer Motion for modal enter/exit and light section presence  
- Keep motion purposeful (2–3 patterns), not decorative noise  

## Content tone

- Clear, direct, professional  
- Short helper copy under settings/toggles (e.g. email notifications)  
- Toasts for success/warning/error via `sonner`  
