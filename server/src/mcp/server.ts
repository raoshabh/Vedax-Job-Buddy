import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  initDb,
  getOrCreateDefaultUser,
  getProfile,
  upsertProfile,
  searchStoredJobs,
  createApplication,
  getApplications,
  getApplication,
  updateApplicationStatus,
  getDashboardStats,
  getAppliedJobIds,
  upsertWhatsappPrefs,
  getJob,
  saveTailoring,
  saveInterviewPrep,
} from '../db.js';
import { ensureFreshJobs } from '../jobs/ingest.js';
import { sendDigestNow } from '../notifications/scheduler.js';
import { tailorApplication } from '../ai/tailor.js';
import { prepareInterview } from '../ai/interview.js';
import { runAutoApply } from '../autoapply/worker.js';

const server = new McpServer({
  name: 'vedax-job-buddy',
  version: '1.0.0',
});

function getDefaultUserId(): string {
  return getOrCreateDefaultUser().id;
}

// ── jobtracker_setup_profile ──
server.tool(
  'jobtracker_setup_profile',
  'Create or update the job seeker profile with title, preferred cities, salary range, experience, skills, and summary.',
  {
    title: z.string().describe('Job title, e.g. "Senior Software Engineer"'),
    cities: z.array(z.string()).describe('Preferred cities, e.g. ["San Francisco", "Remote"]'),
    salary_min: z.number().describe('Minimum desired salary (USD annual)'),
    salary_max: z.number().describe('Maximum desired salary (USD annual)'),
    experience_years: z.number().describe('Years of professional experience'),
    skills: z.array(z.string()).describe('Technical skills, e.g. ["TypeScript", "React", "Node.js"]'),
    summary: z.string().describe('Brief professional summary'),
  },
  { destructiveHint: false, readOnlyHint: false },
  async (params) => {
    const userId = getDefaultUserId();
    const profile = upsertProfile(userId, {
      title: params.title,
      cities: JSON.stringify(params.cities),
      salary_min: params.salary_min,
      salary_max: params.salary_max,
      experience_years: params.experience_years,
      skills: JSON.stringify(params.skills),
      summary: params.summary,
    });

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          message: 'Profile updated successfully',
          profile: {
            ...profile,
            cities: JSON.parse(profile.cities),
            skills: JSON.parse(profile.skills),
          },
        }, null, 2),
      }],
    };
  }
);

// ── jobtracker_search_jobs ──
server.tool(
  'jobtracker_search_jobs',
  'Search for matching job listings based on the user profile and optional filters. Returns jobs with match scores.',
  {
    query: z.string().optional().describe('Search query to filter job titles/descriptions'),
    location: z.string().optional().describe('Filter by location'),
    salary_min: z.number().optional().describe('Minimum salary filter'),
    limit: z.number().default(10).describe('Maximum number of results (default 10)'),
  },
  { readOnlyHint: true },
  async (params) => {
    const userId = getDefaultUserId();
    const profile = getProfile(userId);

    if (!profile) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: 'No profile found. Please set up your profile first using jobtracker_setup_profile.' }),
        }],
        isError: true,
      };
    }

    await ensureFreshJobs(params.query);
    const jobs = searchStoredJobs(profile, {
      query: params.query,
      location: params.location,
      salaryMin: params.salary_min,
      limit: params.limit,
    });

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          total: jobs.length,
          jobs: jobs.map(j => ({
            id: j.id,
            title: j.title,
            company: j.company,
            location: j.location,
            salary_range: `$${j.salary_min.toLocaleString()} - $${j.salary_max.toLocaleString()}`,
            match_score: j.match_score,
            source: j.source,
            posted_at: j.posted_at,
            url: j.url,
          })),
        }, null, 2),
      }],
    };
  }
);

