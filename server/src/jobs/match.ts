/**
 * Profile→job match scoring (pure, deterministic — no randomness).
 * Scores a stored job against the user's profile on a 0–100 scale.
 */
import type { Job, Profile } from '../types.js';

function safeParseArray(json: string | undefined | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map((s) => String(s)) : [];
  } catch {
    return [];
  }
}

/**
 * Returns a 0–100 match score. With no profile, returns a neutral 50 so jobs
 * are still browsable and ordered by recency upstream.
 */
export function scoreJob(job: Job, profile?: Profile): number {
  if (!profile) return 50;

  const cities = safeParseArray(profile.cities);
  const skills = safeParseArray(profile.skills);
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  const titleLower = job.title.toLowerCase();
  const locLower = job.location.toLowerCase();

  let score = 40;

  // Location match (up to +20)
  if (cities.some((c) => c && locLower.includes(c.toLowerCase()))) {
    score += 20;
  } else if (/remote|anywhere|worldwide/.test(locLower)) {
    score += 12; // remote is broadly acceptable
  }

  // Title alignment (up to +20)
  if (profile.title) {
    const titleWords = profile.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const hits = titleWords.filter((w) => titleLower.includes(w)).length;
    if (titleWords.length > 0) {
      score += Math.round((hits / titleWords.length) * 20);
    }
  }

  // Skills overlap (up to +25)
  if (skills.length > 0) {
    const matched = skills.filter((s) => s && haystack.includes(s.toLowerCase())).length;
    score += Math.min(25, matched * 5);
  }

  // Salary fit (up to +10)
  if (profile.salary_min > 0 && job.salary_max > 0) {
    if (job.salary_max >= profile.salary_min) score += 5;
    if (job.salary_min > 0 && profile.salary_max > 0 && job.salary_min <= profile.salary_max) {
      score += 5;
    }
  }

  return Math.max(15, Math.min(99, score));
}
