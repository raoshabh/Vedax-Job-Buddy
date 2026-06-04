import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../auth.js';
import { getSubscription, upsertSubscription, countUsageThisMonth } from '../db.js';
import { getEntitlements, PLAN_LIMITS } from '../billing/entitlements.js';
import { billingLive, createRazorpayOrder, verifyPaymentSignature } from '../billing/razorpay.js';
import { config } from '../config.js';

const router = Router();
router.use(authMiddleware);

function oneMonthFromNow(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

// GET /status - current plan, entitlements, usage
router.get('/status', (req: Request, res: Response): void => {
  try {
    const ent = getEntitlements(req.userId!);
    const sub = getSubscription(req.userId!);
    res.json({
      plan: ent.plan,
      status: sub?.status ?? 'active',
      current_period_end: sub?.current_period_end ?? null,
      entitlements: ent,
      limits: PLAN_LIMITS,
      usage: {
        tailors_this_month: countUsageThisMonth(req.userId!, 'tailor'),
      },
      billing_live: billingLive(),
      price_inr: config.proPriceInr,
    });
  } catch (err) {
    console.error('Billing status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /checkout - begin an upgrade. Live → Razorpay order; demo → mock signal.
router.post('/checkout', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!billingLive()) {
      res.json({ provider: 'mock' });
      return;
    }
    const order = await createRazorpayOrder(req.userId!);
    res.json({ provider: 'razorpay', order });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to start checkout' });
  }
});

// POST /verify - confirm a Razorpay Checkout payment (live), then grant Pro.
router.post('/verify', (req: Request, res: Response): void => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ error: 'Missing payment fields' });
      return;
    }
    if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      res.status(400).json({ error: 'Invalid payment signature' });
      return;
    }
    const sub = upsertSubscription(req.userId!, {
      plan: 'pro',
      status: 'active',
      current_period_end: oneMonthFromNow(),
      provider: 'razorpay',
      provider_ref: razorpay_payment_id,
    });
    res.json({ plan: sub.plan, status: sub.status, current_period_end: sub.current_period_end });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /activate - DEMO upgrade (only when billing is not live). Simulates a successful payment.
router.post('/activate', (req: Request, res: Response): void => {
  try {
    if (billingLive()) {
      res.status(400).json({ error: 'Billing is live — use checkout instead.' });
      return;
    }
    const sub = upsertSubscription(req.userId!, {
      plan: 'pro',
      status: 'active',
      current_period_end: oneMonthFromNow(),
      provider: 'mock',
      provider_ref: 'demo',
    });
    res.json({ plan: sub.plan, status: sub.status, current_period_end: sub.current_period_end, demo: true });
  } catch (err) {
    console.error('Activate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /cancel - downgrade to Free
router.post('/cancel', (req: Request, res: Response): void => {
  try {
    const sub = upsertSubscription(req.userId!, {
      plan: 'free',
      status: 'cancelled',
      current_period_end: null,
      provider_ref: null,
    });
    res.json({ plan: sub.plan, status: sub.status });
  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
