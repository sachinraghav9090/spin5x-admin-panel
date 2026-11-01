import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  UserPlus,
  DollarSign,
  Calendar,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  Edit2,
  Clock,
  Smartphone,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { db } from '../firebase/config.js';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getCountFromServer,
  updateDoc,
  doc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 25;

// Robust date parser supporting Firestore Timestamps, seconds, milliseconds, and ISO strings
const parseDate = (val) => {
  if (!val) return null;
  try {
    if (typeof val.toDate === 'function') return val.toDate();
    if (typeof val.seconds === 'number') return new Date(val.seconds * 1000);
    if (typeof val._seconds === 'number') return new Date(val._seconds * 1000);
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === 'number') {
      const d = new Date(val > 1e11 ? val : val * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return null;
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) return d;
      const parts = trimmed.split('-');
      if (parts.length === 3) {
        const d2 = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (!isNaN(d2.getTime())) return d2;
      }
    }
  } catch (_) {}
  return null;
};

const getUserLastLogin = (user) => {
  if (!user) return null;
  return (
    parseDate(user.lastLogin) ||
    parseDate(user.lastLoginAt) ||
    parseDate(user.lastActive) ||
    parseDate(user.lastLoginDate) ||
    parseDate(user.updatedAt) ||
    parseDate(user.createdAt)
  );
};

const getUserJoinedDate = (user) => {
  if (!user) return null;
  return (
    parseDate(user.createdAt) ||
    parseDate(user.joinedAt) ||
    parseDate(user.registeredAt)
  );
};

const getUserDevice = (u) => {
  if (!u) return 'Unknown Device';
  return (
    u.deviceModel ||
    u.deviceName ||
    u.deviceInfo ||
    u.device ||
    u.device_model ||
    u.device_name ||
    'Unknown Device'
  );
};

