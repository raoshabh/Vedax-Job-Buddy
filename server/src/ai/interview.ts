/**
 * AI interview prep. Given a job + candidate profile, generate an interview
 * overview, prep topics, likely questions (with answer tips), and smart
 * questions for the candidate to ask. Same architecture as ai/tailor.ts:
 * Claude via messages.create + JSON-schema output, validated with Zod 3,
 * with a deterministic template fallback when ANTHROPIC_API_KEY is absent.
 */
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropic } from './client.js';
import { config } from '../config.js';
import type { Job, Profile } from '../types.js';

export const InterviewSchema = z.object({
  overview: z.string(),
  prep_topics: z.array(z.string()),
  questions: z.array(z.object({ question: z.string(), category: z.string(), tip: z.string() })),
  questions_to_ask: z.array(z.string()),
});

export type InterviewPrep = z.infer<typeof InterviewSchema>;
export type PrepSource = 'ai' | 'template';

const INTERVIEW_JSON_SCHEMA = {
  type: 'object',
  properties: {
    overview: { type: 'string', description: 'What to expect in this interview process (2-3 sentences)' },
    prep_topics: {
      type: 'array',
      items: { type: 'string' },
      description: '4-6 specific topics/skills to brush up on for this role',
    },
    questions: {
      type: 'array',
      description: '6-8 likely interview questions with an answer tip for each',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          category: { type: 'string', description: 'behavioral | technical | role' },
          tip: { type: 'string', description: 'A concrete tip for answering well, grounded in the profile' },
        },
        required: ['question', 'category', 'tip'],
        additionalProperties: false,
      },
    },
    questions_to_ask: {
      type: 'array',
      items: { type: 'string' },
      description: '3-4 thoughtful questions the candidate should ask the interviewer',
    },
  },
  required: ['overview', 'prep_topics', 'questions', 'questions_to_ask'],
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

const INSTRUCTIONS = `You are an expert interview coach. Given a CANDIDATE PROFILE and a JOB, prepare the candidate for interviews at that company/role.

Rules:
- Tailor questions to the specific role and seniority. Mix behavioral, technical, and role-specific.
- Each answer tip must be concrete and grounded in the candidate's actual profile (skills/experience). Never invent experience.
- prep_topics are specific (e.g. "System design for high-throughput services"), not generic.
- questions_to_ask should be thoughtful and signal genuine interest.
- Return ONLY the structured fields.`;

function buildProfileText(profile: Profile): string {
  return [
    '# CANDIDATE PROFILE',
    `Title: ${profile.title || 'Not specified'}`,
    `Experience: ${profile.experience_years || 0} years`,
    `Skills: ${parseArr(profile.skills).join(', ') || 'Not specified'}`,
    `Summary: ${profile.summary || 'Not provided'}`,
  ].join('\n');
}

function buildJobText(job: Job): string {
  return [
    `Prepare me for an interview for this job:`,
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location}`,
    '',
    'Job description:',
    job.description || '(no description provided)',
  ].join('\n');
}

export async function prepareInterview(
  profile: Profile | undefined,
  job: Job
): Promise<{ data: InterviewPrep; source: PrepSource }> {
  const client = getAnthropic();
  if (!client || !profile) {
    return { data: templatePrep(profile, job), source: 'template' };
  }

  try {
    const res = await client.messages.create({
      model: config.anthropicModel,
      max_tokens: 8000,
      system: [
        { type: 'text', text: INSTRUCTIONS },
        { type: 'text', text: buildProfileText(profile), cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: buildJobText(job) }],
      output_config: {
        format: { type: 'json_schema', schema: INTERVIEW_JSON_SCHEMA },
        effort: config.anthropicEffort,
      },
    } as Anthropic.MessageCreateParamsNonStreaming);

    const textBlock = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const validated = InterviewSchema.safeParse(JSON.parse(textBlock?.text ?? ''));
    if (validated.success) {
      return { data: validated.data, source: 'ai' };
    }
    return { data: templatePrep(profile, job), source: 'template' };
  } catch (err) {
    console.error('[interview] AI failed, using template:', err instanceof Error ? err.message : err);
    return { data: templatePrep(profile, job), source: 'template' };
  }
}

// ── Deterministic template fallback ──

export function templatePrep(profile: Profile | undefined, job: Job): InterviewPrep {
  const skills = parseArr(profile?.skills);
  const top = skills.slice(0, 4);
  return {
    overview: `Expect a mix of behavioral and technical rounds for the ${job.title} role at ${job.company}. Be ready to discuss your experience${top.length ? ` with ${top.join(', ')}` : ''} and how it maps to the role.`,
    prep_topics: top.length
      ? [...top.map((s) => `Deepen your ${s} examples with concrete outcomes`), 'System design / problem-solving walkthrough', `Why ${job.company}? — research their product & mission`]
      : ['Core concepts for your field', 'Behavioral stories (STAR format)', `Why ${job.company}?`],
    questions: [
      { question: `Tell me about yourself and why you're interested in the ${job.title} role.`, category: 'behavioral', tip: 'Lead with a 60-second pitch tying your background to this role; end with why this company.' },
      { question: 'Describe a challenging project and how you handled it.', category: 'behavioral', tip: 'Use STAR (Situation, Task, Action, Result). Quantify the result.' },
      { question: top[0] ? `Walk me through a problem you solved using ${top[0]}.` : 'Walk me through a technical problem you solved.', category: 'technical', tip: 'Pick a real example; explain trade-offs you weighed.' },
      { question: 'How do you handle disagreements with teammates?', category: 'behavioral', tip: 'Show you seek understanding first, then data-driven resolution.' },
      { question: `What interests you about ${job.company} specifically?`, category: 'role', tip: 'Reference something specific about their product, scale, or mission.' },
      { question: 'Where do you see the biggest risk in a project like ours?', category: 'role', tip: 'Demonstrate systems thinking and pragmatism.' },
    ],
    questions_to_ask: [
      'What does success look like in the first 90 days?',
      'How does the team make technical decisions?',
      `What's the biggest challenge the team is facing right now?`,
      'How do you support growth and learning here?',
    ],
  };
}
