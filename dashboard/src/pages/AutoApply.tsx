import { useState, useEffect, type FormEvent } from 'react';
import { Zap, Shield, Loader2, ExternalLink, Play, Info, History } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import * as api from '../api/client';
import type { AutoApplyResult, AutoApplyRun } from '../api/client';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ItemRow({ item }: { item: api.AutoApplyItem }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-indigo-600">{item.company.charAt(0)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{item.title}</p>
        <p className="text-xs text-slate-500 truncate">
          {item.company} · {item.matchScore}% match
        </p>
      </div>
      <span
        className={clsx(
          'text-[10px] font-medium px-2 py-0.5 rounded-full capitalize',
          item.submitted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
        )}
      >
        {item.submitted ? 'submitted' : 'queued'}
      </span>
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-500 hover:text-indigo-700"
          title="Open apply page"
        >
          <ExternalLink size={15} />
        </a>
      )}
    </div>
  );
}

export default function AutoApply() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<'prepare' | 'auto'>('prepare');
  const [dailyCap, setDailyCap] = useState(10);
  const [minScore, setMinScore] = useState(65);
  const [liveSubmission, setLiveSubmission] = useState(false);

  const [lastResult, setLastResult] = useState<AutoApplyResult | null>(null);
  const [runs, setRuns] = useState<AutoApplyRun[]>([]);

  const loadRuns = async () => {
    try {
      setRuns(await api.getAutoApplyRuns());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const c = await api.getAutoApplyConfig();
        setEnabled(c.enabled);
        setMode(c.mode);
        setDailyCap(c.dailyCap);
        setMinScore(c.minScore);
        setLiveSubmission(c.liveSubmission);
      } catch {
        /* defaults */
      } finally {
        setLoading(false);
      }
      loadRuns();
    })();
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateAutoApplyConfig({ enabled, mode, dailyCap, minScore });
      toast.success('Auto-apply settings saved!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await api.runAutoApply();
      setLastResult(result);
      if (result.prepared > 0) {
        toast.success(`Prepared ${result.prepared} application${result.prepared > 1 ? 's' : ''}!`);
      } else {
        toast(result.message || 'No new eligible jobs to prepare', { icon: '🔍' });
      }
      loadRuns();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="skeleton h-8 w-48" />
        <div className="card p-6"><div className="skeleton h-24 w-full" /></div>
        <div className="card p-6"><div className="skeleton h-32 w-full" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <Zap size={22} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Auto-Apply Pipeline</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Let AI find your best matches, tailor each application, and queue them to submit.
          </p>
        </div>
      </div>

      {/* Safety posture banner */}
      <div className="flex items-start gap-2.5 rounded-xl bg-indigo-50 border border-indigo-100 p-3.5">
        <Shield size={18} className="text-indigo-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-indigo-900">
          <span className="font-semibold">Quality, not spam.</span> Auto-apply only targets
          direct-ATS boards (Greenhouse, Lever, Ashby) — never sites that prohibit automation.
          {!liveSubmission && (
            <>
              {' '}
              Live submission isn't connected yet, so applications are <strong>prepared and
              queued</strong> with a one-tap apply link — nothing is submitted on your behalf
              until you connect an authorized integration.
            </>
          )}
        </p>
      </div>

      {/* Settings */}
      <form onSubmit={handleSave} className="card p-6 space-y-5">
        <h3 className="text-lg font-semibold text-slate-900">Settings</h3>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50 transition-colors">
          <span>
            <span className="block text-sm font-medium text-slate-900">Enable auto-apply</span>
            <span className="block text-xs text-slate-500">Allow the pipeline to prepare applications for you.</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={clsx(
              'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors',
              enabled ? 'bg-indigo-500' : 'bg-slate-300'
            )}
          >
            <span
              className={clsx(
                'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5',
                enabled ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </button>
        </label>

        <div>
          <label className="label">Mode</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {([
              { v: 'prepare', t: 'Prepare for review', d: 'Queue tailored apps; you submit.' },
              { v: 'auto', t: 'Auto-submit', d: 'Submit automatically (needs integration).' },
            ] as const).map((o) => (
              <button
                type="button"
                key={o.v}
                onClick={() => setMode(o.v)}
                className={clsx(
                  'text-left rounded-xl border p-3 transition-all',
                  mode === o.v
                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200'
                    : 'border-slate-200 hover:bg-slate-50'
                )}
              >
                <span className="block text-sm font-medium text-slate-900">{o.t}</span>
                <span className="block text-xs text-slate-500">{o.d}</span>
              </button>
            ))}
          </div>
          {mode === 'auto' && !liveSubmission && (
            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
              <Info size={12} /> Until a live ATS integration is connected, Auto-submit behaves like Prepare.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Daily cap</label>
            <input
              type="number"
              min={1}
              max={50}
              value={dailyCap}
              onChange={(e) => setDailyCap(Number(e.target.value))}
              className="input-field"
            />
            <p className="text-xs text-slate-400 mt-1">Max applications prepared per day.</p>
          </div>
          <div>
            <label className="label">Minimum match score: {minScore}%</label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-indigo-500 mt-2"
            />
            <p className="text-xs text-slate-400 mt-1">Only apply to jobs scoring at or above this.</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 px-6">
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Run now */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold text-slate-900">Run now</h3>
          <button
            onClick={handleRun}
            disabled={running}
            className="btn-primary flex items-center gap-2"
          >
            {running ? <Loader2 size={18} className="animate-spin" /> : <Play size={16} />}
            {running ? 'Running…' : 'Run Auto-Apply'}
          </button>
        </div>
        <p className="text-sm text-slate-500">
          Finds your top unapplied direct-ATS matches, tailors each, and queues them.
        </p>

        {lastResult && (
          <div className="mt-4 rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-2">
              <span className="text-slate-900 font-semibold">{lastResult.prepared} prepared</span>
              <span className="text-slate-500">{lastResult.skipped} skipped</span>
              <span className="text-slate-500">{lastResult.remainingToday} left today</span>
            </div>
            {lastResult.message && <p className="text-sm text-slate-500">{lastResult.message}</p>}
            {lastResult.items.length > 0 && (
              <div className="divide-y divide-slate-100 mt-1">
                {lastResult.items.map((it, i) => (
                  <ItemRow key={i} item={it} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* History */}
      {runs.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <History size={18} className="text-slate-400" /> Recent runs
          </h3>
          <div className="space-y-2">
            {runs.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between text-sm py-2 border-b border-slate-50 last:border-0"
              >
                <span className="text-slate-700">
                  <span className="font-medium capitalize">{r.mode}</span> · {r.prepared} prepared
                </span>
                <span className="text-xs text-slate-400">{timeAgo(r.startedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
