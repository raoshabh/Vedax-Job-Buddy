import { useState, useEffect } from 'react';
import { Check, Sparkles, Loader2, Crown, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import * as api from '../api/client';
import type { BillingStatus } from '../api/client';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function Plans() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setStatus(await api.getBillingStatus());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpgrade = async () => {
    setBusy(true);
    try {
      const checkout = await api.startCheckout();
      if (checkout.provider === 'mock') {
        await api.activateDemo();
        toast.success('Upgraded to Pro! (demo mode)');
        await load();
        return;
      }
      // Live Razorpay checkout
      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay || !checkout.order) {
        toast.error('Could not load the payment window. Please try again.');
        return;
      }
      const rzp = new window.Razorpay({
        key: checkout.order.key_id,
        amount: checkout.order.amount,
        currency: checkout.order.currency,
        name: 'Vedax Job Buddy',
        description: 'Pro plan — 1 month',
        order_id: checkout.order.id,
        handler: async (resp: Record<string, string>) => {
          try {
            await api.verifyPayment({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            toast.success('Welcome to Pro! 🎉');
            await load();
          } catch {
            toast.error('Payment verification failed.');
          }
        },
        theme: { color: '#6366F1' },
      });
      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upgrade failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      await api.cancelPlan();
      toast.success('Switched to Free plan.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !status) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="skeleton h-8 w-48" />
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card p-6"><div className="skeleton h-64 w-full" /></div>
          <div className="card p-6"><div className="skeleton h-64 w-full" /></div>
        </div>
      </div>
    );
  }

  const isPro = status.plan === 'pro';
  const freeFeatures = [
    `${status.limits.free.aiTailorsPerMonth} AI tailorings / month`,
    `${status.limits.free.autoApplyDailyCap} auto-apply / day`,
    'Job search & tracking',
    'Application pipeline',
  ];
  const proFeatures = [
    `${status.limits.pro.aiTailorsPerMonth}+ AI tailorings / month`,
    `${status.limits.pro.autoApplyDailyCap} auto-apply / day`,
    'WhatsApp daily digest',
    'AI interview prep',
    'Priority matching',
    'Everything in Free',
  ];

  const usagePct = Math.min(
    100,
    Math.round((status.tailorsThisMonth / status.limits.free.aiTailorsPerMonth) * 100)
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Plans & Billing</h1>
        <p className="text-sm text-slate-500 mt-1">
          You're on the <span className="font-semibold capitalize">{status.plan}</span> plan
          {isPro && status.currentPeriodEnd
            ? ` · renews ${new Date(status.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : ''}
          .
        </p>
      </div>

      {!status.billingLive && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 p-3.5">
          <Info size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Demo billing.</span> Razorpay isn't connected, so
            upgrades are simulated instantly. Add Razorpay keys on the server to take real payments.
          </p>
        </div>
      )}

      {/* Free-plan usage meter */}
      {!isPro && (
        <div className="card p-5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-slate-700">AI tailorings this month</span>
            <span className="text-slate-500">
              {status.tailorsThisMonth} / {status.limits.free.aiTailorsPerMonth}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all', usagePct >= 100 ? 'bg-rose-500' : 'bg-indigo-500')}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Free */}
        <div className={clsx('card p-6 flex flex-col', !isPro && 'ring-2 ring-indigo-200')}>
          <h3 className="text-lg font-bold text-slate-900">Free</h3>
          <p className="mt-1 mb-4">
            <span className="text-3xl font-bold text-slate-900">₹0</span>
            <span className="text-sm text-slate-500"> / month</span>
          </p>
          <ul className="space-y-2 flex-1">
            {freeFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                <Check size={15} className="text-slate-400 mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-5">
            {isPro ? (
              <button onClick={handleCancel} disabled={busy} className="btn-secondary w-full">
                Switch to Free
              </button>
            ) : (
              <div className="text-center text-sm font-medium text-indigo-600 py-2">Current plan</div>
            )}
          </div>
        </div>

        {/* Pro */}
        <div
          className={clsx(
            'card p-6 flex flex-col relative overflow-hidden',
            isPro ? 'ring-2 ring-indigo-400' : 'border-indigo-200'
          )}
        >
          <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
            POPULAR
          </div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
            <Crown size={18} className="text-amber-500" /> Pro
          </h3>
          <p className="mt-1 mb-4">
            <span className="text-3xl font-bold text-slate-900">₹{status.priceInr}</span>
            <span className="text-sm text-slate-500"> / month</span>
          </p>
          <ul className="space-y-2 flex-1">
            {proFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                <Check size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-5">
            {isPro ? (
              <div className="text-center text-sm font-medium text-indigo-600 py-2 flex items-center justify-center gap-1.5">
                <Sparkles size={15} /> Current plan
              </div>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={busy}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Crown size={16} />}
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Cancel anytime · No long-term lock-in · Pause when you land the job
      </p>
    </div>
  );
}
