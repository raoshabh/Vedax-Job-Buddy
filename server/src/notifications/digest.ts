/**
 * Build the daily digest message (text + template params) from a DailyDigest.
 */
import { config } from '../config.js';
import type { DailyDigest } from '../types.js';

function motivation(d: DailyDigest): string {
  if (d.offers > 0) return '🎉 You have an offer in hand — congratulations!';
  if (d.interviews > 0) return '🔥 Interviews lined up — go get them!';
  if (d.applied_today >= 5) return '💪 Big push today. Consistency wins this game.';
  if (d.applied_today > 0) return '👏 Progress logged. Keep the momentum going!';
  return '🌱 No applications today — a couple tomorrow keeps the pipeline alive.';
}

/** Full human-readable digest (used in mock mode and within the 24h window). */
export function buildDigestText(name: string, d: DailyDigest): string {
  const lines = [
    `🚀 *JobBuddy daily update* — ${d.date}`,
    `Hi ${name.split(' ')[0]}, here's your job search at a glance:`,
    '',
    `✅ Applied today: *${d.applied_today}*`,
    `🔄 Status updates today: *${d.status_changes_today}*`,
    `📊 Active applications: *${d.total_applications}*`,
    `🎯 Interviews: *${d.interviews}*    🏆 Offers: *${d.offers}*`,
    '',
    motivation(d),
    `👉 Open your dashboard: ${config.dashboardUrl}`,
  ];
  return lines.join('\n');
}

/**
 * Ordered params for an approved WhatsApp template, e.g. a body like:
 *   "Hi {{1}}, today you applied to {{2}} jobs ({{3}} active, {{4}} interviews)."
 */
export function buildDigestTemplateParams(name: string, d: DailyDigest): string[] {
  return [
    name.split(' ')[0],
    String(d.applied_today),
    String(d.total_applications),
    String(d.interviews),
  ];
}
