import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../auth.js';
import {
  getProfile,
  searchStoredJobs,
  getJob,
  getJobsStats,
  getTailoring,
  saveTailoring,
  logUsage,
  countUsageThisMonth,
  getInterviewPrep,
  saveInterviewPrep,
} from '../db.js';
import { ensureFreshJobs, ingestJobs } from '../jobs/ingest.js';
import { tailorApplication } from '../ai/tailor.js';
import { prepareInterview } from '../ai/interview.js';
import { aiEnabled } from '../ai/client.js';
import { getEntitlements } from '../billing/entitlements.js';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// GET /search - search real ingested jobs, ranked by profile match
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.query as string | undefined;
    const location = req.query.location as string | undefined;
    const salaryMin = req.query.salary_min ? Number(req.query.salary_min) : undefined;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 30;

    // Lazily ingest real jobs if the store is empty/stale (best-effort).
    await ensureFreshJobs(query);

    const profile = getProfile(req.userId!); // optional — used only for ranking
    const jobs = searchStoredJobs(profile, { query, location, salaryMin, limit });

    res.json({ jobs, total: jobs.length });
  } catch (err) {
    console.error('Search jobs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /refresh - force a fresh ingest from all providers
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.body?.query as string | undefined;
    const summary = await ingestJobs(query);
    const stats = getJobsStats();
    res.json({ summary, stored: stats.count });
  } catch (err) {
    console.error('Refresh jobs error:', err);
    res.status(500).json({ error: 'Failed to refresh jobs' });
  }
});

// GET /:id/tailor - fetch a cached AI tailoring (if any)
router.get('/:id/tailor', (req: Request, res: Response): void => {
  try {
    const cached = getTailoring(req.userId!, req.params.id as string);
    if (!cached) {
      res.json({ tailoring: null });
      return;
    }
    res.json({ tailoring: cached.data, source: cached.source, created_at: cached.created_at, cached: true });
  } catch (err) {
    console.error('Get tailoring error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/tailor - generate (or return cached) AI-tailored application
router.post('/:id/tailor', async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = req.params.id as string;
    const refresh = req.body?.refresh === true;

    const job = getJob(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    if (!refresh) {
      const cached = getTailoring(req.userId!, jobId);
      if (cached) {
        res.json({ tailoring: cached.data, source: cached.source, cached: true });
        return;
      }
    }

    // Freemium quota: generating a new/refreshed tailoring counts against the plan.
    const ent = getEntitlements(req.userId!);
    const used = countUsageThisMonth(req.userId!, 'tailor');
    if (ent.plan === 'free' && used >= ent.aiTailorsPerMonth) {
      res.status(402).json({
        error: `You've used all ${ent.aiTailorsPerMonth} AI tailorings on the Free plan this month. Upgrade to Pro for more.`,
        upgrade: true,
      });
      return;
    }

    const profile = getProfile(req.userId!);
    const { data, source } = await tailorApplication(profile, job);
    saveTailoring(req.userId!, jobId, data, source);
    logUsage(req.userId!, 'tailor');

    res.json({ tailoring: data, source, cached: false, ai_enabled: aiEnabled() });
  } catch (err) {
    console.error('Tailor error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id/interview - fetch cached interview prep (if any)
router.get('/:id/interview', (req: Request, res: Response): void => {
  try {
    const cached = getInterviewPrep(req.userId!, req.params.id as string);
    if (!cached) {
      res.json({ prep: null });
      return;
    }
    res.json({ prep: cached.data, source: cached.source, cached: true });
  } catch (err) {
    console.error('Get interview prep error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/interview - generate AI interview prep (Pro feature)
router.post('/:id/interview', async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = req.params.id as string;
    const refresh = req.body?.refresh === true;

    const job = getJob(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    if (!refresh) {
      const cached = getInterviewPrep(req.userId!, jobId);
      if (cached) {
        res.json({ prep: cached.data, source: cached.source, cached: true });
        return;
      }
    }

    // Interview prep is a Pro feature.
    if (!getEntitlements(req.userId!).interviewPrep) {
      res.status(402).json({ error: 'AI interview prep is a Pro feature. Upgrade to unlock it.', upgrade: true });
      return;
    }

    const profile = getProfile(req.userId!);
    const { data, source } = await prepareInterview(profile, job);
    saveInterviewPrep(req.userId!, jobId, data, source);

    res.json({ prep: data, source, cached: false });
  } catch (err) {
    console.error('Interview prep error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - get single job
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const job = getJob(req.params.id as string);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json({ job });
  } catch (err) {
    console.error('Get job error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
