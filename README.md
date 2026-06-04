# Vedax Job Buddy 🚀

AI-powered, **India-first** job search & application tracker. Search real jobs matched to your profile, apply with an AI **Copilot**, and track your whole journey on a dashboard — with an MCP server so AI agents (like Claude) can search, apply, and report on your behalf.

> **Product posture:** *Copilot + safe-auto.* The AI tailors and pre-fills applications; you one-tap submit for aggregators, and fully-automated submission is reserved for **direct-ATS boards (Greenhouse/Lever/Ashby)** that permit it. No spray-applying to sites whose terms forbid it.

---

## ✨ Features

- **Real job ingestion** from multiple providers (no mock data):
  - **Greenhouse** public ATS boards (keyless) — also the safe auto-apply lane
  - **Remotive** remote jobs (keyless)
  - **Adzuna** India aggregator (optional free API key)
- **India-first matching** — keeps India-located and remote roles, ranked by a profile→job match score (title, skills, location, salary).
- **Application tracking** — kanban pipeline (Queued → Applied → Screening → Interview → Offer → Rejected), stats, and recent activity.
- **MCP server** — 7 `jobtracker_*` tools so an AI agent can set up a profile, search, apply, auto-apply, and pull a dashboard.
- **Clean React dashboard** — auth, profile setup (skills/cities/salary/resume), AI job search, and applications views.

## 🧱 Tech Stack

| Layer | Stack |
|---|---|
| Dashboard | React 18 + TypeScript + Vite + Tailwind CSS |
| API | Node + Express + TypeScript |
| Auth | JWT + bcrypt |
| Storage | SQLite (via `sql.js`, zero native deps) |
| AI integration | Model Context Protocol (`@modelcontextprotocol/sdk`), stdio transport |

## 📂 Structure

```
vedax-job-buddy/
├── server/                 # Express API + MCP server
│   ├── src/
│   │   ├── index.ts            # API entry (port 3001)
│   │   ├── db.ts               # SQLite + job search/scoring
│   │   ├── config.ts           # env-driven provider config
│   │   ├── auth.ts             # JWT middleware
│   │   ├── routes/             # auth, profile, jobs, applications
│   │   ├── jobs/               # ingestion layer
│   │   │   ├── ingest.ts           # orchestrator + staleness TTL
│   │   │   ├── match.ts            # profile→job scoring
│   │   │   └── providers/          # greenhouse, remotive, adzuna
│   │   └── mcp/server.ts       # MCP stdio server (7 tools)
│   └── .env.example
└── dashboard/              # React + Vite frontend
    └── src/                # pages, components, api client, auth store
```

## 🚀 Getting Started

### 1. Backend (API + job ingestion)

```bash
cd server
npm install
cp .env.example .env        # optional: add Adzuna keys for India coverage
npm run build
npm start                   # http://localhost:3001
```

Greenhouse + Remotive work with **zero config**. The server warms up the job store on startup.

### 2. Dashboard

```bash
cd dashboard
npm install
npm run dev                 # http://localhost:5173
```

### 3. MCP server (for AI agents)

```bash
cd server
npm run build
node dist/mcp/server.js     # stdio transport
```

## 🔌 Configuration

