/**
 * Adzuna aggregator API (free key from https://developer.adzuna.com).
 * Best India coverage of the three providers. Gated on ADZUNA_APP_ID / ADZUNA_APP_KEY;
 * silently returns [] when no key is configured so the app still runs.
 * Endpoint: https://api.adzuna.com/v1/api/jobs/{country}/search/{page}
 */
import { config } from '../../config.js';
import { fetchJson, looksRemote, stripHtml, type NormalizedJob } from '../types.js';

interface AdzunaResult {
  id: string;
  title: string;
  description?: string;
  redirect_url: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
  contract_time?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
}

interface AdzunaResponse {
  results: AdzunaResult[];
}

export function adzunaConfigured(): boolean {
  return Boolean(config.adzunaAppId && config.adzunaAppKey);
}

export async function fetchAdzuna(query?: string): Promise<NormalizedJob[]> {
  if (!adzunaConfigured()) return [];

  const params = new URLSearchParams({
    app_id: config.adzunaAppId,
    app_key: config.adzunaAppKey,
    results_per_page: String(config.adzunaPerPage),
    content_type: 'application/json',
  });
  if (query) params.set('what', query);

  const url = `https://api.adzuna.com/v1/api/jobs/${config.adzunaCountry}/search/1?${params.toString()}`;

  let data: AdzunaResponse;
  try {
    data = await fetchJson<AdzunaResponse>(url, config.fetchTimeoutMs);
  } catch (err) {
    console.error('[adzuna] fetch failed:', err instanceof Error ? err.message : err);
    return [];
  }

  return (data.results || []).map((r) => {
    const location = r.location?.display_name || 'India';
    return {
      source: 'adzuna',
      external_id: String(r.id),
      title: r.title,
      company: r.company?.display_name || 'Confidential',
      location,
      salary_min: Math.round(r.salary_min || 0),
      salary_max: Math.round(r.salary_max || 0),
      description: stripHtml(r.description || ''),
      url: r.redirect_url,
      remote: looksRemote(location) || looksRemote(r.title),
      employment_type: r.contract_time || '',
      posted_at: r.created || new Date().toISOString(),
    };
  });
}
