import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../auth.js';
import { getAutoApplyConfig, upsertAutoApplyConfig, getAutoApplyRuns } from '../db.js';
import { runAutoApply } from '../autoapply/worker.js';
import { LIVE_SUBMISSION_ENABLED } from '../autoapply/submit.js';
import { config } from '../config.js';

const router = Router();
router.use(authMiddleware);

function serialize(c: ReturnType<typeof getAutoApplyConfig>) {
  return {
    enabled: Boolean(c?.enabled),
    mode: c?.mode ?? 'prepare',
    daily_cap: c?.daily_cap ?? config.autoApplyDailyCap,
    min_score: c?.min_score ?? config.autoApplyMinScore,
    live_submission: LIVE_SUBMISSION_ENABLED,
    eligible_sources: config.autoApplySources,
  };
}

// GET /config
router.get('/config', (req: Request, res: Response): void => {
  try {
    res.json({ config: serialize(getAutoApplyConfig(req.userId!)) });
  } catch (err) {
    console.error('Get auto-apply config error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /config
router.put('/config', (req: Request, res: Response): void => {
  try {
    const { enabled, mode, daily_cap, min_score } = req.body ?? {};
    if (mode !== undefined && mode !== 'prepare' && mode !== 'auto') {
      res.status(400).json({ error: "mode must be 'prepare' or 'auto'" });
      return;
    }
    if (daily_cap !== undefined && (!Number.isInteger(daily_cap) || daily_cap < 1 || daily_cap > 50)) {
      res.status(400).json({ error: 'daily_cap must be an integer 1-50' });
      return;
    }
    if (min_score !== undefined && (!Number.isInteger(min_score) || min_score < 0 || min_score > 100)) {
      res.status(400).json({ error: 'min_score must be an integer 0-100' });
      return;
    }
    const updated = upsertAutoApplyConfig(req.userId!, {
      enabled: enabled === undefined ? undefined : Boolean(enabled),
      mode,
      daily_cap,
      min_score,
    });
    res.json({ config: serialize(updated) });
  } catch (err) {
    console.error('Update auto-apply config error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /run - trigger an auto-apply run now
router.post('/run', async (req: Request, res: Response): Promise<void> => {
  try {
    const max = req.body?.max !== undefined ? Number(req.body.max) : undefined;
    const result = await runAutoApply(req.userId!, { max });
    res.json({ result });
  } catch (err) {
    console.error('Auto-apply run error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /runs - recent run history (audit)
router.get('/runs', (req: Request, res: Response): void => {
  try {
    const runs = getAutoApplyRuns(req.userId!, 10).map((r) => ({
      id: r.id,
      mode: r.mode,
      requested: r.requested,
      prepared: r.prepared,
      skipped: r.skipped,
      started_at: r.started_at,
      items: (() => {
        try {
          return JSON.parse(r.summary || '[]');
        } catch {
          return [];
        }
      })(),
    }));
    res.json({ runs });
  } catch (err) {
    console.error('Get auto-apply runs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
