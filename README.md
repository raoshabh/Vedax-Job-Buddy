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

## 🗺️ Roadmap

- [ ] WhatsApp daily digest ("jobs applied today") via a BSP — India wedge
- [ ] AI resume + cover-letter tailoring per job
- [ ] Safe auto-apply workers for Greenhouse/Lever
- [ ] Billing (Razorpay) + freemium tiers
- [ ] Next.js rebuild (SSR for job-page SEO) + Postgres + Typesense

## ⚠️ Notes

- Job data is sourced live from third-party providers; respect each provider's terms (Remotive listings link back and credit Remotive).
- The local SQLite DB and uploaded resumes live in `server/data/` (or `data/`) and are git-ignored — they contain user PII.

---

Built with [Claude Code](https://claude.com/claude-code).
