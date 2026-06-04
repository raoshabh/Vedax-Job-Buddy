import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../auth.js';
import { getAnalytics } from '../db.js';

const router = Router();
router.use(authMiddleware);

// GET /overview - full analytics for the current user
router.get('/overview', (req: Request, res: Response): void => {
  try {
    res.json({ analytics: getAnalytics(req.userId!) });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
