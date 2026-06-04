/**
 * Normalized job shape that every provider adapter produces.
 * This is the common contract the ingestion layer persists into the `jobs` table.
 */
export interface NormalizedJob {
  source: string; // e.g. 'greenhouse:stripe', 'remotive', 'adzuna'
  external_id: string; // provider's stable id (used for dedupe)
  title: string;
  company: string;
  location: string;
  salary_min: number; // 0 when unknown
  salary_max: number; // 0 when unknown
  description: string; // plain text (HTML stripped), may be empty
  url: string;
  remote: boolean;
  employment_type: string; // 'full_time' | 'contract' | '' ...
  posted_at: string; // ISO timestamp
}

/** Strip HTML tags + collapse whitespace into a plain-text snippet. */
export function stripHtml(html: string, maxLen = 1200): string {
  if (!html) return '';
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

/**
 * Parse loose salary strings like "$80k - $100k", "₹12,00,000", "120000-150000".
 * Returns [min, max] in absolute units, [0, 0] when unparseable.
 */
export function parseSalary(raw: string | null | undefined): [number, number] {
  if (!raw) return [0, 0];
  const cleaned = raw.toLowerCase().replace(/,/g, '');
  // Capture numbers optionally followed by 'k'
  const matches = [...cleaned.matchAll(/(\d+(?:\.\d+)?)\s*(k?)/g)].map((m) => {
    const n = parseFloat(m[1]);
    return m[2] === 'k' ? n * 1000 : n;
  });
  const nums = matches.filter((n) => n >= 1000); // ignore stray small numbers
  if (nums.length === 0) return [0, 0];
  if (nums.length === 1) return [nums[0], nums[0]];
  return [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])];
}

/** Detect remote roles from a location/title string. */
export function looksRemote(text: string): boolean {
  return /\b(remote|anywhere|worldwide|work from home|wfh)\b/i.test(text || '');
}

/** Wrap fetch with a timeout via AbortController. */
export async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'jobtracker-ai/1.0' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
