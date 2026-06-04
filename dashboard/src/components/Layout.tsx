import { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { Menu, LogOut, Crown, Sparkles } from 'lucide-react';
import { useAuthStore } from '../context/AuthContext';
import * as api from '../api/client';
import Sidebar from './Sidebar';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [plan, setPlan] = useState<'free' | 'pro' | null>(null);
  const { user, isAuthenticated, logout, loadUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    api.getBillingStatus().then((s) => setPlan(s.plan)).catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-600"
          >
            <Menu size={20} />
          </button>

          <div className="lg:flex-1" />

          <div className="flex items-center gap-3">
            {plan === 'pro' ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                <Crown size={12} /> Pro
              </span>
            ) : plan === 'free' ? (
              <Link
                to="/billing"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-full transition-colors"
              >
                <Sparkles size={12} /> Upgrade
              </Link>
            ) : null}

            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-900">
                {user?.name || 'Loading...'}
              </p>
              <p className="text-xs text-slate-500">{user?.email || ''}</p>
            </div>

            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-indigo-600">
                {initials}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
