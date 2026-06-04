import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../auth.js';
import { getWhatsappPrefs, upsertWhatsappPrefs } from '../db.js';
import { sendDigestNow } from '../notifications/scheduler.js';
import { whatsappConfigured } from '../notifications/whatsapp.js';
import { getEntitlements } from '../billing/entitlements.js';
import { config } from '../config.js';

const router = Router();
router.use(authMiddleware);

const PHONE_RE = /^\+\d{8,15}$/; // E.164, e.g. +919876543210

function serialize(prefs: ReturnType<typeof getWhatsappPrefs>) {
  return {
    phone: prefs?.phone ?? '',
    opted_in: Boolean(prefs?.opted_in),
    digest_hour: prefs?.digest_hour ?? config.digestDefaultHour,
    timezone: prefs?.timezone ?? config.digestTimezone,
    last_sent_date: prefs?.last_sent_date ?? null,
    provider_live: whatsappConfigured(), // false → mock mode
  };
}

// GET / - current WhatsApp notification preferences
router.get('/whatsapp', (req: Request, res: Response): void => {
  try {
    res.json({ prefs: serialize(getWhatsappPrefs(req.userId!)) });
  } catch (err) {
    console.error('Get whatsapp prefs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT / - update preferences (phone, opt-in, digest hour, timezone)
router.put('/whatsapp', (req: Request, res: Response): void => {
  try {
    const { phone, opted_in, digest_hour, timezone } = req.body ?? {};

    if (phone !== undefined && phone !== '' && !PHONE_RE.test(String(phone))) {
      res.status(400).json({
        error: 'Phone must be in international E.164 format, e.g. +919876543210',
      });
      return;
    }
    if (
      digest_hour !== undefined &&
      (!Number.isInteger(digest_hour) || digest_hour < 0 || digest_hour > 23)
    ) {
      res.status(400).json({ error: 'digest_hour must be an integer 0-23' });
      return;
    }
    if (opted_in && !phone && !getWhatsappPrefs(req.userId!)?.phone) {
      res.status(400).json({ error: 'Add a WhatsApp number before opting in' });
      return;
    }
    // WhatsApp daily digest is a Pro feature.
    if (opted_in && !getEntitlements(req.userId!).whatsapp) {
      res.status(402).json({
        error: 'WhatsApp daily digests are a Pro feature. Upgrade to enable them.',
        upgrade: true,
      });
      return;
    }

    const prefs = upsertWhatsappPrefs(req.userId!, {
      phone,
      opted_in: opted_in === undefined ? undefined : Boolean(opted_in),
      digest_hour,
      timezone,
    });
    res.json({ prefs: serialize(prefs) });
  } catch (err) {
    console.error('Update whatsapp prefs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /test - send a digest right now (great for verifying setup / demo)
router.post('/whatsapp/test', async (req: Request, res: Response): Promise<void> => {
  try {
    const outcome = await sendDigestNow(req.userId!);
    if (!outcome.ok) {
      res.status(400).json({ error: outcome.reason || 'Failed to send', ...outcome });
      return;
    }
    res.json({
      message: outcome.result?.mock
        ? 'Sent in mock mode (no WhatsApp credentials — message logged on server).'
        : 'WhatsApp digest sent!',
      mock: outcome.result?.mock ?? false,
      preview: outcome.preview,
      digest: outcome.digest,
    });
  } catch (err) {
    console.error('Test digest error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
