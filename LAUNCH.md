# 🚀 Vedax Job Buddy — Launch Plan

How we get from "works on my machine" to a live product, split into **what I (the AI) can build autonomously** and **what only you can do** (accounts, money, identity, legal, decisions).

---

## Where it stands today (honest assessment)

✅ **Done** — feature-complete MVP, runs end-to-end, single-port deploy, all integrations gated behind env with graceful fallbacks:
job ingestion · AI tailoring · safe auto-apply · tracking · analytics · interview prep · WhatsApp digest · freemium billing · onboarding · MCP server.

⚠️ **Not yet production-grade:**
- **Data:** `sql.js` (file-backed SQLite) — fine for one instance/beta, won't scale or survive serverless restarts.
- **Hardening:** no rate limiting, security headers, env validation, or structured logging yet.
- **Integrations:** running in demo/mock mode — no live AI / WhatsApp / payment keys.
- **Legal:** no Terms / Privacy / consent pages (and we store resumes = PII).

---

## Track A — What I can do (autonomous: code & config, no accounts needed)

| # | Item | Effort |
|---|---|---|
| A1 | **Security hardening** — helmet headers, CORS allowlist, rate limiting, body-size limits, refuse-to-boot on default JWT secret in prod | S |
| A2 | **Robustness** — env validation at boot, structured logging (pino) + request IDs, central error handler, `/ready` probe | S |
| A3 | **Dockerfile** (multi-stage: build dashboard + server → one image) + `docker-compose` + a one-command prod start | S |
| A4 | **Deploy config** — Railway / Render / Fly templates so you deploy in clicks | S |
| A5 | **CI/CD** — GitHub Actions: install + type-check + build on every PR (optional auto-deploy on main) | S |
| A6 | **Postgres migration** — swap `sql.js` for real Postgres (keep the same query layer) + schema migrations | M |
| A7 | **Razorpay webhook** (raw-body, signature-verified) for production-correct subscription state | S |
| A8 | **Legal scaffolding** — Terms, Privacy, auto-apply consent, data-deletion endpoint (you/lawyer finalize the copy) | S |
| A9 | **SEO/brand polish** — OG image, `robots.txt`, sitemap, 404 page (favicon + meta already done) | S |
| A10 | **Tests** — smoke + integration suite over the core flows | M |
| A11 | **Error monitoring + email** — Sentry + Resend/SES wiring, gated on env | S |

I can do **all of Track A** without any account or spend. A1–A5 + A8–A9 get you to a deployable private beta fast; A6 (Postgres) is the one bigger lift before real traffic.

---

## Track B — What only you can do (accounts, money, identity, judgment)

### 1. Decisions
- **Domain name** (buy one).
- **Final pricing** (₹799/mo Pro is a placeholder).
- **AI model**: Sonnet (default, cheap) vs Opus (max quality) — toggle is env.

### 2. Accounts & API keys
| Service | Why | Lead time / cost |
|---|---|---|
| **Anthropic API key** | AI tailoring + interview prep | Instant · pay-per-use (fund it) |
| **Adzuna key** | India job data | Instant · **free** |
| **WhatsApp** (Meta Cloud API **or** BSP: AiSensy/Gupshup/Wati) | Daily digest | **Days** — needs business verification + phone number + **template approval** |
| **Razorpay** | Live payments | Test mode instant; **live needs KYC** (business/PAN/GST + bank) |
| **Hosting** (Railway/Render/Fly) | Run the app | Instant · ~$5–25/mo |
| **Managed Postgres** (Neon/Supabase/Railway) | Real DB (for A6) | Instant · free tier |
| Domain registrar + DNS | Your URL | Instant · ~₹1,000/yr |
| *(optional)* Sentry, Resend/SES | Errors, email | Free tiers |

### 3. Business & legal (get professional help)
- **Register a company/entity** — required for Razorpay payouts + GST (India).
- **Terms of Service + Privacy Policy reviewed by a lawyer** — *critical*: you store resumes (PII) and act on users' behalf. Covers India **DPDP Act** (+ GDPR if EU users), data retention/deletion, and the **auto-apply consent & disclaimer**.
- Bank account + GST registration (India).

### 4. Content & ops
- Curate the Greenhouse company list for your market.
- Brand assets (logo, OG image — I made a placeholder favicon).
- Support channel, monitoring alerts, backup policy.

---

## Recommended launch sequence

- **M0 · Private beta (1–2 wks)** — I do A1–A5, A8–A9; you provide domain + hosting + Anthropic & Adzuna keys; Razorpay test mode; WhatsApp mock. Invite ~20 users.
- **M1 · Public beta (2–4 wks)** — I do A6 (Postgres), A7, A10, A11; you complete Razorpay KYC, WhatsApp template approval, and legal review. Go live with payments + WhatsApp.
- **M2 · Scale** — Next.js SSR rebuild for SEO (free organic traffic), Redis/queue for ingestion + digests, Typesense search, employer-authorized live ATS submission.

---

## Rough monthly cost to go live (India-first, early stage)

| | Cost |
|---|---|
| Hosting | ~$5–25 |
| Postgres | $0 (free tier) → ~$20 |
| Anthropic | metered (~₹1–4 / tailoring on Sonnet; quotas already cap this) |
| WhatsApp | per-conversation (utility templates cheap in India) |
| Razorpay | ~2% / transaction |
| Domain | ~₹1,000 / yr |

**You can launch a private beta for ~a domain + ~$10–25/mo hosting + metered AI.**

---

## Top risks to manage

1. **Legal/PII + auto-apply consent** — settle before *public* launch.
2. **WhatsApp & Razorpay verification have lead time** — start those applications early.
3. **`sql.js` is single-instance** — migrate to Postgres (A6) before real traffic.
