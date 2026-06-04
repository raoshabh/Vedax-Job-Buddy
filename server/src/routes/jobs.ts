import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../auth.js';
import { getProfile, searchStoredJobs, getJob, getJobsStats } from '../db.js';
import { ensureFreshJobs, ingestJobs } from '../jobs/ingest.js';

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
