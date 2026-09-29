'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import SairamLogo from '@/components/SairamLogo';
import { logoutStaff, getStaffSession, type StaffSessionUser } from '@/actions/authActions';

const navItems = [
  { to: '/dashboard', icon: '⊞', label: 'Dashboard' },
  { to: '/students', icon: '◉', label: 'Students' },
  { to: '/projects', icon: '◈', label: 'Projects' },
  { to: '/daily-food-list', icon: '▤', label: 'Daily Food List' },
  { to: '/scan-token', icon: '⊙', label: 'Scan & Token' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [staff, setStaff] = useState<StaffSessionUser | null>(null);

  useEffect(() => {
    getStaffSession().then(res => {
      if (res.user) setStaff(res.user);
    });
  }, []);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  });

  const handleLogout = async () => {
    await logoutStaff();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside
        className="flex flex-col bg-indigo-900 text-white transition-all duration-200 shrink-0 relative z-20 shadow-lg"
        style={{ width: sidebarOpen ? 256 : 68 }}
      >
        {/* Sidebar Header with inside toggle button */}
        <div className="p-3 border-b border-indigo-800/80">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <SairamLogo collapsed={!sidebarOpen} />
            </div>

            {/* Collapse toggle button inside expanded sidebar */}
            {sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="shrink-0 p-1.5 rounded-lg bg-indigo-800/70 hover:bg-indigo-700 text-indigo-200 hover:text-white transition-colors cursor-pointer"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>

          {/* Expand toggle button when sidebar is collapsed (inside sidebar) */}
          {!sidebarOpen && (
            <div className="mt-2 text-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="w-full py-1 rounded bg-indigo-800/80 hover:bg-indigo-700 text-indigo-200 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                href={item.to}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-indigo-200 hover:bg-indigo-800/70 hover:text-white'
                } ${!sidebarOpen ? 'justify-center' : ''}`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <span className="text-base shrink-0 w-5 text-center leading-none">{item.icon}</span>
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User / Session Area at bottom of Sidebar */}
        <div className="border-t border-indigo-800/80 p-3 bg-indigo-950/40">
          {sidebarOpen ? (
            <div className="flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <div className="text-xs font-semibold text-white truncate">{staff?.name || 'Staff User'}</div>
                <div className="text-[11px] text-indigo-300 truncate">{staff?.email || 'Incubation Centre'}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md text-indigo-300 hover:text-rose-300 hover:bg-indigo-800/60 transition-colors text-xs flex items-center gap-1 cursor-pointer"
                title="Sign out of system"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-indigo-300 hover:text-rose-300 hover:bg-indigo-800 transition-colors cursor-pointer"
                title="Logout"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header - College branding on left, normal date on right */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
          <div>
            <div className="text-sm font-semibold text-slate-800">Sri Sairam Engineering College</div>
            <div className="text-xs text-slate-400">Incubation Centre · Food Management System</div>
          </div>

          <div className="flex items-center">
            <span className="text-sm text-slate-500">{today}</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