export default function Users() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDoc, setLastDoc] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [viewUser, setViewUser] = useState(null);
  const queryClient = useQueryClient();

  const buildQuery = (cursor = null) => {
    const col = collection(db, 'Users');
    const [field, dir] = sortBy.split('_');
    const constraints = [orderBy(field, dir), limit(ITEMS_PER_PAGE)];

    if (cursor) constraints.push(startAfter(cursor));

    if (statusFilter === 'active') constraints.unshift(where('isBlocked', '==', false));
    else if (statusFilter === 'blocked') constraints.unshift(where('isBlocked', '==', true));
    else if (statusFilter === 'flagged') constraints.unshift(where('flaggedForInvalidActivity', '==', true));

    return query(col, ...constraints);
  };

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', search, statusFilter, sortBy, currentPage],
    queryFn: async () => {
      if (search) {
        const q = query(collection(db, 'Users'), orderBy('createdAt', 'desc'), limit(500));
        const snap = await getDocs(q);
        const term = search.toLowerCase();
        return snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter(
            (user) =>
              user.email?.toLowerCase().includes(term) ||
              user.name?.toLowerCase().includes(term) ||
              user.referralCode?.toLowerCase().includes(term) ||
              user.deviceModel?.toLowerCase().includes(term) ||
              user.deviceName?.toLowerCase().includes(term)
          )
          .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
      }

      const q = buildQuery(currentPage > 1 ? lastDoc : null);
      const snap = await getDocs(q);
      const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (snap.docs.length > 0) setLastDoc(snap.docs[snap.docs.length - 1]);
      return users;
    },
    placeholderData: (prev) => prev,
  });

  const { data: totalCount } = useQuery({
    queryKey: ['usersCount', statusFilter, search],
    queryFn: async () => {
      if (search) return 0;
      const col = collection(db, 'Users');
      const constraints = [];
      if (statusFilter === 'active') constraints.push(where('isBlocked', '==', false));
      else if (statusFilter === 'blocked') constraints.push(where('isBlocked', '==', true));
      else if (statusFilter === 'flagged') constraints.push(where('flaggedForInvalidActivity', '==', true));
      const snap = await getCountFromServer(query(col, ...constraints));
      return snap.data().count;
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ action, userIds }) => {
      const batch = writeBatch(db);
      userIds.forEach((uid) => {
        const ref = doc(db, 'Users', uid);
        if (action === 'block') batch.update(ref, { isBlocked: true, blockedAt: Timestamp.now() });
        else if (action === 'unblock') batch.update(ref, { isBlocked: false, blockReason: null });
        else if (action === 'flag') batch.update(ref, { flaggedForInvalidActivity: true });
        else if (action === 'unflag') batch.update(ref, { flaggedForInvalidActivity: false });
      });
      await batch.commit();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Bulk action completed');
    },
    onError: () => toast.error('Failed to perform bulk action'),
  });

  const userMutation = useMutation({
    mutationFn: async ({ uid, updates }) => {
      await updateDoc(doc(db, 'Users', uid), updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated');
    },
    onError: () => toast.error('Failed to update user'),
  });

  const handleBulkAction = async (action) => {
    if (selectedUsers.size === 0) {
      toast.error('No users selected');
      return;
    }
    const msgs = {
      block: 'Block selected users?',
      unblock: 'Unblock selected users?',
      flag: 'Flag selected users?',
      unflag: 'Remove flag from selected users?',
    };
    if (!confirm(msgs[action] || 'Perform action?')) return;
    await bulkMutation.mutateAsync({ action, userIds: Array.from(selectedUsers) });
    setSelectedUsers(new Set());
  };

  const users = usersData || [];
  const totalPages = search ? Math.ceil(users.length / ITEMS_PER_PAGE) : Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  const getStatusBadge = (user) => {
    if (user.isBlocked) return <span className="badge badge-error">Blocked</span>;
    if (user.flaggedForInvalidActivity) return <span className="badge badge-warning">Flagged</span>;
    return <span className="badge badge-success">Active</span>;
  };

  const getInitials = (name, email) => {
    if (name) return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email[0].toUpperCase();
    return '?';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Users Management</h1>
          <p className="text-dark-500 mt-1">Manage all registered users and their accounts</p>
        </div>
        <button className="btn-primary" onClick={() => toast('Add user functionality coming soon')}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder="Search by email, name, referral code..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="input w-auto">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
              <option value="flagged">Flagged</option>
            </select>
            <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }} className="input w-auto">
              <option value="createdAt_desc">Newest First</option>
              <option value="createdAt_asc">Oldest First</option>
              <option value="points_desc">Highest Points</option>
              <option value="points_asc">Lowest Points</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.size > 0 && (
        <div className="card p-4 border-accent-200 bg-accent-50 animate-slide-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-sm font-medium text-dark-700">
              {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => handleBulkAction('block')} className="btn-outline text-sm" disabled={bulkMutation.isPending}>
                <Shield className="w-4 h-4 mr-1" /> Block
              </button>
              <button onClick={() => handleBulkAction('unblock')} className="btn-outline text-sm" disabled={bulkMutation.isPending}>
                <Shield className="w-4 h-4 mr-1" /> Unblock
              </button>
              <button onClick={() => handleBulkAction('flag')} className="btn-outline text-sm" disabled={bulkMutation.isPending}>
                <AlertTriangle className="w-4 h-4 mr-1" /> Flag
              </button>
              <button onClick={() => handleBulkAction('unflag')} className="btn-outline text-sm" disabled={bulkMutation.isPending}>
                <CheckCircle className="w-4 h-4 mr-1" /> Unflag
              </button>
              <button onClick={() => setSelectedUsers(new Set())} className="btn-ghost text-sm">Clear</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-50 border-b border-dark-200">
              <tr>
                <th className="w-12 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selectedUsers.size === users.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedUsers(new Set(users.map((u) => u.id)));
                      else setSelectedUsers(new Set());
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Joined</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Last Login</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Device</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Currency</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Points</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Special Tasks</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Ads Watched</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Referrals</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Status</th>
                <th className="w-32 px-4 py-3 text-right text-sm font-semibold text-dark-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                      <span className="text-dark-500">Loading users...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-dark-500">No users found</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-dark-50 transition-colors">
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={(e) => {
                          const next = new Set(selectedUsers);
                          if (e.target.checked) next.add(user.id);
                          else next.delete(user.id);
                          setSelectedUsers(next);
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-700 font-bold text-sm">{getInitials(user.name, user.email)}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-dark-900 truncate">{user.name || 'Unknown'}</p>
                          <p className="text-sm text-dark-500 truncate">{user.email}</p>
                          {user.referralCode && <p className="text-xs text-primary-600 font-mono">{user.referralCode}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const joined = getUserJoinedDate(user);
                        if (!joined) return <span className="text-xs text-dark-400">N/A</span>;
                        return (
                          <div className="text-xs">
                            <p className="font-semibold text-dark-800">{format(joined, 'dd MMM yyyy')}</p>
                            <span className="text-[11px] text-dark-400">{format(joined, 'hh:mm a')}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const loginDate = getUserLastLogin(user);
                        if (!loginDate) return <span className="text-xs text-dark-400 italic">Never</span>;
                        return (
                          <div className="text-xs">
                            <div className="flex items-center gap-1.5 font-semibold text-dark-800">
                              <Clock className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
                              <span>{format(loginDate, 'dd MMM yyyy, hh:mm a')}</span>
                            </div>
                            <span className="text-[11px] text-dark-400 block mt-0.5">
                              {formatDistanceToNow(loginDate, { addSuffix: true })}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-dark-800">
                        <Smartphone className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                        <span className="text-xs font-medium truncate max-w-[140px] block" title={getUserDevice(user)}>
                          {getUserDevice(user)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.country === 'Other' || user.currency === 'USD' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          USD ($)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                          INR (₹)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-secondary-500" />
                        <span className="font-mono font-semibold text-dark-900">{new Intl.NumberFormat('en-IN').format(user.points || 0)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        ⭐ {user.specialTasksCompleted || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        📺 {user.adsWatched || user.adWatchCount || user.totalAdsWatched || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-dark-900">{user.referralCount || 0}</span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(user)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => userMutation.mutate({ uid: user.id, updates: { isBlocked: !user.isBlocked, blockedAt: user.isBlocked ? null : Timestamp.now() } })}
                          disabled={userMutation.isPending}
                          className="p-2 rounded-lg text-dark-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title={user.isBlocked ? 'Unblock user' : 'Block user'}
                        >
                          {user.isBlocked ? <XCircle className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => userMutation.mutate({ uid: user.id, updates: { flaggedForInvalidActivity: !user.flaggedForInvalidActivity } })}
                          disabled={userMutation.isPending}
                          className="p-2 rounded-lg text-dark-400 hover:text-accent-600 hover:bg-accent-50 transition-colors"
                          title={user.flaggedForInvalidActivity ? 'Unflag user' : 'Flag user'}
                        >
                          {user.flaggedForInvalidActivity ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        </button>
                        <button
                          className="p-2 rounded-lg text-dark-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                          title="View details"
                          onClick={() => setViewUser(user)}
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-dark-200">
            <div className="text-sm text-dark-500">
              Showing page {currentPage} of {totalPages} ({totalCount || 0} total)
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-dark-300 hover:bg-dark-100 disabled:opacity-50">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-dark-300 hover:bg-dark-100 disabled:opacity-50">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {viewUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewUser(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-dark-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-dark-900">User Details</h2>
              <button onClick={() => setViewUser(null)} className="p-2 text-dark-400 hover:text-dark-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-700 font-bold text-2xl">{getInitials(viewUser.name, viewUser.email)}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-dark-900">{viewUser.name || 'Unknown User'}</h3>
                  <p className="text-dark-500">{viewUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-dark-50 rounded-lg">
                  <p className="text-xs text-dark-500 mb-1">Joined Date</p>
                  {(() => {
                    const joined = getUserJoinedDate(viewUser);
                    return joined ? (
                      <>
                        <p className="font-semibold text-dark-900 text-sm">
                          {format(joined, 'dd MMMM yyyy, hh:mm a')}
                        </p>
                        <p className="text-xs text-dark-400 mt-0.5">
                          {formatDistanceToNow(joined, { addSuffix: true })}
                        </p>
                      </>
                    ) : (
                      <p className="font-medium text-dark-900">N/A</p>
                    );
                  })()}
                </div>
                <div className="p-3 bg-dark-50 rounded-lg">
                  <p className="text-xs text-dark-500 mb-1">Last Login Time & Date</p>
                  {(() => {
                    const lastLogin = getUserLastLogin(viewUser);
                    return lastLogin ? (
                      <>
                        <p className="font-semibold text-primary-700 text-sm flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {format(lastLogin, 'dd MMMM yyyy, hh:mm a')}
                        </p>
                        <p className="text-xs text-primary-600 font-semibold mt-0.5">
                          {formatDistanceToNow(lastLogin, { addSuffix: true })}
                        </p>
                      </>
                    ) : (
                      <p className="font-medium text-dark-500">Never logged in</p>
                    );
                  })()}
                </div>
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 col-span-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-blue-700 font-bold uppercase tracking-wider">User Country & Currency</p>
                      <p className="text-sm font-bold text-dark-900 mt-0.5">
                        Current: {viewUser.country === 'Other' || viewUser.currency === 'USD' ? 'Global / Other — USD ($)' : 'India — INR (₹)'}
                      </p>
                      <p className="text-xs text-dark-500 mt-0.5">
                        Changes sync to the user's mobile app instantly in real time.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          userMutation.mutate({
                            uid: viewUser.id,
                            updates: { country: 'India', currency: 'INR' },
                          });
                          setViewUser({ ...viewUser, country: 'India', currency: 'INR' });
                        }}
                        disabled={userMutation.isPending || (viewUser.country !== 'Other' && viewUser.currency !== 'USD')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          viewUser.country !== 'Other' && viewUser.currency !== 'USD'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white text-dark-700 hover:bg-blue-100 border border-blue-300'
                        }`}
                      >
                        🇮🇳 India (INR ₹)
                      </button>
                      <button
                        onClick={() => {
                          userMutation.mutate({
                            uid: viewUser.id,
                            updates: { country: 'Other', currency: 'USD' },
                          });
                          setViewUser({ ...viewUser, country: 'Other', currency: 'USD' });
                        }}
                        disabled={userMutation.isPending || (viewUser.country === 'Other' || viewUser.currency === 'USD')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          viewUser.country === 'Other' || viewUser.currency === 'USD'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white text-dark-700 hover:bg-emerald-100 border border-emerald-300'
                        }`}
                      >
                        🌐 Other (USD $)
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-dark-50 rounded-lg group">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-dark-500">Total Coins</p>
                    <button
                      onClick={() => {
                        const newPts = window.prompt(`Edit coins for ${viewUser.name || 'User'}:`, viewUser.points || 0);
                        if (newPts !== null && !isNaN(parseInt(newPts))) {
                          userMutation.mutate({ uid: viewUser.id, updates: { points: parseInt(newPts) } });
                          setViewUser({ ...viewUser, points: parseInt(newPts) });
                        }
                      }}
                      className="text-primary-600 hover:text-primary-700 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit Coins"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="font-medium text-dark-900">{new Intl.NumberFormat('en-IN').format(viewUser.points || 0)}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs text-amber-700 font-semibold mb-1">⭐ Special Tasks</p>
                  <p className="font-bold text-amber-900 text-base">{viewUser.specialTasksCompleted || 0} completed</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-700 font-semibold mb-1">📺 Ads Watched</p>
                  <p className="font-bold text-blue-900 text-base">{viewUser.adsWatched || viewUser.adWatchCount || viewUser.totalAdsWatched || 0} ads</p>
                </div>
                <div className="p-3 bg-dark-50 rounded-lg">
                  <p className="text-xs text-dark-500 mb-1">Referral Code</p>
                  <p className="font-medium text-primary-600 font-mono">{viewUser.referralCode || 'N/A'}</p>
                </div>
                <div className="p-3 bg-dark-50 rounded-lg">
                  <p className="text-xs text-dark-500 mb-1">Total Referrals</p>
                  <p className="font-medium text-dark-900">{viewUser.referralCount || 0}</p>
                </div>
                <div className="p-3 bg-dark-50 rounded-lg col-span-2">
                  <p className="text-xs text-dark-500 mb-1">Device Model / Name</p>
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-primary-600" />
                    <span className="font-semibold text-dark-900 text-sm">{getUserDevice(viewUser)}</span>
                  </div>
                </div>
                <div className="p-3 bg-dark-50 rounded-lg col-span-2">
                  <p className="text-xs text-dark-500 mb-1">Device ID</p>
                  <p className="font-medium text-dark-900 font-mono text-sm break-all">{viewUser.deviceId || 'Unknown'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