// ── jobtracker_apply_to_job ──
server.tool(
  'jobtracker_apply_to_job',
  'Create a job application for a specific job listing.',
  {
    job_id: z.string().describe('The ID of the job to apply to'),
    notes: z.string().optional().describe('Optional notes for the application'),
  },
  { destructiveHint: false },
  async (params) => {
    const userId = getDefaultUserId();

    try {
      const application = createApplication(userId, params.job_id, params.notes);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: `Application created for ${application.job?.title || 'job'} at ${application.job?.company || 'company'}`,
            application: {
              id: application.id,
              status: application.status,
              job: application.job ? {
                title: application.job.title,
                company: application.job.company,
                location: application.job.location,
              } : null,
              applied_at: application.applied_at,
            },
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: `Failed to create application: ${err instanceof Error ? err.message : String(err)}` }),
        }],
        isError: true,
      };
    }
  }
);

// ── jobtracker_list_applications ──
server.tool(
  'jobtracker_list_applications',
  'List job applications with optional status filter and pagination.',
  {
    status: z.enum(['queued', 'applied', 'screening', 'interview', 'offer', 'rejected']).optional().describe('Filter by application status'),
    limit: z.number().default(20).describe('Maximum number of results (default 20)'),
    offset: z.number().default(0).describe('Pagination offset (default 0)'),
  },
  { readOnlyHint: true },
  async (params) => {
    const userId = getDefaultUserId();
    const applications = getApplications(userId, params.status, params.limit, params.offset);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          total: applications.length,
          applications: applications.map(a => ({
            id: a.id,
            status: a.status,
            job: a.job ? {
              title: a.job.title,
              company: a.job.company,
              location: a.job.location,
              match_score: a.job.match_score,
            } : null,
            applied_at: a.applied_at,
            updated_at: a.updated_at,
            notes: a.notes,
          })),
        }, null, 2),
      }],
    };
  }
);

// ── jobtracker_update_application_status ──
server.tool(
  'jobtracker_update_application_status',
  'Update the status of an existing job application.',
  {
    application_id: z.string().describe('The ID of the application to update'),
    status: z.enum(['queued', 'applied', 'screening', 'interview', 'offer', 'rejected']).describe('New status'),
    notes: z.string().optional().describe('Optional notes about the status change'),
  },
  { destructiveHint: false },
  async (params) => {
    const existing = getApplication(params.application_id);
    if (!existing) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: 'Application not found' }),
        }],
        isError: true,
      };
    }

    const application = updateApplicationStatus(params.application_id, params.status, params.notes);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          message: `Application status updated to '${params.status}'`,
          application: application ? {
            id: application.id,
            status: application.status,
            job: application.job ? {
              title: application.job.title,
              company: application.job.company,
            } : null,
            updated_at: application.updated_at,
          } : null,
        }, null, 2),
      }],
    };
  }
);

// ── jobtracker_get_dashboard ──
server.tool(
  'jobtracker_get_dashboard',
  'Get a full dashboard overview including stats, pipeline breakdown, and recent activity.',
  {},
  { readOnlyHint: true },
  async () => {
    const userId = getDefaultUserId();
    const stats = getDashboardStats(userId);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          dashboard: {
            total_applications: stats.total_applications,
            pipeline: stats.by_status,
            response_rate: `${stats.response_rate}%`,
            interviews_scheduled: stats.interviews_scheduled,
            offers_received: stats.offers_received,
            recent_activity: stats.recent_activity.map(a => ({
              type: a.type,
              description: a.description,
              timestamp: a.timestamp,
            })),
          },
        }, null, 2),
      }],
    };
  }
);

