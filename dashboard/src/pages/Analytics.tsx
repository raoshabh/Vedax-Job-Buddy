import { useState, useEffect } from 'react';
import { TrendingUp, Users, Trophy, Clock, BarChart3 } from 'lucide-react';
import clsx from 'clsx';
import * as api from '../api/client';
import type { Analytics as AnalyticsData } from '../api/client';

const STAGE_COLORS: Record<string, string> = {
  queued: 'bg-slate-400',
  applied: 'bg-blue-500',
  screening: 'bg-amber-500',
  interview: 'bg-purple-500',
  offer: 'bg-emerald-500',
  rejected: 'bg-rose-500',
};

function Kpi({ label, value, icon: Icon, suffix }: { label: string; value: number | string; icon: typeof TrendingUp; suffix?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <Icon size={16} className="text-indigo-400" />
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-2">
        {value}
        {suffix && <span className="text-base font-medium text-slate-400">{suffix}</span>}
      </p>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setData(await api.getAnalytics());
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-40" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="card p-5"><div className="skeleton h-16 w-full" /></div>)}
        </div>
        <div className="card p-6"><div className="skeleton h-48 w-full" /></div>
      </div>
    );
  }

  const empty = data.totals.applications === 0;
  const funnelMax = Math.max(1, ...data.funnel.map((f) => f.count));
  const timeMax = Math.max(1, ...data.overTime.map((d) => d.count));
  const sourceMax = Math.max(1, ...data.bySource.map((s) => s.count));
  const companyMax = Math.max(1, ...data.topCompanies.map((c) => c.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Insights into your job search performance.</p>
      </div>

      {empty ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BarChart3 size={28} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No data yet</h3>
          <p className="text-sm text-slate-500">Apply to a few jobs and your analytics will appear here.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Response rate" value={data.responseRate} suffix="%" icon={TrendingUp} />
            <Kpi label="Interview rate" value={data.interviewRate} suffix="%" icon={Users} />
            <Kpi label="Offers" value={data.totals.offers} icon={Trophy} />
            <Kpi label="Avg. response" value={data.avgDaysToResponse} suffix="d" icon={Clock} />
          </div>

          {/* Funnel */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Application funnel</h3>
            <div className="space-y-3">
              {data.funnel.map((f) => (
                <div key={f.stage} className="flex items-center gap-3">
                  <span className="w-20 text-xs font-medium text-slate-500 capitalize flex-shrink-0">
                    {f.stage}
                  </span>
                  <div className="flex-1 h-7 bg-slate-50 rounded-lg overflow-hidden">
                    <div
                      className={clsx('h-full rounded-lg transition-all flex items-center justify-end px-2', STAGE_COLORS[f.stage])}
                      style={{ width: `${Math.max(f.count > 0 ? 8 : 0, (f.count / funnelMax) * 100)}%` }}
                    >
                      {f.count > 0 && <span className="text-xs font-bold text-white">{f.count}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Applications over time */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Applications · last 14 days</h3>
            <div className="flex items-end gap-1.5 h-32">
              {data.overTime.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1 group">
                  <div className="relative w-full flex items-end justify-center" style={{ height: '100%' }}>
                    <div
                      className="w-full max-w-[28px] bg-indigo-500 rounded-t-md transition-all group-hover:bg-indigo-600"
                      style={{ height: `${(d.count / timeMax) * 100}%`, minHeight: d.count > 0 ? '6px' : '0' }}
                      title={`${d.date}: ${d.count}`}
                    />
                  </div>
                  <span className="text-[9px] text-slate-400">{d.date.slice(8)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sources + companies */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">By source</h3>
              <div className="space-y-3">
                {data.bySource.map((s) => (
                  <div key={s.source}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700">{s.source}</span>
                      <span className="text-slate-400">{s.count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(s.count / sourceMax) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Top companies</h3>
              {data.topCompanies.length === 0 ? (
                <p className="text-sm text-slate-400">No companies yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.topCompanies.map((c) => (
                    <div key={c.company}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700 truncate pr-2">{c.company}</span>
                        <span className="text-slate-400 flex-shrink-0">{c.count}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(c.count / companyMax) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
