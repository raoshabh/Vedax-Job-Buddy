import { useState, useEffect } from 'react';
import { GraduationCap, X, Loader2, Lightbulb, MessageSquare, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import * as api from '../api/client';
import type { InterviewResult } from '../api/client';

interface InterviewModalProps {
  jobId: string;
  title: string;
  company: string;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  behavioral: 'bg-purple-100 text-purple-700',
  technical: 'bg-blue-100 text-blue-700',
  role: 'bg-emerald-100 text-emerald-700',
};

export default function InterviewModal({ jobId, title, company, onClose }: InterviewModalProps) {
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrade, setUpgrade] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setResult(await api.generateInterviewPrep(jobId));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to generate prep';
        if (/Pro feature/i.test(msg)) setUpgrade(true);
        else toast.error(msg);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const p = result?.prep;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <GraduationCap size={20} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Interview Prep</h2>
              <p className="text-sm text-slate-500">{title} · {company}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-16 text-center">
              <Loader2 size={36} className="mx-auto text-purple-500 animate-spin mb-4" />
              <p className="text-sm font-medium text-slate-700">Preparing your interview kit…</p>
            </div>
          ) : upgrade ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <GraduationCap size={26} className="text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Interview Prep is a Pro feature</h3>
              <p className="text-sm text-slate-500 mb-5 max-w-sm mx-auto">
                Upgrade to Pro to unlock AI interview prep, unlimited tailoring, and WhatsApp alerts.
              </p>
              <a href="/billing" className="btn-primary inline-flex">Upgrade to Pro</a>
            </div>
          ) : p ? (
            <>
              <p className="text-sm text-slate-700 leading-relaxed">{p.overview}</p>

              {p.prepTopics.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                    <Lightbulb size={15} className="text-amber-500" /> Topics to prep
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {p.prepTopics.map((t, i) => (
                      <span key={i} className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                        {t}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {p.questions.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
                    <MessageSquare size={15} className="text-indigo-500" /> Likely questions
                  </h3>
                  <div className="space-y-3">
                    {p.questions.map((q, i) => (
                      <div key={i} className="rounded-xl border border-slate-200 p-3.5">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-sm font-medium text-slate-900">{q.question}</p>
                          <span className={clsx('text-[10px] font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0', CATEGORY_COLORS[q.category] ?? 'bg-slate-100 text-slate-600')}>
                            {q.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          <span className="font-medium text-slate-600">Tip:</span> {q.tip}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {p.questionsToAsk.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                    <HelpCircle size={15} className="text-emerald-500" /> Questions to ask them
                  </h3>
                  <ul className="space-y-1.5">
                    {p.questionsToAsk.map((q, i) => (
                      <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5">›</span> {q}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <p className="text-xs text-slate-400">
                {result?.source === 'ai' ? 'Generated by Claude' : 'Generated from a template (add an API key for AI-tailored prep)'}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500 text-center py-12">Couldn't generate prep. Please try again.</p>
          )}
        </div>

        {!loading && (
          <div className="flex justify-end p-4 border-t border-slate-100">
            <button onClick={onClose} className="btn-primary text-sm px-6">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
