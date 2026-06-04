import { useState, useEffect, useRef } from 'react';
import { Briefcase, ChevronDown, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import * as api from '../api/client';
import type { Application, ApplicationStatus } from '../api/client';

const statusTabs: { key: ApplicationStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'queued', label: 'Queued' },
  { key: 'applied', label: 'Applied' },
  { key: 'screening', label: 'Screening' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
  { key: 'rejected', label: 'Rejected' },
];

const statusColors: Record<ApplicationStatus, string> = {
  queued: 'bg-slate-100 text-slate-700',
  applied: 'bg-blue-100 text-blue-700',
  screening: 'bg-amber-100 text-amber-700',
  interview: 'bg-purple-100 text-purple-700',
  offer: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

const allStatuses: ApplicationStatus[] = [
  'queued',
  'applied',
  'screening',
  'interview',
  'offer',
  'rejected',
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusDropdown({
  current,
  onUpdate,
}: {
  current: ApplicationStatus;
  onUpdate: (status: ApplicationStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
      >
        Change
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 min-w-[140px]">
          {allStatuses
            .filter((s) => s !== current)
            .map((status) => (
              <button
                key={status}
                onClick={() => {
                  onUpdate(status);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors capitalize"
              >
                {status}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export default function Applications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ApplicationStatus | 'all'>('all');

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getApplications();
        setApplications(data);
      } catch (err) {
        toast.error('Failed to load applications');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleUpdateStatus = async (
    id: string,
    status: ApplicationStatus
  ) => {
    try {
      const updated = await api.updateApplicationStatus(id, status);
      setApplications((prev) =>
        prev.map((app) => (app._id === id ? { ...app, status: updated.status } : app))
      );
      toast.success(`Status updated to ${status}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update status'
      );
    }
  };

  const filtered =
    activeTab === 'all'
      ? applications
      : applications.filter((app) => app.status === activeTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">My Applications</h1>
        <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
          {applications.length}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {statusTabs.map((tab) => {
          const count =
            tab.key === 'all'
              ? applications.length
              : applications.filter((a) => a.status === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                activeTab === tab.key
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={clsx(
                    'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                    activeTab === tab.key
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 text-slate-600'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="card divide-y divide-slate-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <div className="skeleton w-10 h-10 rounded-xl" />
              <div className="flex-1">
                <div className="skeleton h-4 w-48 mb-2" />
                <div className="skeleton h-3 w-32" />
              </div>
              <div className="skeleton h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Inbox size={28} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {activeTab === 'all'
              ? 'No applications yet'
              : `No ${activeTab} applications`}
          </h3>
          <p className="text-sm text-slate-500">
            {activeTab === 'all'
              ? 'Start searching for jobs to submit your first application!'
              : 'No applications with this status.'}
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {filtered.map((app) => (
            <div
              key={app._id}
              className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors"
            >
              {/* Company initial */}
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-indigo-600">
                  {app.company.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {app.jobTitle}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {app.company}
                </p>
              </div>

              {/* Status badge */}
              <span
                className={clsx(
                  'text-xs font-medium px-2.5 py-1 rounded-full capitalize hidden sm:inline-block',
                  statusColors[app.status]
                )}
              >
                {app.status}
              </span>

              {/* Date */}
              <span className="text-xs text-slate-400 hidden md:inline-block whitespace-nowrap">
                {formatDate(app.appliedAt)}
              </span>

              {/* Action dropdown */}
              <StatusDropdown
                current={app.status}
                onUpdate={(status) => handleUpdateStatus(app._id, status)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
