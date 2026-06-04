import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Rocket, ArrowRight } from 'lucide-react';
import * as api from '../api/client';

interface Step {
  label: string;
  hint: string;
  done: boolean;
  to: string;
  cta: string;
}

export default function OnboardingChecklist({ applicationCount }: { applicationCount: number }) {
  const [profileDone, setProfileDone] = useState<boolean | null>(null);
  const [isPro, setIsPro] = useState<boolean | null>(null);

  useEffect(() => {
    api.getProfile().then((p) => setProfileDone(Boolean(p.title && (p.skills?.length ?? 0) > 0))).catch(() => setProfileDone(false));
    api.getBillingStatus().then((s) => setIsPro(s.plan === 'pro')).catch(() => setIsPro(false));
  }, []);

  // Wait until we know the state to avoid a flash.
  if (profileDone === null || isPro === null) return null;

  const steps: Step[] = [
    { label: 'Complete your profile', hint: 'Add your title and skills so AI can match you.', done: profileDone, to: '/profile', cta: 'Set up' },
    { label: 'Apply to your first job', hint: 'Search AI-matched roles and apply.', done: applicationCount > 0, to: '/jobs', cta: 'Find jobs' },
    { label: 'Unlock Pro features', hint: 'Unlimited tailoring, auto-apply, WhatsApp alerts.', done: isPro, to: '/billing', cta: 'See plans' },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null; // hide once fully onboarded

  const next = steps.find((s) => !s.done)!;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="card p-6 bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center">
            <Rocket size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Get started</h3>
            <p className="text-xs text-slate-500">{doneCount} of {steps.length} complete</p>
          </div>
        </div>
        <Link to={next.to} className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5">
          {next.cta} <ArrowRight size={14} />
        </Link>
      </div>

      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="space-y-2.5">
        {steps.map((s) => (
          <li key={s.label} className="flex items-start gap-2.5">
            {s.done ? (
              <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            ) : (
              <Circle size={18} className="text-slate-300 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <Link
                to={s.to}
                className={s.done ? 'text-sm text-slate-400 line-through' : 'text-sm font-medium text-slate-900 hover:text-indigo-600'}
              >
                {s.label}
              </Link>
              {!s.done && <p className="text-xs text-slate-500">{s.hint}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
