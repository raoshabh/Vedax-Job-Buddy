/**
 * Daily WhatsApp digest scheduler.
 *
 * A lightweight in-process interval (no external cron dependency). Every tick
 * it checks each opted-in user's local hour against their preferred digest
 * hour and sends once per local day. `sendDigestNow` is shared with the API
 * test endpoint and the MCP tool.
 */
import { config } from '../config.js';
import {
  getUser,
  getWhatsappPrefs,
  getDailyDigest,
  listOptedInPrefs,
  markDigestSent,
} from '../db.js';
import { sendWhatsApp, type SendResult } from './whatsapp.js';
import { buildDigestText, buildDigestTemplateParams } from './digest.js';
import type { DailyDigest } from '../types.js';

const TICK_MS = 15 * 60 * 1000; // every 15 minutes

/** Current YYYY-MM-DD in the given IANA timezone. */
export function localDate(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

/** Current hour (0-23) in the given IANA timezone. */
export function localHour(tz: string): number {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    hour12: false,
  }).format(new Date());
  return Number(h) % 24;
}

export interface DigestSendOutcome {
  ok: boolean;
  reason?: string;
  result?: SendResult;
  digest?: DailyDigest;
  preview?: string;
}

/** Compute and send a user's digest immediately (used by /test, MCP, scheduler). */
export async function sendDigestNow(userId: string): Promise<DigestSendOutcome> {
  const user = getUser(userId);
  if (!user) return { ok: false, reason: 'User not found' };

  const prefs = getWhatsappPrefs(userId);
  if (!prefs || !prefs.phone) {
    return { ok: false, reason: 'No WhatsApp number configured' };
  }

  const tz = prefs.timezone || config.digestTimezone;
  const dateStr = localDate(tz);
  const digest = getDailyDigest(userId, dateStr);
  const text = buildDigestText(user.name, digest);
  const params = buildDigestTemplateParams(user.name, digest);

  const result = await sendWhatsApp(prefs.phone, text, params);
  if (result.sent) {
    markDigestSent(userId, dateStr);
  }

  return { ok: result.sent, reason: result.error, result, digest, preview: text };
}

async function tick(): Promise<void> {
  let prefs;
  try {
    prefs = listOptedInPrefs();
  } catch (err) {
    console.error('[scheduler] failed to list prefs:', err instanceof Error ? err.message : err);
    return;
  }

  for (const p of prefs) {
    const tz = p.timezone || config.digestTimezone;
    try {
      const hour = localHour(tz);
      const today = localDate(tz);
      if (hour === p.digest_hour && p.last_sent_date !== today) {
        const outcome = await sendDigestNow(p.user_id);
        console.error(
          `[scheduler] digest → ${p.phone} (${tz} ${hour}:00): ${
            outcome.ok ? 'sent' : 'failed: ' + outcome.reason
          }`
        );
      }
    } catch (err) {
      console.error('[scheduler] tick error:', err instanceof Error ? err.message : err);
    }
  }
}

let started = false;

export function startDigestScheduler(): void {
  if (started || !config.schedulerEnabled) return;
  started = true;
  // Initial catch-up shortly after boot, then on a fixed interval.
  setTimeout(() => void tick(), 5000);
  setInterval(() => void tick(), TICK_MS);
  console.log(
    `  Digest:    scheduler active (every 15m, default ${config.digestDefaultHour}:00 ${config.digestTimezone})`
  );
}
