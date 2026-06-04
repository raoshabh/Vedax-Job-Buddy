/**
 * Central configuration, sourced from environment variables.
 * India-first defaults; all job providers are optional and degrade gracefully.
 */

function envList(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function envNum(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const DEFAULT_JWT_SECRET = 'jobtracker-dev-secret-change-in-production';

export const config = {
  // Environment / server
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: envList('CORS_ORIGINS', [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
  ]),
  trustProxy: process.env.TRUST_PROXY === 'true',
  rateLimitPerMin: envNum('RATE_LIMIT_PER_MIN', 120),
  authRateLimitPerMin: envNum('AUTH_RATE_LIMIT_PER_MIN', 20),

  // How long ingested jobs stay "fresh" before a background refresh is triggered.
  ingestTtlMinutes: envNum('INGEST_TTL_MINUTES', 360), // 6 hours
  // If the jobs table has fewer than this, force an ingest on next search.
  minJobsThreshold: envNum('MIN_JOBS_THRESHOLD', 25),

  // ── Greenhouse (keyless, direct-ATS — also the safe auto-apply lane) ──
  // Public board tokens. These companies all hire in India / remote.
  greenhouseCompanies: envList('GREENHOUSE_COMPANIES', [
    'stripe',
    'gitlab',
    'databricks',
    'dropbox',
    'airbnb',
    'gusto',
    'coinbase',
    'robinhood',
    'figma',
    'asana',
  ]),
  greenhousePerCompany: envNum('GREENHOUSE_PER_COMPANY', 60),

  // ── Remotive (keyless) ──
  remotiveEnabled: process.env.REMOTIVE_ENABLED !== 'false',
  remotiveLimit: envNum('REMOTIVE_LIMIT', 120),

  // ── Adzuna (free key from https://developer.adzuna.com) ──
  adzunaAppId: process.env.ADZUNA_APP_ID || '',
  adzunaAppKey: process.env.ADZUNA_APP_KEY || '',
  adzunaCountry: process.env.ADZUNA_COUNTRY || 'in', // India
  adzunaPerPage: envNum('ADZUNA_PER_PAGE', 50),

  // Network
  fetchTimeoutMs: envNum('FETCH_TIMEOUT_MS', 15000),

  // ── AI tailoring (Anthropic Claude; template fallback when no key) ──
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  // Sonnet 4.6: best speed/intelligence balance for high-volume content gen.
  // Override with ANTHROPIC_MODEL=claude-opus-4-8 for maximum quality.
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  anthropicEffort: (process.env.ANTHROPIC_EFFORT || 'medium') as 'low' | 'medium' | 'high',

  // ── Auto-apply pipeline (direct-ATS lane only — never aggregators) ──
  autoApplyDailyCap: envNum('AUTO_APPLY_DAILY_CAP', 10),
  autoApplyHardCapPerRun: envNum('AUTO_APPLY_HARD_CAP_PER_RUN', 10),
  autoApplyMinScore: envNum('AUTO_APPLY_MIN_SCORE', 65),
  // Source prefixes eligible for auto-apply. Direct-ATS only (legally safe lane).
  autoApplySources: envList('AUTO_APPLY_SOURCES', ['greenhouse', 'lever', 'ashby']),

  // ── Billing (Razorpay; demo/mock mode when keys absent) ──
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  proPriceInr: envNum('PRO_PRICE_INR', 799),

  // ── WhatsApp daily digest (Meta Cloud API; console/mock fallback) ──
  whatsappToken: process.env.WHATSAPP_TOKEN || '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsappApiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
  // Optional approved template name. WhatsApp requires a pre-approved template
  // for business-initiated messages outside the 24h service window. When unset,
  // the provider sends free-form text (fine for testing / within-window).
  whatsappTemplateName: process.env.WHATSAPP_TEMPLATE_NAME || '',
  whatsappTemplateLang: process.env.WHATSAPP_TEMPLATE_LANG || 'en',

  // Daily digest scheduling (India-first defaults)
  digestDefaultHour: envNum('DIGEST_DEFAULT_HOUR', 20), // 8 PM local
  digestTimezone: process.env.DIGEST_TIMEZONE || 'Asia/Kolkata',
  schedulerEnabled: process.env.SCHEDULER_ENABLED !== 'false',
  dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:5173',
};

// India-relevance: cities + remote keywords used to keep ingestion India-first.
export const INDIA_KEYWORDS = [
  'india',
  'bangalore',
  'bengaluru',
  'mumbai',
  'delhi',
  'new delhi',
  'hyderabad',
  'pune',
  'chennai',
  'gurgaon',
  'gurugram',
  'noida',
  'kolkata',
  'ahmedabad',
  'remote',
  'worldwide',
  'anywhere',
  'global',
  'asia',
];

export function isIndiaRelevant(location: string): boolean {
  const lower = (location || '').toLowerCase();
  return INDIA_KEYWORDS.some((k) => lower.includes(k));
}

export function isProd(): boolean {
  return config.nodeEnv === 'production';
}

/**
 * Validate configuration at boot. Throws on fatal misconfiguration in
 * production; warns about missing optional integrations (which degrade to
 * mock/fallback mode).
 */
export function validateConfig(): void {
  const fatal: string[] = [];

  if (isProd()) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
      fatal.push('JWT_SECRET must be set to a strong, unique secret in production.');
    }
  }

  if (fatal.length > 0) {
    throw new Error('Fatal config error(s):\n - ' + fatal.join('\n - '));
  }

  const warn = (name: string, what: string) => {
    if (!process.env[name]) console.warn(`[config] ${name} not set — ${what} runs in mock/fallback mode.`);
  };
  warn('ANTHROPIC_API_KEY', 'AI tailoring & interview prep');
  warn('ADZUNA_APP_ID', 'Adzuna India job source');
  warn('WHATSAPP_TOKEN', 'WhatsApp delivery');
  warn('RAZORPAY_KEY_ID', 'live billing');
}
