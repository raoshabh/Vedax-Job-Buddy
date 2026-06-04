/**
 * AI job-application tailoring.
 *
 * Given a candidate profile + a specific job, produce a tailored cover letter,
 * resume tips, ATS keywords, and a match analysis as validated structured output.
 *
 * Uses Claude (Sonnet 4.6 by default) via messages.parse() with a Zod schema.
 * The candidate profile sits in a cache_control system block, so tailoring the
 * same profile against many jobs reuses the cached prefix. Falls back to a
 * deterministic template generator when ANTHROPIC_API_KEY is not configured.
 */
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropic } from './client.js';
import { config } from '../config.js';
import { scoreJob } from '../jobs/match.js';
import type { Job, Profile } from '../types.js';

// ── Structured output schema (kept free of min/max constraints for SO compat) ──
export const TailoringSchema = z.object({
  match_summary: z
    .string()
    .describe('2-3 sentence honest assessment of how well the candidate fits THIS job'),
  match_score: z.number().describe('Overall fit score from 0 to 100'),
  strengths: z
    .array(z.string())
    .describe("3-5 specific strengths the candidate has for this role, grounded in their profile"),
  gaps: z
    .array(z.string())
    .describe('0-3 honest gaps or areas to address; empty array if none'),
  ats_keywords: z
    .array(z.string())
    .describe('8-12 keywords/phrases from the job description to surface in the resume for ATS'),
  resume_tips: z
    .array(z.string())
    .describe('3-5 concrete, actionable edits to tailor the resume to this specific job'),
  cover_letter: z
    .string()
    .describe(
      'A complete, personalized, ready-to-send cover letter (~250-350 words) addressed to the company, in first person, grounded only in the candidate profile (no fabricated experience)'
    ),
});

export type Tailoring = z.infer<typeof TailoringSchema>;
export type TailorSource = 'ai' | 'template';

// Raw JSON Schema sent to the API for structured output (kept independent of the
// SDK's bundled Zod version; the response is validated with TailoringSchema above).
const TAILORING_JSON_SCHEMA = {
  type: 'object',
  properties: {
    match_summary: { type: 'string', description: 'Honest 2-3 sentence fit assessment for THIS job' },
    match_score: { type: 'number', description: 'Overall fit score 0-100' },
    strengths: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 specific strengths grounded in the candidate profile',
    },
    gaps: {
      type: 'array',
      items: { type: 'string' },
      description: '0-3 honest gaps; empty array if none',
    },
    ats_keywords: {
      type: 'array',
      items: { type: 'string' },
      description: '8-12 keywords from the job description to surface in the resume',
    },
    resume_tips: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 concrete, actionable resume edits tailored to this job',
    },
    cover_letter: {
      type: 'string',
      description:
        'Complete personalized cover letter (~250-350 words) addressed to the company, first person, no fabricated experience',
    },
  },
  required: ['match_summary', 'match_score', 'strengths', 'gaps', 'ats_keywords', 'resume_tips', 'cover_letter'],
  additionalProperties: false,
} as const;