// ── jobtracker_auto_apply ──
server.tool(
  'jobtracker_auto_apply',
  'Run the auto-apply pipeline: find the top matching DIRECT-ATS jobs (Greenhouse/Lever/Ashby), auto-tailor each, and queue them ready to submit. Skips already-applied jobs and respects the daily cap and match-score floor. Submission is dry-run (prepared) until a live ATS integration is configured.',
  {
    max_applications: z.number().default(5).describe('Maximum number of applications to prepare this run (capped by daily limit)'),
  },
  { destructiveHint: false },
  async (params) => {
    const userId = getDefaultUserId();
    await ensureFreshJobs();
    const result = await runAutoApply(userId, { max: params.max_applications });

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          mode: result.mode,
          live_submission: result.live,
          prepared: result.prepared,
          skipped: result.skipped,
          remaining_today: result.remaining_today,
          message: result.message,
          items: result.items.map(i => ({
            job: i.title,
            company: i.company,
            source: i.source,
            match_score: i.match_score,
            status: i.status,
            submitted: i.submitted,
            apply_url: i.url,
          })),
        }, null, 2),
      }],
    };
  }
);

// ── jobtracker_tailor_application ──
server.tool(
  'jobtracker_tailor_application',
  'Generate an AI-tailored application for a specific job: a personalized cover letter, resume tips, ATS keywords, and a match analysis based on the user profile.',
  {
    job_id: z.string().describe('The ID of the job to tailor an application for'),
  },
  { destructiveHint: false, readOnlyHint: false },
  async (params) => {
    const userId = getDefaultUserId();
    const job = getJob(params.job_id);
    if (!job) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Job not found' }) }],
        isError: true,
      };
    }

    const profile = getProfile(userId);
    const { data, source } = await tailorApplication(profile, job);
    saveTailoring(userId, params.job_id, data, source);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          source, // 'ai' or 'template'
          job: { title: job.title, company: job.company },
          tailoring: data,
        }, null, 2),
      }],
    };
  }
);

// ── jobtracker_interview_prep ──
server.tool(
  'jobtracker_interview_prep',
  'Generate AI interview preparation for a specific job: an overview, prep topics, likely questions with answer tips, and smart questions to ask the interviewer.',
  {
    job_id: z.string().describe('The ID of the job to prepare for'),
  },
  { destructiveHint: false, readOnlyHint: false },
  async (params) => {
    const userId = getDefaultUserId();
    const job = getJob(params.job_id);
    if (!job) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Job not found' }) }],
        isError: true,
      };
    }
    const profile = getProfile(userId);
    const { data, source } = await prepareInterview(profile, job);
    saveInterviewPrep(userId, params.job_id, data, source);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ success: true, source, job: { title: job.title, company: job.company }, prep: data }, null, 2),
      }],
    };
  }
);

// ── jobtracker_setup_whatsapp ──
server.tool(
  'jobtracker_setup_whatsapp',
  'Configure WhatsApp daily-digest notifications: set the phone number, opt-in, and preferred send hour.',
  {
    phone: z.string().describe('WhatsApp number in E.164 format, e.g. +919876543210'),
    opt_in: z.boolean().default(true).describe('Enable the daily digest'),
    digest_hour: z.number().min(0).max(23).default(20).describe('Local hour (0-23) to send the digest'),
  },
  { destructiveHint: false, readOnlyHint: false },
  async (params) => {
    const userId = getDefaultUserId();
    const prefs = upsertWhatsappPrefs(userId, {
      phone: params.phone,
      opted_in: params.opt_in,
      digest_hour: params.digest_hour,
    });
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          message: 'WhatsApp notifications configured',
          prefs: { phone: prefs.phone, opted_in: Boolean(prefs.opted_in), digest_hour: prefs.digest_hour, timezone: prefs.timezone },
        }, null, 2),
      }],
    };
  }
);

// ── jobtracker_send_whatsapp_digest ──
server.tool(
  'jobtracker_send_whatsapp_digest',
  "Send the user's job-search digest to their configured WhatsApp number right now.",
  {},
  { destructiveHint: false },
  async () => {
    const userId = getDefaultUserId();
    const outcome = await sendDigestNow(userId);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: outcome.ok,
          mock: outcome.result?.mock ?? false,
          reason: outcome.reason,
          digest: outcome.digest,
          preview: outcome.preview,
        }, null, 2),
      }],
      isError: !outcome.ok,
    };
  }
);

// ── Start server ──
async function main() {
  await initDb();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Vedax Job Buddy MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
