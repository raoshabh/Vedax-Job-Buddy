import { useState, useEffect, type FormEvent } from 'react';
import { MessageCircle, Send, Clock, Info, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../api/client';
import type { TestDigestResult } from '../api/client';

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Dubai', label: 'Gulf (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'America/New_York', label: 'New York (ET)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
];

function formatHour(h: number): string {
  const period = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${period}`;
}

export default function Notifications() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [phone, setPhone] = useState('');
  const [optedIn, setOptedIn] = useState(false);
  const [digestHour, setDigestHour] = useState(20);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [providerLive, setProviderLive] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [preview, setPreview] = useState<TestDigestResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await api.getWhatsappPrefs();
        setPhone(p.phone);
        setOptedIn(p.optedIn);
        setDigestHour(p.digestHour);
        setTimezone(p.timezone);
        setProviderLive(p.providerLive);
        setLastSent(p.lastSentDate);
      } catch {
        /* defaults */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (optedIn && !/^\+\d{8,15}$/.test(phone)) {
      toast.error('Enter a valid number in international format, e.g. +919876543210');
      return;
    }
    setSaving(true);
    try {
      const p = await api.updateWhatsappPrefs({ phone, optedIn, digestHour, timezone });
      setProviderLive(p.providerLive);
      toast.success('Notification preferences saved!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!/^\+\d{8,15}$/.test(phone)) {
      toast.error('Add and save a valid WhatsApp number first');
      return;
    }
    setTesting(true);
    try {
      const result = await api.sendTestDigest();
      setPreview(result);
      setLastSent(result.digest.date);
      toast.success(result.mock ? 'Test digest generated (mock mode)' : 'WhatsApp digest sent!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send test');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="skeleton h-8 w-56" />
        {[...Array(2)].map((_, i) => (
          <div key={i} className="card p-6">
            <div className="skeleton h-6 w-40 mb-4" />
            <div className="skeleton h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <MessageCircle size={22} className="text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Get a daily digest of your job search — applications, interviews, and progress.
          </p>
        </div>
      </div>

      {/* Mock-mode banner */}
      {!providerLive && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 p-3.5">
          <Info size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Preview mode.</span> No WhatsApp provider is
            connected yet, so test digests are generated and logged on the server (not actually
            delivered). Add Meta Cloud API credentials on the server to go live.
          </p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Number + opt-in */}
        <div className="card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Your WhatsApp Number</h3>
          <div>
            <label className="label">Phone (international format)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
              className="input-field"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Include country code with a leading +. Example: +91 for India.
            </p>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50 transition-colors">
            <span>
              <span className="block text-sm font-medium text-slate-900">
                Enable daily digest
              </span>
              <span className="block text-xs text-slate-500">
                One message a day summarizing your activity.
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={optedIn}
              onClick={() => setOptedIn((v) => !v)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                optedIn ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                  optedIn ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
        </div>

        {/* Schedule */}
        <div className="card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Clock size={18} className="text-slate-400" /> Delivery Schedule
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Send at</label>
              <select
                value={digestHour}
                onChange={(e) => setDigestHour(Number(e.target.value))}
                className="input-field"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {formatHour(h)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="input-field"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {lastSent && (
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-500" />
              Last digest: {lastSent}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="btn-secondary flex items-center justify-center gap-2 px-6"
          >
            {testing ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
            Send Test Digest
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center justify-center gap-2 px-8"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>

      {/* Preview bubble */}
      {preview && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Message preview</h3>
          <div className="rounded-xl bg-[#e7ffdb] border border-emerald-200 p-4 max-w-md">
            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 leading-relaxed">
              {preview.preview}
            </pre>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {preview.mock
              ? 'Generated in preview mode — also logged on the server console.'
              : 'Delivered to your WhatsApp.'}
          </p>
        </div>
      )}
    </div>
  );
}
