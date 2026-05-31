<div align="center">

# ⚡ JobFlow

### AI-powered job matching that finds, scores, and helps you apply — automatically.

Upload your CV once, set your preferences, and let AI surface the most relevant roles
from LinkedIn, Indeed, StepStone, HeyJobs, and Xing — with personalized match scores,
one-click applications, and real-time notifications.

<br/>

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Edge%20Functions-3FCF8E?logo=supabase&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)

</div>

---

## ✨ Features

- 🔍 **Live multi-board job search** — parallel scraping across LinkedIn, Indeed, StepStone, HeyJobs & Xing via Firecrawl
- 🧠 **AI match scoring** — your CV, skills, and preferences scored against every job by Google Gemini (via Lovable AI Gateway)
- 📄 **CV parsing** — upload a PDF, auto-extract skills and profile fields
- 📬 **Email + in-app notifications** — application confirmations, job alerts, and a daily digest
- 🌍 **EU + US location filters** — country-by-country with major cities
- 🔐 **Secure by default** — JWT-verified edge functions, RLS on every table, per-user rate limiting, HTML/PII sanitization

---

## 🏗️ End-to-End Architecture

```mermaid
flowchart TB
    subgraph Client["🖥️ Client — React + Vite SPA"]
        direction TB
        UI["Pages & Components<br/>(Index · Applications · Modals)"]
        Hooks["React Hooks<br/>useRealJobs · useJobMatcher · useCVParser<br/>useJobApplications · useNotifications · useAuth"]
        Ctx["NotificationProvider<br/>(context + Realtime)"]
        UI --> Hooks
        Hooks --> Ctx
    end

    subgraph Supabase["☁️ Supabase Backend"]
        direction TB
        Auth["🔑 Auth<br/>(JWT sessions)"]
        DB[("🗄️ PostgreSQL<br/>+ Row-Level Security")]
        Store["📦 Storage<br/>(resumes bucket)"]
        RT["📡 Realtime<br/>(notifications)"]

        subgraph Edge["⚙️ Edge Functions (Deno)"]
            direction TB
            FJ["fetch-jobs"]
            MJ["match-jobs"]
            PC["parse-cv"]
            SAE["send-application-email"]
            SJA["send-job-alert"]
            DJD["daily-job-digest ⏰"]
        end
    end

    subgraph External["🌐 External Services"]
        direction TB
        FC["🔥 Firecrawl<br/>/v2/search"]
        AI["✨ Lovable AI Gateway<br/>google/gemini-3-flash"]
        RS["✉️ Resend<br/>transactional email"]
    end

    Hooks -->|"invoke()"| Edge
    Hooks -->|"select / update"| DB
    Hooks -->|"sign in / out"| Auth
    Hooks -->|"upload CV"| Store
    Ctx <-->|"subscribe"| RT
    RT --- DB

    FJ -->|"scrape job boards"| FC
    MJ -->|"score jobs"| AI
    PC -->|"extract skills"| AI
    PC -->|"read CV"| Store
    SAE -->|"send email"| RS
    SJA -->|"send email"| RS
    DJD -->|"scrape"| FC
    DJD -->|"send email"| RS

    MJ --> DB
    PC --> DB
    SAE --> DB
    SJA --> DB
    DJD --> DB
    Edge -.->|"verify JWT"| Auth

    classDef client fill:#6366f1,stroke:#4338ca,color:#fff;
    classDef supa fill:#3FCF8E,stroke:#1f9d63,color:#06281a;
    classDef ext fill:#f59e0b,stroke:#b45309,color:#1f1300;
    class UI,Hooks,Ctx client;
    class Auth,DB,Store,RT,FJ,MJ,PC,SAE,SJA,DJD supa;
    class FC,AI,RS ext;
```

### How the core flows work

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant C as Client (hooks)
    participant E as Edge Function
    participant X as External API
    participant DB as Postgres + RLS

    rect rgb(238, 242, 255)
    note over U,DB: 🔍 Live job search
    U->>C: Click "Fetch Real Jobs"
    C->>E: invoke fetch-jobs { query, location, jobType }
    E->>X: 3× parallel Firecrawl /v2/search
    X-->>E: scraped markdown results
    E->>E: parse · normalize · dedupe · tag source
    E-->>C: { jobs, sources, warnings }
    C-->>U: render listings (cached 5 min)
    end

    rect rgb(240, 253, 244)
    note over U,DB: 🧠 AI match scoring
    U->>C: Click "AI Match"
    C->>E: invoke match-jobs { jobs }
    E->>DB: load skills + profile (JWT user)
    E->>X: Gemini scores each job
    X-->>E: match scores + reasons
    E-->>C: scored jobs
    end

    rect rgb(255, 247, 237)
    note over U,DB: 📄 Apply + notify
    U->>C: Submit application
    C->>E: invoke send-application-email
    E->>E: verify JWT · rate-limit · sanitize
    E->>X: Resend confirmation email
    E->>DB: insert notification row
    DB-->>C: Realtime push → bell updates
    end
