import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { db } from '../firebase/config.js';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  LayoutDashboard,
  Users,
  Wallet,
  ListChecks,
  HelpCircle,
  BarChart2,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
  BarChart,
  DollarSign,
  Megaphone,
  Menu,
  Wrench,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Withdrawals', href: '/withdrawals', icon: Wallet },
  { name: 'Tasks', href: '/tasks', icon: ListChecks },
  { name: 'Quizzes', href: '/quizzes', icon: HelpCircle },
  { name: 'Surveys', href: '/surveys', icon: BarChart2 },
  { name: 'Broadcasts', href: '/broadcasts', icon: Megaphone },
  { name: 'Chat & Support', href: '/chat', icon: MessageSquare },
  { name: 'Analytics', href: '/analytics', icon: BarChart },
  { name: 'Ad Config', href: '/ad-config', icon: DollarSign },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'AppConfig', 'main'), (snap) => {
      if (snap.exists()) {
        setIsMaintenance(snap.data()?.isMaintenanceMode === true);
      }
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  const currentPage = navigation.find(
    (n) =>
      location.pathname === n.href ||
      (n.href !== '/dashboard' && location.pathname.startsWith(n.href))
  );

  return (
    <div className="min-h-screen bg-dark-50 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static z-50 flex flex-col h-screen transition-all duration-300 ease-in-out bg-white border-r border-dark-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'w-16' : 'w-64'}`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-dark-200">
          {!collapsed && (
            <NavLink to="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-secondary-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-dark-900">Spin5X</span>
            </NavLink>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg text-dark-500 hover:text-dark-700 hover:bg-dark-100 transition-colors hidden lg:block"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg text-dark-500 hover:text-dark-700 hover:bg-dark-100 transition-colors lg:hidden"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-dark-600 hover:bg-dark-100 hover:text-dark-900'
                    } ${collapsed ? 'justify-center' : ''}`
                  }
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="font-medium">{item.name}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User & Logout */}
        <div className="p-4 border-t border-dark-200">
          {!collapsed && user && (
            <div className="flex items-center gap-3 mb-3 p-2 rounded-lg bg-dark-50">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-700 font-bold text-sm">
                  {user.name?.[0] || user.email?.[0]?.toUpperCase() || 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dark-900 truncate">
                  {user.name || 'Admin'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                    Admin Role ✓
                  </span>
                  <p className="text-xs text-dark-500 truncate">{user.email}</p>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-dark-600 hover:bg-dark-100 hover:text-red-600 transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
            title={collapsed ? 'Logout' : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 transition-all duration-300">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-dark-200">
          <div className="flex items-center justify-between h-16 px-4 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg text-dark-500 hover:bg-dark-100"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-bold text-dark-900 hidden sm:block">
                {currentPage?.name || 'Dashboard'}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {isMaintenance && (
                <NavLink
                  to="/settings"
                  className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold border border-red-300 animate-pulse hover:bg-red-200 transition-colors"
                  title="Click to manage maintenance mode"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Maintenance Active</span>
                </NavLink>
              )}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-secondary-500 animate-pulse" />
                <span>Live</span>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
