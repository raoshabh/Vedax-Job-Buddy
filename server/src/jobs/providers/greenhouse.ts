/**
 * Greenhouse public job boards (keyless).
 *
 * Strategically important: these are direct-ATS listings, which is the
 * legally-safe lane for the "Apply Copilot" auto-submit feature later.
 * Endpoint: https://boards-api.greenhouse.io/v1/boards/{token}/jobs
 */
import { config, isIndiaRelevant } from '../../config.js';
import { fetchJson, looksRemote, type NormalizedJob } from '../types.js';

interface GhJob {
  id: number;
  title: string;
  updated_at: string;
  first_published?: string;
  absolute_url: string;
  company_name?: string;
  location?: { name?: string };
}

interface GhResponse {
  jobs: GhJob[];
}

async function fetchCompany(token: string): Promise<NormalizedJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs`;
  const data = await fetchJson<GhResponse>(url, config.fetchTimeoutMs);
  const jobs = data.jobs || [];

  const normalized: NormalizedJob[] = [];
  for (const j of jobs) {
    const location = j.location?.name || 'Not specified';
    const remote = looksRemote(location) || looksRemote(j.title);
    // India-first: keep India-located or remote roles.
    if (!isIndiaRelevant(location) && !remote) continue;

    normalized.push({
      source: `greenhouse:${token}`,
      external_id: String(j.id),
      title: j.title,
      company: j.company_name || prettyName(token),
      location,
      salary_min: 0,
      salary_max: 0,
      description: '',
      url: j.absolute_url,
      remote,
      employment_type: '',
      posted_at: j.first_published || j.updated_at || new Date().toISOString(),
    });

    if (normalized.length >= config.greenhousePerCompany) break;
  }
  return normalized;
}

function prettyName(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1);
}

export async function fetchGreenhouse(): Promise<NormalizedJob[]> {
  const results = await Promise.allSettled(
    config.greenhouseCompanies.map((c) => fetchCompany(c))
  );

  const jobs: NormalizedJob[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      jobs.push(...r.value);
    } else {
      console.error('[greenhouse] company fetch failed:', r.reason?.message || r.reason);
    }
  }
  return jobs;
}