All optional — see [`server/.env.example`](server/.env.example).

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Token signing secret |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | Free key from [developer.adzuna.com](https://developer.adzuna.com) for India coverage |
| `GREENHOUSE_COMPANIES` | Comma-separated ATS board tokens to ingest |
| `REMOTIVE_ENABLED` | Toggle Remotive provider |
| `INGEST_TTL_MINUTES` | How long jobs stay fresh before re-ingest |

## 🛠️ MCP Tools

`jobtracker_setup_profile` · `jobtracker_search_jobs` · `jobtracker_apply_to_job` · `jobtracker_list_applications` · `jobtracker_update_application_status` · `jobtracker_get_dashboard` · `jobtracker_auto_apply`

## 📲 WhatsApp Daily Digest

Opt-in daily WhatsApp summary of your job search (applications, interviews, progress).

- **Provider:** Meta WhatsApp Cloud API, with a **mock mode** (logs to server console) so it runs with zero credentials. Point `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` at Meta — or a BSP that exposes the Cloud API (AiSensy/Gupshup/360dialog) — to go live.
- **Scheduling:** in-process scheduler sends once per day at the user's chosen local hour (default **8 PM IST**); per-user timezone aware.
- **Compliance:** explicit opt-in; supports pre-approved **utility templates** for business-initiated sends (`WHATSAPP_TEMPLATE_NAME`).
- **UI:** `/notifications` — set number, opt-in, time; "Send Test Digest" with a live message preview.
- **MCP tools:** `jobtracker_setup_whatsapp`, `jobtracker_send_whatsapp_digest`.

## ✨ AI Application Tailoring

Per-job, "Copilot not spam" tailoring — the heart of the product strategy.

- **Model:** Claude **Sonnet 4.6** by default (best speed/cost for high-volume content gen; set `ANTHROPIC_MODEL=claude-opus-4-8` for max quality).
- **Output:** structured (cover letter + resume tips + ATS keywords + strengths/gaps + match score), validated with Zod.
- **Prompt caching:** the candidate profile sits in a `cache_control` system block, so tailoring the same profile against many jobs reuses the cached prefix (big cost saving).
- **Graceful fallback:** a deterministic template generator runs when `ANTHROPIC_API_KEY` is absent, so the feature works with zero setup and upgrades to real AI when a key is added.
- **Caching:** results are persisted per (user, job); reopening a job is instant, `?refresh` regenerates.
- **UI:** "✨ Tailor" on each job card opens a modal with the cover letter (one-click copy), tips, keywords, and analysis.
- **MCP tool:** `jobtracker_tailor_application`.

## 🤖 Auto-Apply Pipeline (safe / direct-ATS lane)

"Quality, not spam." Auto-discovers your best **direct-ATS** matches, auto-tailors each, and queues them ready to submit — with hard guardrails.

- **Source allowlist:** only Greenhouse / Lever / Ashby (direct-ATS) — **never** aggregators or sites that prohibit automation.
- **Guardrails:** dedupe vs existing applications, configurable **daily cap**, **per-run hard cap**, and a **minimum match-score** floor.
- **Honest submission:** runs in **dry-run** by default (prepares + queues with the real apply URL); never marks an application "applied" unless a real submission occurred. Live submission has a clear extension point (`autoapply/submit.ts`) for when an employer-authorized ATS path is configured.
- **Audit:** every run is recorded (`auto_apply_runs`); applications carry an `[auto-apply]` note.
- **UI:** `/auto-apply` — enable toggle, Prepare/Auto mode, daily cap, match-score slider, "Run now", and run history.
- **MCP tool:** `jobtracker_auto_apply`.

## 💳 Billing & Freemium

- **Razorpay** (India-first) subscriptions with a **demo mode** when keys are absent (upgrade simulated locally for dev/demo).
- **Free vs Pro entitlements**, enforced server-side:
  | | Free | Pro (₹799/mo) |
  |---|---|---|
  | AI tailorings | 5 / month | 1000 / month |
  | Auto-apply | 3 / day | 25 / day |
  | WhatsApp digest | — | ✅ |
- Plans page with live usage meter, upgrade (Razorpay Checkout / demo), and cancel.
- Gates return `402 { upgrade: true }` so the UI can prompt upgrades.

## 🎓 AI Interview Prep (Pro)

Per-job prep kit: an overview, topics to brush up, **likely questions** (behavioral / technical / role) each with an answer tip grounded in your profile, and smart **questions to ask** the interviewer. Same Claude + template-fallback architecture as tailoring; opened from any application row. MCP tool: `jobtracker_interview_prep`.

## 🗺️ Roadmap

- [x] WhatsApp daily digest ("jobs applied today") — Meta Cloud API + mock mode
- [x] AI resume + cover-letter tailoring per job — Claude Sonnet 4.6 + template fallback
- [x] Safe auto-apply pipeline (direct-ATS) — guardrails + dry-run submission
- [x] Billing (Razorpay) + freemium tiers — Free/Pro entitlements enforced
- [x] Analytics & insights dashboard
- [x] AI interview prep (Pro)
- [x] Smart onboarding checklist + plan badge
- [ ] Live ATS submission via employer-authorized integration
- [ ] Next.js rebuild (SSR for job-page SEO) + Postgres + Typesense

## ⚠️ Notes

- Job data is sourced live from third-party providers; respect each provider's terms (Remotive listings link back and credit Remotive).
- The local SQLite DB and uploaded resumes live in `server/data/` (or `data/`) and are git-ignored — they contain user PII.

---

Built with [Claude Code](https://claude.com/claude-code).