function parseArr(json: string | undefined | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function fmtSalary(min: number, max: number): string {
  if (!min && !max) return 'Not specified';
  const k = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
  return `${k(min)} - ${k(max)}`;
}

// Stable, deterministic profile block — no timestamps/randomness (cache-safe).
function buildProfileText(profile: Profile): string {
  const cities = parseArr(profile.cities);
  const skills = parseArr(profile.skills);
  return [
    '# CANDIDATE PROFILE',
    `Professional title: ${profile.title || 'Not specified'}`,
    `Years of experience: ${profile.experience_years || 0}`,
    `Target locations: ${cities.length ? cities.join(', ') : 'Flexible'}`,
    `Skills: ${skills.length ? skills.join(', ') : 'Not specified'}`,
    `Summary: ${profile.summary || 'Not provided'}`,
  ].join('\n');
}

function buildJobText(job: Job): string {
  return [
    'Tailor an application for this job:',
    '',
    `# JOB`,
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location}`,
    `Salary: ${fmtSalary(job.salary_min, job.salary_max)}`,
    '',
    'Job description:',
    job.description || '(no description provided)',
  ].join('\n');
}

const INSTRUCTIONS = `You are an expert career coach and professional resume writer who helps candidates tailor applications to specific jobs.

Given the CANDIDATE PROFILE and a specific JOB, produce a tailored application package.

Rules:
- Ground everything in the candidate's actual profile. NEVER invent experience, employers, or credentials the candidate didn't list.
- The cover letter must be specific to the company and role — reference the role, the company by name, and the candidate's most relevant real skills. Professional, confident, warm tone. No clichés or filler. First person.
- ATS keywords must be drawn from the job description's actual language (technologies, responsibilities, qualifications) — these are terms the candidate should mirror in their resume.
- Resume tips must be concrete and actionable ("Add a bullet quantifying X", "Move skill Y to the top"), not generic advice.
- Be honest in the match analysis: real strengths, and real gaps if present.
- Return ONLY the structured fields requested.`;

/** Generate a tailored application. Uses Claude when available, else a template. */
export async function tailorApplication(
  profile: Profile | undefined,
  job: Job
): Promise<{ data: Tailoring; source: TailorSource }> {
  const client = getAnthropic();

  if (!client || !profile) {
    return { data: templateTailor(profile, job), source: 'template' };
  }

  try {
    const res = await client.messages.create({
      model: config.anthropicModel,
      max_tokens: 8000,
      system: [
        { type: 'text', text: INSTRUCTIONS },
        // Profile is the reusable prefix — cache it across many job tailorings.
        { type: 'text', text: buildProfileText(profile), cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: buildJobText(job) }],
      output_config: {
        format: { type: 'json_schema', schema: TAILORING_JSON_SCHEMA },
        effort: config.anthropicEffort,
      },
    } as Anthropic.MessageCreateParamsNonStreaming);

    const u = res.usage as { cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
    const textBlock = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const raw = textBlock?.text ?? '';
    const validated = TailoringSchema.safeParse(JSON.parse(raw));

    if (validated.success) {
      console.error(
        `[tailor] AI ok (${config.anthropicModel}) cache_read=${u?.cache_read_input_tokens ?? 0} cache_write=${u?.cache_creation_input_tokens ?? 0}`
      );
      return { data: validated.data, source: 'ai' };
    }
    console.error('[tailor] response failed validation, falling back to template');
    return { data: templateTailor(profile, job), source: 'template' };
  } catch (err) {
    console.error('[tailor] AI failed, using template:', err instanceof Error ? err.message : err);
    return { data: templateTailor(profile, job), source: 'template' };
  }
}

// ── Deterministic template fallback (no API key) ──

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'our', 'are', 'will', 'have', 'this', 'that',
  'who', 'were', 'from', 'their', 'they', 'them', 'has', 'was', 'all', 'can', 'each', 'a', 'an',
  'to', 'of', 'in', 'on', 'at', 'as', 'is', 'be', 'we', 'us', 'or', 'by', 'it',
]);

function extractKeywords(description: string, skills: string[]): string[] {
  const found = new Set<string>();
  const desc = description.toLowerCase();
  // Profile skills that appear in the JD rank first.
  for (const s of skills) {
    if (s && desc.includes(s.toLowerCase())) found.add(s);
  }
  // Then notable capitalized / multi-letter tokens from the JD.
  const tokens = description.match(/[A-Za-z][A-Za-z+.#/-]{2,}/g) || [];
  for (const t of tokens) {
    const clean = t.replace(/[.,/]+$/, '');
    if (clean.length < 3 || STOPWORDS.has(clean.toLowerCase())) continue;
    const isNotable = /[A-Z]/.test(clean[0]) || /[+#.]/.test(clean);
    if (isNotable) found.add(clean);
    if (found.size >= 12) break;
  }
  return [...found].slice(0, 12);
}

export function templateTailor(profile: Profile | undefined, job: Job): Tailoring {
  const skills = parseArr(profile?.skills);
  const title = profile?.title || 'professional';
  const years = profile?.experience_years || 0;
  const desc = job.description || '';

  const matchedSkills = skills.filter((s) => desc.toLowerCase().includes(s.toLowerCase()));
  const score = profile ? scoreJob({ ...job, match_score: 0 }, profile) : job.match_score || 60;
  const keywords = extractKeywords(desc, skills);

  const strengths: string[] = [];
  if (matchedSkills.length) {
    strengths.push(`Direct experience with ${matchedSkills.slice(0, 4).join(', ')}, which the role calls for.`);
  }
  if (years >= 3) strengths.push(`${years} years of experience as a ${title}.`);
  if (profile?.summary) strengths.push(profile.summary.split('.')[0] + '.');
  if (!strengths.length) strengths.push(`Background as a ${title} relevant to this role.`);

  const gaps: string[] = [];
  const missing = keywords.filter((k) => !skills.some((s) => s.toLowerCase() === k.toLowerCase())).slice(0, 2);
  if (missing.length) {
    gaps.push(`Consider highlighting any exposure to ${missing.join(' and ')} mentioned in the posting.`);
  }

  const resumeTips = [
    `Mirror the job title "${job.title}" in your resume summary so ATS systems match it.`,
    keywords.length
      ? `Weave these keywords into your bullets where true: ${keywords.slice(0, 6).join(', ')}.`
      : 'Mirror the exact technologies named in the posting in your skills section.',
    `Lead with a quantified achievement relevant to ${job.company} (impact, scale, or %).`,
    matchedSkills.length
      ? `Move ${matchedSkills.slice(0, 3).join(', ')} to the top of your skills list.`
      : 'Re-order your skills to put the most role-relevant ones first.',
  ];

  const coverLetter = [
    `Dear ${job.company} Hiring Team,`,
    '',
    `I'm excited to apply for the ${job.title} role at ${job.company}. As a ${title} with ${years ? `${years} years of` : 'hands-on'} experience, I was drawn to this opportunity because it aligns closely with my background${matchedSkills.length ? ` in ${matchedSkills.slice(0, 3).join(', ')}` : ''}.`,
    '',
    `${profile?.summary ? profile.summary + ' ' : ''}In my work I've focused on shipping reliable, high-impact software, and I'm confident I can bring that same focus to your team. The ${job.title} role stood out for the chance to contribute${job.location ? ` from ${job.location}` : ''} and grow alongside ${job.company}.`,
    '',
    `I'd welcome the chance to discuss how my experience maps to what you're building. Thank you for your consideration.`,
    '',
    'Sincerely,',
    'A motivated candidate',
  ].join('\n');

  return {
    match_summary: `You're a ${score >= 80 ? 'strong' : score >= 60 ? 'solid' : 'possible'} match for this ${job.title} role at ${job.company}${matchedSkills.length ? `, with overlapping skills in ${matchedSkills.slice(0, 3).join(', ')}` : ''}.`,
    match_score: score,
    strengths,
    gaps,
    ats_keywords: keywords,
    resume_tips: resumeTips,
    cover_letter: coverLetter,
  };
}
