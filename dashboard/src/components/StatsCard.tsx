import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import clsx from 'clsx';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  color: 'indigo' | 'emerald' | 'amber' | 'rose';
}

const colorMap = {
  indigo: {
    border: 'border-l-indigo-500',
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
  },
  emerald: {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
  },
  amber: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
  },
  rose: {
    border: 'border-l-rose-500',
    bg: 'bg-rose-50',
    text: 'text-rose-600',
  },
};

export default function StatsCard({
  title,
  value,
  change,
  icon: Icon,
  color,
}: StatsCardProps) {
  const colors = colorMap[color];

  return (
    <div
      className={clsx(
        'card p-5 border-l-4 hover:shadow-md transition-shadow duration-200',
        colors.border
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {change >= 0 ? (
                <TrendingUp size={14} className="text-emerald-500" />
              ) : (
                <TrendingDown size={14} className="text-rose-500" />
              )}
              <span
                className={clsx(
                  'text-xs font-medium',
                  change >= 0 ? 'text-emerald-600' : 'text-rose-600'
                )}
              >
                {change >= 0 ? '+' : ''}
                {change}%
              </span>
              <span className="text-xs text-slate-400">vs last week</span>
            </div>
          )}
        </div>

        <div
          className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            colors.bg
          )}
        >
          <Icon size={20} className={colors.text} />
        </div>
      </div>
    </div>
  );
}
