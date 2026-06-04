import { useState, useEffect } from 'react';
import {
  Briefcase,
  Users,
  Trophy,
  TrendingUp,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import StatsCard from '../components/StatsCard';
import ApplicationPipeline from '../components/ApplicationPipeline';
import OnboardingChecklist from '../components/OnboardingChecklist';
import * as api from '../api/client';
import type { Application, DashboardStats } from '../api/client';

function SkeletonCard() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="skeleton h-4 w-24 mb-3" />
          <div className="skeleton h-8 w-16 mb-2" />
          <div className="skeleton h-3 w-32" />
        </div>
        <div className="skeleton w-10 h-10 rounded-xl" />
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsData, appsData] = await Promise.all([
          api.getDashboardStats().catch(() => null),
          api.getApplications().catch(() => []),
        ]);
        setStats(statsData);
        setApplications(appsData);
      } catch {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalApps = stats?.totalApplications ?? applications.length;
  const interviews = stats?.interviews ?? applications.filter((a) => a.status === 'interview').length;
  const offers = stats?.offers ?? applications.filter((a) => a.status === 'offer').length;
  const responseRate = stats?.responseRate ?? (totalApps > 0
    ? Math.round(
        (applications.filter((a) => a.status !== 'queued' && a.status !== 'applied').length /
          totalApps) *
          100
      )
    : 0);

  const recentActivity = stats?.recentActivity ?? applications
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)
    .map((a) => ({
      action: `Status: ${a.status}`,
      company: a.company,
      jobTitle: a.jobTitle,
      date: a.updatedAt,
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Your job search overview
        </p>
      </div>

      {/* Onboarding (auto-hides once complete) */}
      {!loading && <OnboardingChecklist applicationCount={applications.length} />}

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Applications"
            value={totalApps}
            icon={Briefcase}
            color="indigo"
          />
          <StatsCard
            title="Interviews"
            value={interviews}
            icon={Users}
            color="amber"
          />
          <StatsCard
            title="Offers"
            value={offers}
            icon={Trophy}
            color="emerald"
          />
          <StatsCard
            title="Response Rate"
            value={`${responseRate}%`}
            icon={TrendingUp}
            color="rose"
          />
        </div>
      )}

      {/* Pipeline */}
      {loading ? (
        <div className="card p-6">
          <div className="skeleton h-6 w-48 mb-4" />
          <div className="grid grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton h-48 rounded-xl" />
            ))}
          </div>
        </div>
      ) : (
        <ApplicationPipeline applications={applications} />
      )}

      {/* Recent Activity */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Recent Activity
        </h3>
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton w-8 h-8 rounded-full" />
                <div className="flex-1">
                  <div className="skeleton h-4 w-3/4 mb-1" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            No recent activity. Start applying to jobs!
          </p>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((activity, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Clock size={14} className="text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900">
                    <span className="font-medium">{activity.company}</span>
                    {' - '}
                    {activity.jobTitle}
                  </p>
                  <p className="text-xs text-slate-500">{activity.action}</p>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {formatRelativeTime(activity.date)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
