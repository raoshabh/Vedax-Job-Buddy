import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  User,
  Search,
  Briefcase,
  Zap,
  MessageCircle,
  Crown,
  Sparkles,
  Rocket,
  X,
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/profile', label: 'My Profile', icon: User },
  { to: '/jobs', label: 'Job Search', icon: Search },
  { to: '/auto-apply', label: 'Auto-Apply', icon: Zap },
  { to: '/applications', label: 'Applications', icon: Briefcase },
  { to: '/notifications', label: 'WhatsApp Alerts', icon: MessageCircle },
  { to: '/billing', label: 'Plans', icon: Crown },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          'fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 z-50 flex flex-col',
          'transition-transform duration-300 ease-in-out',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Rocket className="w-4.5 h-4.5 text-white" size={18} />
            </div>
            <span className="text-lg font-bold text-indigo-500">JobTracker</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-lg hover:bg-slate-100 text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                  'transition-all duration-200',
                  isActive
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom badge */}
        <div className="px-4 py-4 border-t border-slate-200">
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-xl">
            <Sparkles size={16} className="text-indigo-500" />
            <span className="text-xs font-medium text-indigo-600">
              Powered by AI
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
