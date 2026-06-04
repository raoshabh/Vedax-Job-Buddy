/**
 * Remotive remote-jobs API (keyless).
 * Provides full descriptions + skill tags, which feed match scoring well.
 * Endpoint: https://remotive.com/api/remote-jobs
 *
 * Note: Remotive's terms ask that listings link back to the Remotive URL and
 * credit Remotive as the source. We preserve `url` (the Remotive link) and tag
 * `source: 'remotive'`, satisfying attribution.
 */
import { config, isIndiaRelevant } from '../../config.js';
import {
  fetchJson,
  looksRemote,
  parseSalary,
  stripHtml,
  type NormalizedJob,
} from '../types.js';

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

interface RemotiveResponse {
  jobs: RemotiveJob[];
}

export async function fetchRemotive(): Promise<NormalizedJob[]> {
  if (!config.remotiveEnabled) return [];

  const url = `https://remotive.com/api/remote-jobs?limit=${config.remotiveLimit}`;
  let data: RemotiveResponse;
  try {
    data = await fetchJson<RemotiveResponse>(url, config.fetchTimeoutMs);
  } catch (err) {
    console.error('[remotive] fetch failed:', err instanceof Error ? err.message : err);
    return [];
  }

  const jobs: NormalizedJob[] = [];
  for (const j of data.jobs || []) {
    const location = j.candidate_required_location || 'Remote';
    // India-first: remote roles open to India / worldwide.
    if (!isIndiaRelevant(location) && !looksRemote(location)) continue;

    const [salaryMin, salaryMax] = parseSalary(j.salary);
    // Append tags to description so skill matching can see them.
    const tagText = j.tags?.length ? ` Skills: ${j.tags.join(', ')}.` : '';

    jobs.push({
      source: 'remotive',
      external_id: String(j.id),
      title: j.title,
      company: j.company_name,
      location,
      salary_min: salaryMin,
      salary_max: salaryMax,
      description: stripHtml(j.description || '') + tagText,
      url: j.url,
      remote: true,
      employment_type: j.job_type || '',
      posted_at: j.publication_date || new Date().toISOString(),
    });
  }
  return jobs;
}
