import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  Clock, 
  Activity,
  BarChart2,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';
import { db } from '../firebase/config.jsx';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  getCountFromServer,
  Timestamp 
} from 'firebase/firestore';

export default function Analytics() {
  const [dateRange, setDateRange] = useState(30);
  const [metric, setMetric] = useState('users');

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatCoins = (num) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const getMetricConfig = (m) => {
    switch (m) {
      case 'users': return { key: 'users', label: 'New Users', color: 'primary' };
      case 'revenue': return { key: 'revenue', label: 'Revenue (Coins)', color: 'secondary' };
      case 'engagement': return { key: 'active', label: 'Active Users', color: 'accent' };
      case 'retention': return { key: 'withdrawals', label: 'Withdrawals', color: 'primary' };
      default: return { key: 'users', label: 'New Users', color: 'primary' };
    }
  };

  const config = getMetricConfig(metric);

  const { data: analyticsData, isLoading, refetch } = useQuery({
    queryKey: ['analytics', dateRange, metric],
    queryFn: async () => {
      const now = new Date();
      const startDate = subDays(now, dateRange);
      const days = eachDayOfInterval({ start: startDate, end: now });

      // Fetch users
      const usersCol = collection(db, 'Users');
      const usersSnap = await getDocs(query(usersCol, where('createdAt', '>=', Timestamp.fromDate(startDate))));
      const usersByDay = new Map();
      usersSnap.docs.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate?.();
        if (createdAt) {
          const dayKey = format(createdAt, 'yyyy-MM-dd');
          usersByDay.set(dayKey, (usersByDay.get(dayKey) || 0) + 1);
        }
      });

      // Fetch transactions for revenue
      const txCol = collection(db, 'Transactions');
      const txSnap = await getDocs(query(txCol, where('timestamp', '>=', Timestamp.fromDate(startDate))));
      const revenueByDay = new Map();
      txSnap.docs.forEach(doc => {
        const data = doc.data();
        const amount = data.amount || 0;
        if (amount > 0) {
          const ts = data.timestamp?.toDate?.();
          if (ts) {
            const dayKey = format(ts, 'yyyy-MM-dd');
            revenueByDay.set(dayKey, (revenueByDay.get(dayKey) || 0) + amount);
          }
        }
      });

      // Fetch active users
      const activeUsersSnap = await getDocs(query(usersCol, where('lastActive', '>=', Timestamp.fromDate(startDate))));
      const activeByDay = new Map();
      activeUsersSnap.docs.forEach(doc => {
        const data = doc.data();
        const lastActive = data.lastActive?.toDate?.();
        if (lastActive) {
          const dayKey = format(lastActive, 'yyyy-MM-dd');
          activeByDay.set(dayKey, (activeByDay.get(dayKey) || 0) + 1);
        }
      });

      // Fetch withdrawals
      const wdCol = collection(db, 'Withdrawals');
      const wdSnap = await getDocs(query(wdCol, where('createdAt', '>=', Timestamp.fromDate(startDate))));
      const wdByDay = new Map();
      wdSnap.docs.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate?.();
        if (createdAt) {
          const dayKey = format(createdAt, 'yyyy-MM-dd');
          wdByDay.set(dayKey, (wdByDay.get(dayKey) || 0) + 1);
        }
      });

      // Build chart data
      const chartData = days.map(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        return {
          date: dayKey,
          label: format(day, 'MMM dd'),
          users: usersByDay.get(dayKey) || 0,
          revenue: revenueByDay.get(dayKey) || 0,
          active: activeByDay.get(dayKey) || 0,
          withdrawals: wdByDay.get(dayKey) || 0,
        };
      });

      // Totals
      const totalUsers = usersByDay.size > 0 ? Array.from(usersByDay.values()).reduce((a, b) => a + b, 0) : 0;
      const totalRevenue = Array.from(revenueByDay.values()).reduce((a, b) => a + b, 0);
      const avgActive = activeByDay.size > 0 ? Array.from(activeByDay.values()).reduce((a, b) => a + b, 0) / activeByDay.size : 0;
      const totalWithdrawals = Array.from(wdByDay.values()).reduce((a, b) => a + b, 0);

      return {
        chartData,
        totals: { totalUsers, totalRevenue, avgActive, totalWithdrawals },
        usersByDay,
        revenueByDay,
      };
}, 
    refetchInterval: 1000 * 60 * 10,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="card p-6">
              <div className="h-6 w-3/4 bg-dark-200 rounded mb-4"></div>
              <div className="h-10 w-1/2 bg-dark-200 rounded"></div>
            </div>
          ))}
        </div>
        <div className="card p-6 h-96">
          <div className="h-6 w-1/4 bg-dark-200 rounded mb-6"></div>
          <div className="h-64 bg-dark-200 rounded"></div>
        </div>
      </div>
    );
  }

  const { chartData, totals } = analyticsData || { chartData: [], totals: { totalUsers: 0, totalRevenue: 0, avgActive: 0, totalWithdrawals: 0 } };
  const currentValue = totals[config?.key] || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Analytics</h1>
          <p className="text-dark-500 mt-1">Platform performance metrics and insights</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button className="btn-outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2">
            {[7, 30, 90].map(days => (
              <button
                key={days}
                onClick={() => setDateRange(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === days
                    ? 'bg-primary-600 text-white'
                    : 'text-dark-600 hover:bg-dark-100'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {['users', 'revenue', 'engagement', 'retention'].map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  metric === m
                    ? 'bg-primary-600 text-white'
                    : 'text-dark-600 hover:bg-dark-100'
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-xl bg-primary-100">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <ArrowUpRight className="w-5 h-5 text-secondary-500" />
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-dark-900">{formatNumber(totals.totalUsers)}</p>
            <p className="text-sm text-dark-500">New Users ({dateRange}d)</p>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-xl bg-secondary-100">
              <DollarSign className="w-6 h-6 text-secondary-600" />
            </div>
            <ArrowUpRight className="w-5 h-5 text-secondary-500" />
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-dark-900">{formatCoins(totals.totalRevenue)}</p>
            <p className="text-sm text-dark-500">Coins Earned ({dateRange}d)</p>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-xl bg-accent-100">
              <Activity className="w-6 h-6 text-accent-600" />
            </div>
            {totals.avgActive > 0 ? <ArrowUpRight className="w-5 h-5 text-secondary-500" /> : <TrendingDown className="w-5 h-5 text-red-500" />}
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-dark-900">{formatNumber(Math.round(totals.avgActive))}</p>
            <p className="text-sm text-dark-500">Avg Daily Active Users</p>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-xl bg-purple-100">
              <PieChart className="w-6 h-6 text-purple-600" />
            </div>
            <ArrowUpRight className="w-5 h-5 text-secondary-500" />
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-dark-900">{formatNumber(totals.totalWithdrawals)}</p>
            <p className="text-sm text-dark-500">Withdrawals Processed</p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-dark-900">{config?.label} Trend ({dateRange} Days)</h2>
          <div className="flex gap-2">
            <select className="input w-auto text-sm" value={dateRange} onChange={(e) => setDateRange(parseInt(e.target.value))}>
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>
        </div>
        
        <div className="h-80 flex items-end justify-around px-4">
          {chartData.map((point, index) => {
            const value = point[config?.key] || 0;
            const maxValue = Math.max(...chartData.map(d => d[config?.key] || 0), 1);
            const height = (value / maxValue) * 100;
            return (
              <div key={index} className="flex-1 flex items-end" title={`${point.label}: ${config?.key === 'revenue' ? formatCoins(value) : formatNumber(value)}`}>
                <div 
                  className={`w-full rounded-t transition-all duration-300 hover:opacity-80 ${
                    config?.color === 'primary' ? 'bg-primary-500' :
                    config?.color === 'secondary' ? 'bg-secondary-500' :
                    config?.color === 'accent' ? 'bg-accent-500' : 'bg-purple-500'
                  }`}
                  style={{ height: height + '%' }}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-dark-500 border-b border-dark-200">
                <th className="pb-2">Date</th>
                <th className="pb-2">New Users</th>
                <th className="pb-2">Coins Earned</th>
                <th className="pb-2">Active Users</th>
                <th className="pb-2">Withdrawals</th>
              </tr>
            </thead>
            <tbody>
              {[...chartData].reverse().slice(0, 30).map((point, index) => (
                <tr key={index} className="border-b border-dark-100 hover:bg-dark-50">
                  <td className="py-2 text-dark-600">{point.label}</td>
                  <td className="py-2 font-mono text-dark-900">{point.users}</td>
                  <td className="py-2 font-mono text-dark-900">{formatCoins(point.revenue)}</td>
                  <td className="py-2 font-mono text-dark-900">{point.active}</td>
                  <td className="py-2 font-mono text-dark-900">{point.withdrawals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-dark-900 mb-4">User Acquisition Funnel</h3>
          <div className="space-y-3">
            {[
              { label: 'App Installs', value: Math.round(totals.totalUsers * 3.5), color: 'primary' },
              { label: 'Registrations', value: totals.totalUsers, color: 'secondary' },
              { label: 'First Task Complete', value: Math.round(totals.totalUsers * 0.65), color: 'accent' },
              { label: 'Day 1 Retention', value: Math.round(totals.totalUsers * 0.4), color: 'purple' },
              { label: 'Day 7 Retention', value: Math.round(totals.totalUsers * 0.15), color: 'pink' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${step.color === 'primary' ? 'bg-primary-500' : step.color === 'secondary' ? 'bg-secondary-500' : step.color === 'accent' ? 'bg-accent-500' : step.color === 'purple' ? 'bg-purple-500' : 'bg-pink-500'}`}>
                  <span className="text-xs font-bold">{i + 1}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-dark-900">{step.label}</p>
                  <div className="h-2 bg-dark-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${step.color === 'primary' ? 'bg-primary-500' : step.color === 'secondary' ? 'bg-secondary-500' : step.color === 'accent' ? 'bg-accent-500' : step.color === 'purple' ? 'bg-purple-500' : 'bg-pink-500'}`}
                      style={{ width: `${(step.value / (totals.totalUsers * 3.5)) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="font-mono text-dark-900 w-20 text-right">{formatNumber(step.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-dark-900 mb-4">Revenue by Source</h3>
          <div className="space-y-3">
            {[
              { label: 'Task Rewards', value: Math.round(totals.totalRevenue * 0.45), color: 'primary' },
              { label: 'Quiz Rewards', value: Math.round(totals.totalRevenue * 0.25), color: 'secondary' },
              { label: 'Survey Rewards', value: Math.round(totals.totalRevenue * 0.15), color: 'accent' },
              { label: 'Daily Check-in', value: Math.round(totals.totalRevenue * 0.1), color: 'purple' },
              { label: 'Referral Bonuses', value: Math.round(totals.totalRevenue * 0.05), color: 'pink' },
            ].map((source, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${source.color === 'primary' ? 'bg-primary-500' : source.color === 'secondary' ? 'bg-secondary-500' : source.color === 'accent' ? 'bg-accent-500' : source.color === 'purple' ? 'bg-purple-500' : 'bg-pink-500'}`}>
                  <span className="text-xs font-bold">{i + 1}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-dark-900">{source.label}</p>
                  <div className="h-2 bg-dark-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${source.color === 'primary' ? 'bg-primary-500' : source.color === 'secondary' ? 'bg-secondary-500' : source.color === 'accent' ? 'bg-accent-500' : source.color === 'purple' ? 'bg-purple-500' : 'bg-pink-500'}`}
                      style={{ width: `${(source.value / totals.totalRevenue) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="font-mono text-dark-900 w-24 text-right">{formatCoins(source.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}