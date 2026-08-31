import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle, 
  XCircle,
  Clock,
  DollarSign,
  CreditCard,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  AlertTriangle,
  Download,
  RefreshCw
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
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 25;

const statusOptions = ['all', 'pending', 'approved', 'paid', 'rejected'];

export default function Withdrawals() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDoc, setLastDoc] = useState(null);
  const queryClient = useQueryClient();

  const buildQuery = (cursor = null) => {
    let q = collection(db, 'Withdrawals');
    const constraints = [orderBy(sortBy.split('_')[0], sortBy.split('_')[1]), limit(ITEMS_PER_PAGE)];
    
    if (cursor) {
      constraints.push(startAfter(cursor));
    }
    
    if (statusFilter !== 'all') {
      constraints.unshift(where('status', '==', statusFilter));
    }
    
    return query(q, ...constraints);
  };

  const { data: withdrawalsData, isLoading, refetch } = useQuery({
    queryKey: ['withdrawals', search, statusFilter, sortBy, currentPage],
    queryFn: async () => {
      if (search) {
        const q = query(collection(db, 'Withdrawals'), orderBy('createdAt', 'desc'), limit(500));
        const snap = await getDocs(q);
        return snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(wd => 
            wd.userId?.toLowerCase().includes(search.toLowerCase()) ||
            wd.details?.toLowerCase().includes(search.toLowerCase()) ||
            wd.method?.toLowerCase().includes(search.toLowerCase())
          )
          .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
      }
      
      const q = buildQuery(currentPage > 1 ? lastDoc : null);
      const snap = await getDocs(q);
      const withdrawals = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const newLastDoc = snap.docs[snap.docs.length - 1];
      setLastDoc(newLastDoc);
      return withdrawals;
    },
    placeholderData: (previousData) => previousData,
  });

  const { data: totalCount } = useQuery({
    queryKey: ['withdrawalsCount', statusFilter, search],
    queryFn: async () => {
      if (search) return 0;
      let q = collection(db, 'Withdrawals');
      const constraints = [];
      if (statusFilter !== 'all') {
        constraints.push(where('status', '==', statusFilter));
      }
      const snap = await getCountFromServer(query(q, ...constraints));
      return snap.data().count;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }) => {
      await updateDoc(doc(db, 'Withdrawals', id), updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
      toast.success('Withdrawal updated');
    },
    onError: () => toast.error('Failed to update withdrawal'),
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ action, ids }) => {
      const batch = writeBatch(db);
      ids.forEach(id => {
        const ref = doc(db, 'Withdrawals', id);
        if (action === 'approve') {
          batch.update(ref, { status: 'approved', adminNote: 'Bulk approved', processedAt: Timestamp.now() });
        } else if (action === 'reject') {
          batch.update(ref, { status: 'rejected', adminNote: 'Bulk rejected', processedAt: Timestamp.now() });
        } else if (action === 'paid') {
          batch.update(ref, { status: 'paid', adminNote: 'Bulk marked paid', processedAt: Timestamp.now() });
        }
      });
      await batch.commit();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
      toast.success('Bulk action completed');
    },
    onError: () => toast.error('Bulk action failed'),
  });

  const handleBulkAction = async (action, ids) => {
    if (ids.length === 0) return;
    const messages = {
      approve: `Approve ${ids.length} withdrawal${ids.length > 1 ? 's' : ''}?`,
      reject: `Reject ${ids.length} withdrawal${ids.length > 1 ? 's' : ''}? Points will be refunded.`,
      paid: `Mark ${ids.length} withdrawal${ids.length > 1 ? 's' : ''} as paid?`,
    };
    if (!confirm(messages[action] || 'Perform action?')) return;
    await bulkMutation.mutateAsync({ action, ids });
  };

  const withdrawals = withdrawalsData || [];
  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending': return { label: 'Pending', color: 'badge-warning', icon: Clock };
      case 'approved': return { label: 'Approved', color: 'badge-info', icon: CheckCircle };
      case 'paid': return { label: 'Paid', color: 'badge-success', icon: CreditCard };
      case 'rejected': return { label: 'Rejected', color: 'badge-error', icon: XCircle };
      default: return { label: status, color: 'badge-neutral', icon: AlertTriangle };
    }
  };

  const getMethodIcon = (method) => {
    if (method?.toLowerCase().includes('upi')) return Smartphone;
    if (method?.toLowerCase().includes('paypal')) return DollarSign;
    if (method?.toLowerCase().includes('bank')) return CreditCard;
    return CreditCard;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Withdrawals Management</h1>
          <p className="text-dark-500 mt-1">Review and process user withdrawal requests</p>
        </div>
        <button className="btn-secondary" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder="Search by user ID, method, details..."
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
              {statusOptions.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
              className="input w-auto"
            >
              <option value="createdAt_desc">Newest First</option>
              <option value="createdAt_asc">Oldest First</option>
              <option value="amount_desc">Highest Amount</option>
              <option value="amount_asc">Lowest Amount</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" role="table">
            <thead className="bg-dark-50 border-b border-dark-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Method</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Details</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Requested</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dark-600 uppercase tracking-wider">Status</th>
                <th className="w-48 px-4 py-3 text-right text-sm font-semibold text-dark-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                      <span className="text-dark-500">Loading withdrawals...</span>
                    </div>
                  </td>
                </tr>
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-dark-500">
                    No withdrawals found
                  </td>
                </tr>
              ) : (
                withdrawals.map((wd) => {
                  const config = getStatusConfig(wd.status);
                  const MethodIcon = getMethodIcon(wd.method);
                  return (
                    <tr key={wd.id} className="hover:bg-dark-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="text-primary-700 font-bold text-xs">{wd.userId?.slice(0, 4).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-mono text-sm text-dark-900">{wd.userId?.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-secondary-500" />
                          <span className="font-mono font-semibold text-dark-900">
                            {new Intl.NumberFormat('en-IN').format(wd.points || wd.amount || 0)} pts
                          </span>
                          <span className="text-xs text-dark-500">({wd.currency})</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MethodIcon className="w-4 h-4 text-dark-400" />
                          <span className="text-sm text-dark-700 capitalize">{wd.method}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-dark-600 truncate max-w-xs block">{wd.details || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-dark-500">
                          <Clock className="w-4 h-4" />
                          {wd.createdAt?.toDate ? format(wd.createdAt.toDate(), 'MMM dd, yyyy HH:mm') : 'N/A'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${config.color}`}>
                          <config.icon className="w-3 h-3 mr-1" />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {wd.status === 'pending' && (
                            <>
                              <button
                                onClick={() => updateMutation.mutate({ id: wd.id, updates: { status: 'approved', adminNote: 'Approved by admin', processedAt: Timestamp.now() } })}
                                disabled={updateMutation.isPending}
                                className="p-2 rounded-lg text-secondary-600 hover:bg-secondary-50 hover:text-secondary-700 transition-colors"
                                title="Approve"
                              >
                                <CheckCircle className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => updateMutation.mutate({ id: wd.id, updates: { status: 'rejected', adminNote: 'Rejected by admin', processedAt: Timestamp.now() } })}
                                disabled={updateMutation.isPending}
                                className="p-2 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                                title="Reject & Refund"
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                            </>
                          )}
                          {wd.status === 'approved' && (
                            <button
                              onClick={() => updateMutation.mutate({ id: wd.id, updates: { status: 'paid', adminNote: 'Paid by admin', processedAt: Timestamp.now() } })}
                              disabled={updateMutation.isPending}
                              className="p-2 rounded-lg text-primary-600 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                              title="Mark as Paid"
                            >
                              <CreditCard className="w-5 h-5" />
                            </button>
                          )}
                          {wd.status === 'paid' && (
                            <button
                              onClick={() => updateMutation.mutate({ id: wd.id, updates: { status: 'rejected', adminNote: 'Reversed by admin', processedAt: Timestamp.now() } })}
                              disabled={updateMutation.isPending}
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                              title="Reverse to Rejected"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            className="p-2 rounded-lg text-dark-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            title="View details"
                            onClick={() => toast('Detail view coming soon')}
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-dark-200">
            <div className="text-sm text-dark-500">
              Page {currentPage} of {totalPages} ({totalCount || 0} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-dark-300 hover:bg-dark-100 disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-dark-300 hover:bg-dark-100 disabled:opacity-50"
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