/**
 * Plan entitlements. The single source of truth for what Free vs Pro can do.
 * A subscription counts as "pro" only when active and not past its period end.
 */
import { getSubscription } from '../db.js';

export type Plan = 'free' | 'pro';

export interface Entitlements {
  plan: Plan;
  aiTailorsPerMonth: number;
  autoApplyDailyCap: number;
  whatsapp: boolean;
  interviewPrep: boolean;
}

export const PLAN_LIMITS: Record<Plan, Omit<Entitlements, 'plan'>> = {
  free: { aiTailorsPerMonth: 5, autoApplyDailyCap: 3, whatsapp: false, interviewPrep: false },
  pro: { aiTailorsPerMonth: 1000, autoApplyDailyCap: 25, whatsapp: true, interviewPrep: true },
};

export function getPlan(userId: string): Plan {
  const sub = getSubscription(userId);
  if (!sub || sub.plan !== 'pro' || sub.status !== 'active') return 'free';
  if (sub.current_period_end && new Date(sub.current_period_end).getTime() < Date.now()) {
    return 'free';
  }
  return 'pro';
}

export function getEntitlements(userId: string): Entitlements {
  const plan = getPlan(userId);
  return { plan, ...PLAN_LIMITS[plan] };
}
