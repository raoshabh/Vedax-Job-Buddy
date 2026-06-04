/**
 * Auto-apply pipeline worker.
 *
 * Discovers the user's best DIRECT-ATS matches, auto-tailors each, and queues
 * them ready-to-submit — with guardrails: source allowlist (direct-ATS only),
 * dedupe against existing applications, per-run and per-day caps, and a minimum
 * match score. Every run is recorded for audit. Submission goes through the
 * dry-run adapter (see submit.ts) until a live, authorized path is configured.
 */
import { config } from '../config.js';
import {
  getProfile,
  searchStoredJobs,
  getAppliedJobIds,
  createApplication,
  updateApplicationStatus,
  saveTailoring,
  getAutoApplyConfig,
  recordAutoApplyRun,
  countAutoPreparedToday,
} from '../db.js';
import { tailorApplication } from '../ai/tailor.js';
import { submitToAts, LIVE_SUBMISSION_ENABLED } from './submit.js';
import { getEntitlements } from '../billing/entitlements.js';
import type { Job } from '../types.js';

export interface AutoApplyItem {
  job_id: string;
  title: string;
  company: string;
  source: string;
  match_score: number;
  status: 'queued' | 'applied';
  submitted: boolean;
  url: string;
}

export interface AutoApplyResult {
  mode: 'prepare' | 'auto';
  live: boolean;
  requested: number;
  prepared: number;
  skipped: number;
  remaining_today: number;
  items: AutoApplyItem[];
  message?: string;
}

function eligibleSource(source: string): boolean {
  const base = (source || '').split(':')[0].toLowerCase();
  return config.autoApplySources.includes(base);
}

function todayUtc(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date());
}

export async function runAutoApply(
  userId: string,
  opts: { max?: number } = {}
): Promise<AutoApplyResult> {
  const cfg = getAutoApplyConfig(userId);
  const mode = (cfg?.mode as 'prepare' | 'auto') ?? 'prepare';
  const userCap = cfg?.daily_cap ?? config.autoApplyDailyCap;
  // Plan caps the user's configured daily limit (Free=3/day, Pro=25/day).
  const ent = getEntitlements(userId);
  const dailyCap = Math.min(userCap, ent.autoApplyDailyCap);
  const minScore = cfg?.min_score ?? config.autoApplyMinScore;

  const profile = getProfile(userId);
  if (!profile) {
    return {
      mode,
      live: LIVE_SUBMISSION_ENABLED,
      requested: 0,
      prepared: 0,
      skipped: 0,
      remaining_today: 0,
      items: [],
      message: 'Set up your profile before running auto-apply.',
    };
  }

  // Day budget: never exceed the daily cap across runs.
  const preparedToday = countAutoPreparedToday(userId, todayUtc());
  const remainingToday = Math.max(0, dailyCap - preparedToday);
  const perRun = Math.min(
    opts.max ?? dailyCap,
    remainingToday,
    config.autoApplyHardCapPerRun
  );

  if (perRun <= 0) {
    return {
      mode,
      live: LIVE_SUBMISSION_ENABLED,
      requested: 0,
      prepared: 0,
      skipped: 0,
      remaining_today: 0,
      items: [],
      message: `Daily cap reached (${dailyCap}/day). Try again tomorrow.`,
    };
  }

  // Candidate pool: top matches, direct-ATS only, above the score floor, not yet applied.
  const alreadyApplied = new Set(getAppliedJobIds(userId));
  const candidates = searchStoredJobs(profile, { limit: 100 })
    .filter((j) => eligibleSource(j.source))
    .filter((j) => (j.match_score ?? 0) >= minScore)
    .filter((j) => !alreadyApplied.has(j.id));

  const toProcess: Job[] = candidates.slice(0, perRun);
  const skipped = Math.max(0, candidates.length - toProcess.length);

  const items: AutoApplyItem[] = [];
  for (const job of toProcess) {
    try {
      // Auto-tailor (quality over quantity — this is the point of the pipeline).
      const { data: tailoring } = await tailorApplication(profile, job);
      saveTailoring(userId, job.id, tailoring, 'auto');

      const outcome = await submitToAts(job, profile, tailoring);

      // Honest status: only "applied" if a real submission occurred.
      const status: 'queued' | 'applied' = outcome.submitted ? 'applied' : 'queued';
      const note = outcome.submitted
        ? `[auto-apply] Submitted via ${outcome.channel}. ${outcome.url}`
        : `[auto-apply] Prepared & queued — review and submit: ${outcome.url}`;

      const app = createApplication(userId, job.id, note);
      if (status !== app.status) {
        updateApplicationStatus(app.id, status, note);
      }

      items.push({
        job_id: job.id,
        title: job.title,
        company: job.company,
        source: job.source,
        match_score: job.match_score ?? 0,
        status,
        submitted: outcome.submitted,
        url: outcome.url,
      });
    } catch (err) {
      console.error('[auto-apply] item failed:', err instanceof Error ? err.message : err);
    }
  }

  recordAutoApplyRun({
    user_id: userId,
    mode,
    requested: toProcess.length,
    prepared: items.length,
    skipped,
    summary: items,
  });

  return {
    mode,
    live: LIVE_SUBMISSION_ENABLED,
    requested: toProcess.length,
    prepared: items.length,
    skipped,
    remaining_today: Math.max(0, remainingToday - items.length),
    items,
    message:
      items.length === 0
        ? 'No new eligible direct-ATS jobs above your match threshold. Try lowering the score or searching more jobs.'
        : undefined,
  };
}
