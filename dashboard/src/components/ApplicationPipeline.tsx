import clsx from 'clsx';
import type { Application, ApplicationStatus } from '../api/client';

interface PipelineProps {
  applications: Application[];
}

interface Column {
  key: ApplicationStatus;
  label: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
}

const columns: Column[] = [
  {
    key: 'queued',
    label: 'Queued',
    borderColor: 'border-t-slate-400',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
  },
  {
    key: 'applied',
    label: 'Applied',
    borderColor: 'border-t-blue-500',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
  },
  {
    key: 'screening',
    label: 'Screening',
    borderColor: 'border-t-amber-500',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
  },
  {
    key: 'interview',
    label: 'Interview',
    borderColor: 'border-t-purple-500',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-700',
  },
  {
    key: 'offer',
    label: 'Offer',
    borderColor: 'border-t-emerald-500',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    borderColor: 'border-t-rose-500',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-700',
  },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function ApplicationPipeline({ applications }: PipelineProps) {
  const grouped = columns.map((col) => ({
    ...col,
    items: applications.filter((app) => app.status === col.key),
  }));

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">
        Application Pipeline
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {grouped.map((col) => (
          <div
            key={col.key}
            className={clsx(
              'border-t-2 rounded-xl bg-slate-50 p-3 min-h-[200px]',
              col.borderColor
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                {col.label}
              </span>
              <span
                className={clsx(
                  'text-xs font-bold px-2 py-0.5 rounded-full',
                  col.badgeBg,
                  col.badgeText
                )}
              >
                {col.items.length}
              </span>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {col.items.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  No items
                </p>
              ) : (
                col.items.map((app) => (
                  <div
                    key={app._id}
                    className="bg-white rounded-lg p-2.5 border border-slate-200 shadow-sm hover:shadow transition-shadow"
                  >
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {app.company}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {app.jobTitle}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {formatDate(app.appliedAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
