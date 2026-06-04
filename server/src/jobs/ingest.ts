/**
 * Ingestion orchestrator: pulls from all enabled providers in parallel,
 * dedupes, and persists into the `jobs` table. Includes a staleness check so
 * searches lazily refresh real data without blocking on every request.
 */
import { config } from '../config.js';
import { upsertJobs, getJobsStats } from '../db.js';
import type { NormalizedJob } from './types.js';
import { fetchGreenhouse } from './providers/greenhouse.js';
import { fetchRemotive } from './providers/remotive.js';
import { fetchAdzuna, adzunaConfigured } from './providers/adzuna.js';

export interface IngestSummary {
  total_fetched: number;
  inserted: number;
  by_source: Record<string, number>;
  providers: { name: string; count: number; ok: boolean }[];
}

let inFlight: Promise<IngestSummary> | null = null;

/** Run all providers, dedupe within the batch, and persist. */
export async function ingestJobs(query?: string): Promise<IngestSummary> {
  // Coalesce concurrent ingests into a single run.
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const providers: { name: string; run: Promise<NormalizedJob[]> }[] = [
      { name: 'greenhouse', run: fetchGreenhouse() },
      { name: 'remotive', run: fetchRemotive() },
    ];
    if (adzunaConfigured()) {
      providers.push({ name: 'adzuna', run: fetchAdzuna(query) });
    }

    const settled = await Promise.allSettled(providers.map((p) => p.run));

    const all: NormalizedJob[] = [];
    const providerStats: IngestSummary['providers'] = [];
    settled.forEach((res, i) => {
      const name = providers[i].name;
      if (res.status === 'fulfilled') {
        all.push(...res.value);
        providerStats.push({ name, count: res.value.length, ok: true });
      } else {
        console.error(`[ingest] ${name} failed:`, res.reason?.message || res.reason);
        providerStats.push({ name, count: 0, ok: false });
      }
    });

    // Dedupe within batch on (source, external_id).
    const seen = new Set<string>();
    const deduped: NormalizedJob[] = [];
    const bySource: Record<string, number> = {};
    for (const job of all) {
      const key = `${job.source}::${job.external_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(job);
      bySource[job.source] = (bySource[job.source] || 0) + 1;
    }

    const inserted = upsertJobs(deduped);

    console.error(
      `[ingest] fetched=${all.length} deduped=${deduped.length} inserted=${inserted}`
    );

    return {
      total_fetched: all.length,
      inserted,
      by_source: bySource,
      providers: providerStats,
    };
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** True when stored jobs are missing or older than the configured TTL. */
export function jobsAreStale(): boolean {
  const stats = getJobsStats();
  if (stats.count < config.minJobsThreshold) return true;
  if (!stats.newest_created_at) return true;
  const ageMs = Date.now() - new Date(stats.newest_created_at).getTime();
  return ageMs > config.ingestTtlMinutes * 60 * 1000;
}

/** Ensure real jobs exist before a search; best-effort (never throws). */
export async function ensureFreshJobs(query?: string): Promise<void> {
  try {
    if (jobsAreStale()) {
      await ingestJobs(query);
    }
  } catch (err) {
    console.error('[ingest] ensureFreshJobs failed:', err instanceof Error ? err.message : err);
  }
}
