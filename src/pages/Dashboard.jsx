import { useQuery } from '@tanstack/react-query';
import { Users, Wallet, DollarSign, Activity, Target, ArrowUpRight, Clock } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { db } from '../firebase/config.js';
import {
  collection,
  query,
  where,
  getCountFromServer,
  getDocs,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';

const metricCards = [
  { name: 'Total Users', icon: Users, bgColor: 'bg-primary-100', textColor: 'text-primary-600', key: 'totalUsers' },
  { name: 'Total Coins', icon: Wallet, bgColor: 'bg-secondary-100', textColor: 'text-secondary-600', key: 'totalCoins' },
  { name: 'Pending Withdrawals', icon: DollarSign, bgColor: 'bg-accent-100', textColor: 'text-accent-600', key: 'pendingWithdrawals' },
  { name: 'Active Today', icon: Activity, bgColor: 'bg-primary-100', textColor: 'text-primary-600', key: 'activeToday' },
];

const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const formatCoins = (num) => new Intl.NumberFormat('en-IN').format(num);

export default function Dashboard() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboardMetrics'],
    queryFn: async () => {
      const now = new Date();
      const todayStart = startOfDay(now);
      const weekAgo = subDays(now, 7);
      const monthAgo = subDays(now, 30);

      const usersCol = collection(db, 'Users');
      const totalUsersSnap = await getCountFromServer(usersCol);
      const totalUsers = totalUsersSnap.data().count;

      // Total coins - fetch all users and sum points
      const usersSnap = await getDocs(query(usersCol, orderBy('points', 'desc')));
      let totalCoins = 0;
      usersSnap.docs.forEach((d) => {
        totalCoins += d.data().points || 0;
      });

      // Pending withdrawals
      const withdrawalsCol = collection(db, 'Withdrawals');
      const pendingSnap = await getCountFromServer(
        query(withdrawalsCol, where('status', '==', 'pending'))
      );
      const pendingWithdrawals = pendingSnap.data().count;

      // Active today
      const activeSnap = await getCountFromServer(
        query(usersCol, where('lastActive', '>=', Timestamp.fromDate(todayStart)))
      );
      const activeToday = activeSnap.data().count;

      // New users this week
      const newWeekSnap = await getCountFromServer(
        query(usersCol, where('createdAt', '>=', Timestamp.fromDate(weekAgo)))
      );
      const newUsersWeek = newWeekSnap.data().count;

      // New users this month
      const newMonthSnap = await getCountFromServer(
        query(usersCol, where('createdAt', '>=', Timestamp.fromDate(monthAgo)))
      );
      const newUsersMonth = newMonthSnap.data().count;

      // Recent withdrawals
      const recentSnap = await getDocs(
        query(withdrawalsCol, orderBy('createdAt', 'desc'), limit(5))
      );
      const recentWithdrawals = recentSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      return { totalUsers, totalCoins, pendingWithdrawals, activeToday, newUsersWeek, newUsersMonth, recentWithdrawals };
    },
    refetchInterval: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metricCards.map((card) => (
            <div key={card.name} className="card p-6">
              <div className="h-6 w-3/4 bg-dark-200 rounded mb-4" />
              <div className="h-10 w-1/2 bg-dark-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Dashboard</h1>
          <p className="text-dark-500 mt-1">Overview of your Spin5X platform performance</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-dark-500">
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary-100 text-secondary-700">
            <span className="w-2 h-2 rounded-full bg-secondary-500 animate-pulse" />
            Live
          </span>
          Updated {format(new Date(), 'HH:mm:ss')}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((card) => {
          const value = metrics?.[card.key] || 0;
          const displayValue = card.key === 'totalCoins' ? formatCoins(value) : formatNumber(value);
          const Icon = card.icon;

          return (
            <div key={card.name} className="card p-6 card-hover">
              <div className="flex items-center justify-between">
                <div className={card.bgColor + ' p-3 rounded-xl'}>
                  <Icon className={card.textColor + ' w-6 h-6'} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-dark-900">{displayValue}</p>
                <p className="text-sm text-dark-500 mt-1">{card.name}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <div className="lg:col-span-2 card p-6">
          <h2 className="text-lg font-semibold text-dark-900 mb-6">User Growth (Last 30 Days)</h2>
          <div className="h-64 flex items-end justify-around px-4">
            {[5, 8, 12, 7, 15, 10, 18, 12, 20, 15, 22, 18, 25, 20, 28, 22, 30, 25, 32, 28, 35, 30, 38, 32, 40, 35, 42, 38, 45, 40, 48].map((height, index) => (
              <div key={index} className="flex-1 flex items-end">
                <div
                  className="w-full bg-primary-500 rounded-t transition-all duration-300 hover:bg-primary-600"
                  style={{ height: height + '%' }}
                  title={'Day ' + (index + 1)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Withdrawals */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-dark-900">Recent Withdrawals</h2>
            <span className="badge badge-warning">{metrics?.pendingWithdrawals || 0} Pending</span>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {metrics?.recentWithdrawals?.length > 0 ? (
              metrics.recentWithdrawals.map((wd) => {
                const displayUser = wd.username || wd.userName || (wd.userEmail ? wd.userEmail.split('@')[0] : 'User');
                const coins = wd.withdrawalCoins || wd.points || 0;
                const inr = Number(wd.coinValueInInr || wd.amount || (coins / 100));
                const device = wd.deviceModel || wd.deviceName || 'Android';

                return (
                  <div key={wd.id} className="flex items-center justify-between p-3 rounded-lg bg-dark-50 hover:bg-dark-100 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${wd.status === 'pending' ? 'bg-accent-100' : wd.status === 'approved' ? 'bg-secondary-100' : wd.status === 'paid' ? 'bg-primary-100' : 'bg-red-100'}`}>
                        <DollarSign className={`w-4 h-4 ${wd.status === 'pending' ? 'text-accent-600' : wd.status === 'approved' ? 'text-secondary-600' : wd.status === 'paid' ? 'text-primary-600' : 'text-red-600'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-dark-900 truncate">{displayUser}</p>
                          <span className="text-[10px] text-dark-400 font-medium truncate max-w-[90px]" title={device}>
                            • {device}
                          </span>
                        </div>
                        <p className="text-xs text-dark-600 font-medium">
                          ₹{inr.toFixed(0)} ({new Intl.NumberFormat('en-IN').format(coins)} Coins) • <span className="font-semibold text-primary-600">{wd.method || 'UPI'}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 pl-2">
                      <span className={`badge ${wd.status === 'pending' ? 'badge-warning' : wd.status === 'approved' ? 'badge-success' : wd.status === 'paid' ? 'badge-info' : 'badge-error'}`}>
                        {wd.status}
                      </span>
                      <p className="text-xs text-dark-400 mt-1">
                        {wd.createdAt?.toDate ? format(wd.createdAt.toDate(), 'dd MMM, HH:mm') : 'N/A'}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-dark-500">
                <DollarSign className="w-12 h-12 mx-auto mb-2 text-dark-300" />
                No recent withdrawals
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-100">
              <Target className="w-5 h-5 text-accent-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-900">{metrics?.newUsersWeek || 0}</p>
              <p className="text-sm text-dark-500">New Users (7d)</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-100">
              <ArrowUpRight className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-900">{metrics?.newUsersMonth || 0}</p>
              <p className="text-sm text-dark-500">New Users (30d)</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary-100">
              <Activity className="w-5 h-5 text-secondary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-900">{metrics?.activeToday || 0}</p>
              <p className="text-sm text-dark-500">Active Today</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-900">{metrics?.pendingWithdrawals || 0}</p>
              <p className="text-sm text-dark-500">Pending Actions</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