```

---

## 🧩 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 5, TypeScript 5 |
| **UI** | Tailwind CSS, shadcn/ui (Radix), Framer Motion, Lucide icons |
| **State / Data** | React Query, React Context, custom hooks |
| **Backend** | Supabase — Auth, PostgreSQL (RLS), Storage, Realtime, Edge Functions (Deno) |
| **AI** | Lovable AI Gateway → `google/gemini-3-flash-preview` |
| **Scraping** | Firecrawl `/v2/search` |
| **Email** | Resend |

---

## ⚙️ Edge Functions

| Function | Trigger | Purpose | External | Auth |
|----------|---------|---------|----------|------|
| `fetch-jobs` | Client | Parallel multi-board job scraping, parsing & dedup | Firecrawl | — |
| `match-jobs` | Client | AI scoring of jobs against the user's profile | Lovable AI | JWT |
| `parse-cv` | Client | Extract skills & profile fields from an uploaded CV | Lovable AI | JWT + ownership |
| `send-application-email` | Client | Application confirmation email + notification | Resend | JWT + rate-limit |
| `send-job-alert` | Client | New-job alert email + notification | Resend | JWT |
| `daily-job-digest` | Cron ⏰ | Daily digest email for opted-in users | Firecrawl, Resend | Cron secret |

---

## 🗄️ Database Schema (RLS-protected)

```mermaid
erDiagram
    auth_users ||--o| profiles : has
    auth_users ||--o| user_preferences : has
    auth_users ||--o{ user_skills : has
    auth_users ||--o{ job_applications : submits
    auth_users ||--o{ saved_jobs : saves
    auth_users ||--o{ cv_upload_history : uploads
    auth_users ||--o{ notifications : receives
    auth_users ||--o{ rate_limits : throttled_by

    profiles {
        uuid user_id PK
        text full_name
        text email
        text current_title
        int experience_years
        text cv_url
    }
    user_preferences {
        uuid user_id PK
        bool email_notifications
        bool instant_notifications
        bool auto_apply_enabled
        int match_threshold
        array preferred_job_types
    }
    notifications {
        uuid id PK
        uuid user_id FK
        text type
        text title
        bool read
        jsonb metadata
        timestamptz created_at
    }
    job_applications {
        uuid id PK
        uuid user_id FK
        text job_title
        text company
        text status
        bool auto_applied
    }
```

> Every table enforces Row-Level Security so users can only read/write their own rows.
> Service-role inserts (from edge functions) bypass RLS; authenticated users have
> column-scoped grants (e.g. notifications can only toggle `read`).

---

## 🚀 Getting Started

**Prerequisites:** Node.js & npm ([install via nvm](https://github.com/nvm-sh/nvm#installing-and-updating))

```sh
# 1. Clone
git clone <YOUR_GIT_URL>
cd career-companion

# 2. Install
npm i

# 3. Run the dev server
npm run dev
```

Other scripts:

```sh
npm run build       # production build
npm run lint        # eslint
npm run test        # vitest
```

### Environment variables

**Frontend** (`.env`):

```sh
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

**Edge functions** (Supabase secrets):

| Secret | Used by |
|--------|---------|
| `FIRECRAWL_API_KEY` | fetch-jobs, daily-job-digest |
| `LOVABLE_API_KEY` | match-jobs, parse-cv |
| `RESEND_API_KEY` | send-application-email, send-job-alert, daily-job-digest |
| `CRON_SECRET` | daily-job-digest |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | all functions |

---

## 🔐 Security Highlights

- **JWT verification** on every privileged edge function (caller identity is never trusted from the request body)
- **Resource ownership checks** — `parse-cv` validates the CV path belongs to the authenticated user
- **Per-user rate limiting** — persistent, atomic sliding window via a Postgres RPC
- **Row-Level Security** on all tables, with column-scoped grants for client updates
- **Input sanitization** — HTML escaping for email bodies, plain-text sanitization for headers, PII masking in logs
- **Hardened SQL** — `SECURITY DEFINER` functions pin `search_path`

---

## 📁 Project Structure

```
career-companion/
├── src/
│   ├── pages/            # Index, Applications, NotFound
│   ├── components/       # UI, modals, NotificationProvider/Panel
│   ├── hooks/            # data + domain hooks (useRealJobs, useJobMatcher, …)
│   ├── integrations/
│   │   └── supabase/     # client + generated types
│   └── types/            # shared TS types (Job, …)
├── supabase/
│   ├── functions/        # Deno edge functions
│   └── migrations/       # SQL schema + RLS policies
└── README.md
```

---

<div align="center">

Built with [Lovable](https://lovable.dev) · Powered by Supabase, Firecrawl, and Google Gemini

</div>
