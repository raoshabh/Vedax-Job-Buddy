import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../auth.js';
import {
  createApplication,
  getApplications,
  getApplication,
  updateApplicationStatus,
  getDashboardStats,
  getJob,
} from '../db.js';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// GET /stats - dashboard statistics
router.get('/stats', (req: Request, res: Response): void => {
  try {
    const stats = getDashboardStats(req.userId!);
    res.json({ stats });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET / - list all applications
router.get('/', (req: Request, res: Response): void => {
  try {
    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const applications = getApplications(req.userId!, status, limit, offset);
    res.json({ applications, total: applications.length });
  } catch (err) {
    console.error('Get applications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create application
router.post('/', (req: Request, res: Response): void => {
  try {
    const { job_id, notes } = req.body;

    if (!job_id) {
      res.status(400).json({ error: 'job_id is required' });
      return;
    }

    const job = getJob(job_id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const application = createApplication(req.userId!, job_id, notes);
    res.status(201).json({ application });
  } catch (err) {
    console.error('Create application error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id/status - update application status
router.put('/:id/status', (req: Request, res: Response): void => {
  try {
    const { status, notes } = req.body;
    const validStatuses = ['queued', 'applied', 'screening', 'interview', 'offer', 'rejected'];

    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const existing = getApplication(req.params.id as string);
    if (!existing) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    if (existing.user_id !== req.userId) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const application = updateApplicationStatus(req.params.id as string, status, notes);
    res.json({ application });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - get single application
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const application = getApplication(req.params.id as string);
    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    if (application.user_id !== req.userId) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    res.json({ application });
  } catch (err) {
    console.error('Get application error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
