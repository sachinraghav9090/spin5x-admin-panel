import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  UserPlus,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Download,
  Eye
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { db } from '../firebase/config.jsx';
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
  Timestamp 
} from 'firebase/firestore';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 25;

export default function Users() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, blocked, flagged
  const [sortBy, setSortBy] = useState('createdAt_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDoc, setLastDoc] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const queryClient = useQueryClient();

  // Build query based on filters
  const buildQuery = (page = 1, cursor = null) => {
    let q = collection(db, 'Users');
    const constraints = [orderBy(sortBy.split('_')[0], sortBy.split('_')[1]), limit(ITEMS_PER_PAGE)];
    
    if (cursor) {
      constraints.push(startAfter(cursor));
    }
    
    if (statusFilter === 'active') {
      constraints.unshift(where('isBlocked', '==', false));
    } else if (statusFilter === 'blocked') {
      constraints.unshift(where('isBlocked', '==', true));
    } else if (statusFilter === 'flagged') {
      constraints.unshift(where('flaggedForInvalidActivity', '==', true));
    }
    
    return query(q, ...constraints);
  };

  const { data: usersData, isLoading, refetch } = useQuery({
    queryKey: ['users', search, statusFilter, sortBy, currentPage],
    queryFn: async () => {
      if (search) {
        // For search, we need to fetch and filter client-side (or use Algolia/Meilisearch in production)
        const q = query(collection(db, 'Users'), orderBy('createdAt', 'desc'), limit(500));
        const snap = await getDocs(q);
        return snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(user => 
            user.email?.toLowerCase().includes(search.toLowerCase()) ||
            user.name?.toLowerCase().includes(search.toLowerCase()) ||
            user.referralCode?.toLowerCase().includes(search.toLowerCase())
          )
          .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
      }
      
      const q = buildQuery(currentPage, currentPage > 1 ? lastDoc : null);
      const snap = await getDocs(q);
      const users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const newLastDoc = snap.docs[snap.docs.length - 1];
      setLastDoc(newLastDoc);
      return users;
    },
    placeholderData: (previousData) => previousData,
  });

  // Get total count for pagination
  const { data: totalCount } = useQuery({
    queryKey: ['usersCount', statusFilter, search],
    queryFn: async () => {
      if (search) return 0; // Will be calculated client-side
      let q = collection(db, 'Users');
      const constraints = [];
      
      if (statusFilter === 'active') {
        constraints.push(where('isBlocked', '==', false));
      } else if (statusFilter === 'blocked') {
        constraints.push(where('isBlocked', '==', true));
      } else if (statusFilter === 'flagged') {
        constraints.push(where('flaggedForInvalidActivity', '==', true));
      }
      
      const snap = await getCountFromServer(query(q, ...constraints));
      return snap.data().count;
    },
  });

  // Bulk actions mutation
  const bulkActionMutation = useMutation({
    mutationFn: async ({ action, userIds }) => {
      const batch = writeBatch(db);
      userIds.forEach(uid => {
        const userRef = doc(db, 'Users', uid);
        switch (action) {
          case 'block':
            batch.update(userRef, { isBlocked: true, blockedAt: Timestamp.now() });
            break;
          case 'unblock':
            batch.update(userRef, { isBlocked: false, blockReason: null });
            break;
          case 'flag':
            batch.update(userRef, { flaggedForInvalidActivity: true });
            break;
          case 'unflag':
            batch.update(userRef, { flaggedForInvalidActivity: false });
            break;
          case 'delete':
            batch.delete(userRef);
            break;
        }
      });
      await batch.commit();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Bulk action completed');
    },
    onError: (error) => {
      toast.error('Failed to perform bulk action');
      console.error(error);
    },
  });

  // Single user actions
  const userActionMutation = useMutation({
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
    
    const confirmMessages = {
      block: 'Block selected users? They will lose access to the app.',
      unblock: 'Unblock selected users?',
      flag: 'Flag selected users for invalid activity?',
      unflag: 'Remove flag from selected users?',
      delete: 'PERMANENTLY delete selected users? This cannot be undone!',
    };
    
    if (!confirm(confirmMessages[action] || 'Perform this action?')) return;
    
    await bulkActionMutation.mutateAsync({ action, userIds: Array.from(selectedUsers) });
    setSelectedUsers(new Set());
  };

  const toggleUserStatus = async (uid, currentStatus) => {
    await userActionMutation.mutateAsync({ 
      uid, 
      updates: { isBlocked: !currentStatus, blockedAt: currentStatus ? null : Timestamp.now() } 
    });
  };

  const toggleFlag = async (uid, currentFlag) => {
    await userActionMutation.mutateAsync({ uid, updates: { flaggedForInvalidActivity: !currentFlag } });
  };

  const users = usersData || [];
  const totalPages = search ? Math.ceil(users.length / ITEMS_PER_PAGE) : Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  const getStatusBadge = (user) => {
    if (user.isBlocked) return <span className="badge badge-error">Blocked</span>;
    if (user.flaggedForInvalidActivity) return <span className="badge badge-warning">Flagged</span>;
    return <span className="badge badge-success">Active</span>;
  };

  const getInitials = (name, email) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email[0].toUpperCase();
    return '?';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        
          <h1 className="text-2xl font-bold text-dark-900">Users Management</h1>
          <p className="text-dark-500 mt-1">Manage all registered users and their accounts</p>
        </div>
        <button 
          className="btn-primary"
          onClick={() => toast('Add user functionality coming soon')}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </button>

      {/* Filters & Search */}
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
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="input w-auto"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
              <option value="flagged">Flagged</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
              className="input w-auto"
            >
              <option value="createdAt_desc">Newest First</option>
              <option value="createdAt_asc">Oldest First</option>
              <option value="points_desc">Highest Points</option>
              <option value="points_asc">Lowest Points</option>
              <option value="lastActive_desc">Most Active</option>
              <option value="lastActive_asc">Least Active</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedUsers.size > 0 && (
        <div className="card p-4 border-accent-200 bg-accent-50 animate-slide-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-sm font-medium text-dark-700">
              {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button onClick={() => handleBulkAction('block')} className="btn-outline text-sm" disabled={bulkActionMutation.isPending}>
                <Shield className="w-4 h-4 mr-1" /> Block
              </button>
              <button onClick={() => handleBulkAction('unblock')} className="btn-outline text-sm" disabled={bulkActionMutation.isPending}>
                <Shield className="w-4 h-4 mr-1" /> Unblock
              </button>
              <button onClick={() => handleBulkAction('flag')} className="btn-outline text-sm" disabled={bulkActionMutation.isPending}>
                <AlertTriangle className="w-4 h-4 mr-1" /> Flag
              </button>
              <button onClick={() => handleBulkAction('unflag')} className="btn-outline text-sm" disabled={bulkActionMutation.isPending}>
                <CheckCircle className="w-4 h-4 mr-1" /> Unflag
              </button>
              <button onClick={() => handleBulkAction('delete')} className="btn-danger text-sm" disabled={bulkActionMutation.isPending}>
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </button>
              <button onClick={() => setSelectedUsers(new Set())} className="btn-ghost text-sm">
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" role="table">
<thead className="bg-dark-50 border-b border-dark-200">
              <tr>
                
                <th className="w-12 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selectedUsers.size === users.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers(new Set(users.map(u => u.id)));
                      } else {
                        setSelectedUsers(new Set());
                      }
                    }}
                    aria-label="Select all users"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider cursor-pointer hover:text-dark-900"
                  onClick={() => { setSortBy(sortBy === 'name_asc' ? 'name_desc' : 'name_asc'); setCurrentPage(1); }}>
                  User
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider cursor-pointer hover:text-dark-900"
                  onClick={() => { setSortBy(sortBy === 'points_desc' ? 'points_asc' : 'points_desc'); setCurrentPage(1); }}>
                  Points
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider cursor-pointer hover:text-dark-900"
                  onClick={() => { setSortBy(sortBy === 'lastActive_desc' ? 'lastActive_asc' : 'lastActive_desc'); setCurrentPage(1); }}>
                  Last Active
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Referrals</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Status</th>
                <th className="w-32 px-4 py-3 text-right text-sm font-semibold text-dark-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
<tbody className="divide-y divide-dark-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                      <span className="text-dark-500">Loading users...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-dark-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-dark-50 transition-colors">
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedUsers);
                          if (e.target.checked) newSelected.add(user.id);
                          else newSelected.delete(user.id);
                          setSelectedUsers(newSelected);
                        }}
                        aria-label={`Select ${user.name || user.email}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-700 font-bold text-sm">
                            {getInitials(user.name, user.email)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-dark-900 truncate">{user.name || 'Unknown'}</p>
                          <p className="text-sm text-dark-500 truncate">{user.email}</p>
                          {user.referralCode && (
                            <p className="text-xs text-primary-600 font-mono">{user.referralCode}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-secondary-500" />
                        <span className="font-mono font-semibold text-dark-900">
                          {new Intl.NumberFormat('en-IN').format(user.points || 0)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-dark-500">
                        <Calendar className="w-4 h-4" />
                        {user.lastActive?.toDate ? formatDistanceToNow(user.lastActive.toDate(), { addSuffix: true }) : 'Never'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-dark-900">{user.referralCount || 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(user)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggleUserStatus(user.id, user.isBlocked)}
                          disabled={userActionMutation.isPending}
                          className="p-2 rounded-lg text-dark-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title={user.isBlocked ? 'Unblock user' : 'Block user'}
                        >
                          {user.isBlocked ? <XCircle className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => toggleFlag(user.id, user.flaggedForInvalidActivity)}
                          disabled={userActionMutation.isPending}
                          className="p-2 rounded-lg text-dark-400 hover:text-accent-600 hover:bg-accent-50 transition-colors"
                          title={user.flaggedForInvalidActivity ? 'Unflag user' : 'Flag user'}
                        >
                          {user.flaggedForInvalidActivity ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        </button>
                        <button
                          className="p-2 rounded-lg text-dark-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                          title="View details"
                          onClick={() => toast('User details view coming soon')}
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
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-dark-300 hover:bg-dark-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-dark-300 hover:bg-dark-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
