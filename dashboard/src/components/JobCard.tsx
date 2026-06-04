import { MapPin, DollarSign, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { Job } from '../api/client';

interface JobCardProps {
  job: Job;
  onApply: (jobId: string) => void;
  applying?: boolean;
}

const companyColors = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-purple-500',
  'bg-cyan-500',
  'bg-teal-500',
  'bg-orange-500',
];

function getCompanyColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return companyColors[Math.abs(hash) % companyColors.length];
}

function formatSalary(val?: number): string {
  if (!val) return '';
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val}`;
}

export default function JobCard({ job, onApply, applying }: JobCardProps) {
  const matchScore = job.matchScore ?? 0;
  const scoreColor =
    matchScore >= 80
      ? 'bg-emerald-100 text-emerald-700'
      : matchScore >= 60
        ? 'bg-amber-100 text-amber-700'
        : 'bg-rose-100 text-rose-700';

  const salaryRange =
    job.salaryMin || job.salaryMax
      ? `${formatSalary(job.salaryMin)} - ${formatSalary(job.salaryMax)}`
      : null;

  return (
    <div className="card-hover flex flex-col p-5">
      <div className="flex items-start gap-3 mb-3">
        <div
          className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0',
            getCompanyColor(job.company)
          )}
        >
          {job.company.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 truncate">
            {job.title}
          </h3>
          <p className="text-sm text-slate-500 truncate">{job.company}</p>
        </div>
        {matchScore > 0 && (
          <span
            className={clsx(
              'text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0',
              scoreColor
            )}
          >
            {matchScore}%
          </span>
        )}
      </div>

      <div className="space-y-1.5 mb-4 flex-1">
        {job.location && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin size={13} className="flex-shrink-0" />
            <span className="truncate">{job.location}</span>
          </div>
        )}
        {salaryRange && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <DollarSign size={13} className="flex-shrink-0" />
            <span>{salaryRange}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto">
        {job.source && (
          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wide">
            {job.source}
          </span>
        )}
        <button
          onClick={() => onApply(job._id)}
          disabled={applying}
          className="btn-primary text-xs py-2 px-4 flex-1 flex items-center justify-center gap-1.5"
        >
          {applying ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Applying...
            </>
          ) : (
            'Apply'
          )}
        </button>
      </div>
    </div>
  );
}
