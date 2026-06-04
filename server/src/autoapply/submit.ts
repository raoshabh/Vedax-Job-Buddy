/**
 * ATS submission adapter.
 *
 * IMPORTANT — "Copilot + safe-auto" posture:
 * Fully-automated submission to a candidate-facing ATS requires an
 * EMPLOYER-AUTHORIZED path — e.g. the employer's Greenhouse/Lever board API
 * key, or a partner integration. Those endpoints are employer-keyed and not
 * open to applicant-side tools. We therefore run in DRY-RUN by default: the
 * pipeline prepares the tailored application, records it as queued-ready, and
 * surfaces the real apply URL for the user to submit (the safe one-tap).
 *
 * When a legitimate submission path is configured, set LIVE_SUBMISSION_ENABLED
 * and implement the POST in submitToAts(). We never silently bot-submit to
 * sources that forbid it, and we never mark an application "applied" unless a
 * real submission actually occurred.
 */
import type { Job, Profile } from '../types.js';
import type { Tailoring } from '../ai/tailor.js';

export const LIVE_SUBMISSION_ENABLED = false;

export interface SubmitOutcome {
  submitted: boolean;
  channel: 'dry-run' | 'live';
  url: string;
}

export async function submitToAts(
  job: Job,
  _profile: Profile,
  _tailoring: Tailoring
): Promise<SubmitOutcome> {
  if (!LIVE_SUBMISSION_ENABLED) {
    return { submitted: false, channel: 'dry-run', url: job.url };
  }

  // ── Future: live submission via an employer-authorized ATS path ──
  // const source = job.source.split(':')[0];
  // if (source === 'greenhouse') { /* POST boards-api.greenhouse.io ... (board API key) */ }
  // if (source === 'lever')      { /* POST api.lever.co ... (employer key) */ }
  return { submitted: true, channel: 'live', url: job.url };
}
