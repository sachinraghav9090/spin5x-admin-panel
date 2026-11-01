import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
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
  RefreshCw,
  Copy,
  Check,
  Gift,
  AlertCircle,
  Key,
} from 'lucide-react';
import { format } from 'date-fns';
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
  Timestamp,
  getDoc,
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
  const [viewWd, setViewWd] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  // Redeem code fulfillment modal state
  const [redeemModalWd, setRedeemModalWd] = useState(null);
  const [inputRedeemCode, setInputRedeemCode] = useState('');

  // Reject modal state
  const [rejectModalWd, setRejectModalWd] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const queryClient = useQueryClient();

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const { data: wdUser, isLoading: isUserLoading } = useQuery({
    queryKey: ['wdUser', viewWd?.userId],
    queryFn: async () => {
      if (!viewWd?.userId) return null;
      const snap = await getDoc(doc(db, 'Users', viewWd.userId));
      return snap.exists() ? snap.data() : null;
    },
    enabled: !!viewWd?.userId,
  });

  const buildQuery = (cursor = null) => {
    const col = collection(db, 'Withdrawals');
    const [field, dir] = sortBy.split('_');
    const constraints = [orderBy(field, dir), limit(ITEMS_PER_PAGE)];
    if (cursor) constraints.push(startAfter(cursor));
    if (statusFilter !== 'all') constraints.unshift(where('status', '==', statusFilter));
    return query(col, ...constraints);
  };

  const { data: withdrawalsData, isLoading, refetch } = useQuery({
    queryKey: ['withdrawals', search, statusFilter, sortBy, currentPage],
    queryFn: async () => {
      if (search) {
        const q = query(collection(db, 'Withdrawals'), orderBy('createdAt', 'desc'), limit(500));
        const snap = await getDocs(q);
        const term = search.toLowerCase();
        return snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((wd) =>
            wd.userId?.toLowerCase().includes(term) ||
            wd.username?.toLowerCase().includes(term) ||
            wd.userName?.toLowerCase().includes(term) ||
            wd.userEmail?.toLowerCase().includes(term) ||
            wd.deviceModel?.toLowerCase().includes(term) ||
            wd.method?.toLowerCase().includes(term) ||
            wd.details?.toLowerCase().includes(term) ||
            wd.upiId?.toLowerCase().includes(term) ||
            wd.redeemCode?.toLowerCase().includes(term) ||
            wd.paypalEmail?.toLowerCase().includes(term)
          )
          .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
      }
      const q = buildQuery(currentPage > 1 ? lastDoc : null);
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (snap.docs.length > 0) setLastDoc(snap.docs[snap.docs.length - 1]);
      return list;
    },
    placeholderData: (prev) => prev,
  });

  const { data: totalCount } = useQuery({
    queryKey: ['withdrawalsCount', statusFilter, search],
    queryFn: async () => {
      if (search) return 0;
      const col = collection(db, 'Withdrawals');
      const constraints = [];
      if (statusFilter !== 'all') constraints.push(where('status', '==', statusFilter));
      const snap = await getCountFromServer(query(col, ...constraints));
      return snap.data().count;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }) => {
      await updateDoc(doc(db, 'Withdrawals', id), updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
      toast.success('Withdrawal updated successfully');
      setRedeemModalWd(null);
      setRejectModalWd(null);
      if (viewWd) {
        // Refresh view modal if open
        setViewWd((prev) => (prev ? { ...prev } : null));
      }
    },
    onError: (err) => toast.error('Failed to update: ' + err.message),
  });

  const handleDeliverRedeemCode = (e) => {
    e.preventDefault();
    if (!redeemModalWd) return;
    const code = inputRedeemCode.trim().toUpperCase();
    if (!code) {
      toast.error('Please enter a Google Play redeem code');
      return;
    }

    updateMutation.mutate({
      id: redeemModalWd.id,
      updates: {
        redeemCode: code,
        status: 'approved',
        adminNote: `Google Play Code Delivered: ${code}`,
        processedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    });
  };

  const handleConfirmReject = (e) => {
    e.preventDefault();
    if (!rejectModalWd) return;
    updateMutation.mutate({
      id: rejectModalWd.id,
      updates: {
        status: 'rejected',
        adminNote: rejectReason.trim() || 'Rejected by administrator',
        processedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    });
  };

  const generateRandomVoucher = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${seg()}-${seg()}-${seg()}-${seg()}`;
  };

  const withdrawals = withdrawalsData || [];
  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', color: 'badge-warning', Icon: Clock };
      case 'approved':
        return { label: 'Approved', color: 'badge-info', Icon: CheckCircle };
      case 'paid':
        return { label: 'Paid', color: 'badge-success', Icon: CreditCard };
      case 'rejected':
        return { label: 'Rejected', color: 'badge-error', Icon: XCircle };
      default:
        return { label: status, color: 'badge-neutral', Icon: Clock };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Withdrawals Management</h1>
          <p className="text-dark-500 mt-1">
            Review, verify user devices, and process UPI / Google Play Redeem Code withdrawals
          </p>
        </div>
        <button className="btn-secondary" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder="Search username, device, UPI, user ID, method..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="input w-auto"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
              className="input w-auto"
            >
              <option value="createdAt_desc">Newest First</option>
              <option value="createdAt_asc">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Withdrawals Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-dark-50 border-b border-dark-200">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-dark-600 uppercase tracking-wider">
                  User Info
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-dark-600 uppercase tracking-wider">
                  Device Model
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-dark-600 uppercase tracking-wider">
                  Coins & INR Value
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-dark-600 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-dark-600 uppercase tracking-wider">
                  Payment Target / Code
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-dark-600 uppercase tracking-wider">
                  Time & Date
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-dark-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="w-48 px-4 py-3 text-right text-xs font-semibold text-dark-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                      <span className="text-dark-500">Loading withdrawals...</span>
                    </div>
                  </td>
                </tr>
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-dark-500">
                    No withdrawals found
                  </td>
                </tr>
              ) : (
                withdrawals.map((wd) => {
                  const config = getStatusConfig(wd.status);
                  const isRedeemCode = wd.method?.toLowerCase() === 'redeem code';
                  const isUpi = wd.method?.toLowerCase() === 'upi';
                  const isPaypal = wd.method?.toLowerCase() === 'paypal';

                  const coinsCount = wd.withdrawalCoins || wd.points || 0;
                  const inrValue = Number(wd.coinValueInInr || wd.amount || (coinsCount / 100));
                  const displayUsername =
                    wd.username ||
                    wd.userName ||
                    (wd.userEmail ? wd.userEmail.split('@')[0] : 'User');
                  const displayDevice = wd.deviceModel || wd.deviceName || 'Android';

                  return (
                    <tr key={wd.id} className="hover:bg-dark-50 transition-colors">
                      {/* User Info (Username, Email, ID) */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary-700 font-bold text-xs uppercase">
                              {displayUsername.slice(0, 2)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-dark-900 truncate">
                              {displayUsername}
                            </p>
                            <p className="text-xs text-dark-500 truncate" title={wd.userEmail || wd.userId}>
                              {wd.userEmail || `ID: ${wd.userId?.slice(0, 8)}...`}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Device Model */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-dark-800">
                          <Smartphone className="w-3.5 h-3.5 text-dark-400 flex-shrink-0" />
                          <span className="text-xs font-medium truncate max-w-[130px]" title={displayDevice}>
                            {displayDevice}
                          </span>
                        </div>
                      </td>

                      {/* Withdrawal Coins & Coin Value in INR */}
                      <td className="px-4 py-3">
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-dark-900 text-sm">
                              ₹{inrValue.toFixed(0)} INR
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-primary-600 block">
                            {new Intl.NumberFormat('en-IN').format(coinsCount)} Coins
                          </span>
                        </div>
                      </td>

                      {/* Withdraw Method */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            isRedeemCode
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isPaypal
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}
                        >
                          {isRedeemCode ? (
                            <Gift className="w-3 h-3" />
                          ) : (
                            <CreditCard className="w-3 h-3" />
                          )}
                          {wd.method || 'UPI'}
                        </span>
                      </td>

                      {/* Target Details / Code */}
                      <td className="px-4 py-3">
                        {isRedeemCode ? (
                          wd.redeemCode ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                {wd.redeemCode}
                              </span>
                              <button
                                onClick={() => handleCopy(wd.redeemCode, `code-${wd.id}`)}
                                className="text-dark-400 hover:text-dark-600"
                                title="Copy code"
                              >
                                {copiedKey === `code-${wd.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Awaiting Code
                            </span>
                          )
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-mono text-xs font-medium text-dark-800 truncate max-w-[140px]"
                              title={wd.upiId || wd.paypalEmail || wd.details || 'N/A'}
                            >
                              {wd.upiId || wd.paypalEmail || wd.details || 'N/A'}
                            </span>
                            {(wd.upiId || wd.paypalEmail || wd.details) && (
                              <button
                                onClick={() =>
                                  handleCopy(
                                    wd.upiId || wd.paypalEmail || wd.details,
                                    `detail-${wd.id}`
                                  )
                                }
                                className="text-dark-400 hover:text-dark-600"
                                title="Copy details"
                              >
                                {copiedKey === `detail-${wd.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Time & Date */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-dark-500 whitespace-nowrap">
                          <Clock className="w-3.5 h-3.5 text-dark-400" />
                          {wd.createdAt?.toDate
                            ? format(wd.createdAt.toDate(), 'dd MMM yyyy, hh:mm a')
                            : 'N/A'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`badge ${config.color}`}>
                          <config.Icon className="w-3 h-3 mr-1" />
                          {config.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Pending Actions */}
                          {wd.status === 'pending' && (
                            <>
                              {isRedeemCode ? (
                                <button
                                  onClick={() => {
                                    setRedeemModalWd(wd);
                                    setInputRedeemCode(wd.redeemCode || generateRandomVoucher());
                                  }}
                                  className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                                  title="Assign & Deliver Play Store Redeem Code"
                                >
                                  <Gift className="w-3.5 h-3.5" />
                                  Deliver Code
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    updateMutation.mutate({
                                      id: wd.id,
                                      updates: {
                                        status: 'approved',
                                        adminNote: 'Approved by admin',
                                        processedAt: Timestamp.now(),
                                        updatedAt: Timestamp.now(),
                                      },
                                    })
                                  }
                                  disabled={updateMutation.isPending}
                                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                                  title="Approve"
                                >
                                  <CheckCircle className="w-5 h-5" />
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setRejectModalWd(wd);
                                  setRejectReason('');
                                }}
                                disabled={updateMutation.isPending}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                                title="Reject"
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                            </>
                          )}

                          {/* Approved status -> Mark as Paid */}
                          {wd.status === 'approved' && (
                            <button
                              onClick={() =>
                                updateMutation.mutate({
                                  id: wd.id,
                                  updates: {
                                    status: 'paid',
                                    adminNote: 'Paid by admin',
                                    processedAt: Timestamp.now(),
                                    updatedAt: Timestamp.now(),
                                  },
                                })
                              }
                              disabled={updateMutation.isPending}
                              className="px-2 py-1 rounded bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                              title="Mark as Paid"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              Mark Paid
                            </button>
                          )}

                          {/* View Details */}
                          <button
                            onClick={() => setViewWd(wd)}
                            className="p-1.5 rounded-lg text-dark-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            title="View all withdrawal details"
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

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-dark-200">
            <div className="text-sm text-dark-500">
              Page {currentPage} of {totalPages} ({totalCount || 0} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-dark-300 hover:bg-dark-100 disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-dark-300 hover:bg-dark-100 disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FULL DETAILS MODAL */}
      {viewWd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setViewWd(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto border border-dark-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-dark-200 flex items-center justify-between bg-dark-50/50 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-dark-900">Withdrawal Details</h2>
                <p className="text-xs text-dark-500 mt-0.5">ID: {viewWd.id}</p>
              </div>
              <button
                onClick={() => setViewWd(null)}
                className="w-8 h-8 rounded-full hover:bg-dark-200 flex items-center justify-center text-dark-500 hover:text-dark-700 text-lg transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                {/* Time & Date */}
                <div className="p-3.5 bg-dark-50 rounded-xl col-span-2 border border-dark-100">
                  <p className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-1">
                    Time & Date
                  </p>
                  <p className="font-semibold text-dark-900 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary-600" />
                    {viewWd.createdAt?.toDate
                      ? format(viewWd.createdAt.toDate(), 'eeee, dd MMMM yyyy, hh:mm:ss a')
                      : 'N/A'}
                  </p>
                </div>

                {/* Username & User Info */}
                <div className="p-3.5 bg-dark-50 rounded-xl col-span-2 border border-dark-100">
                  <p className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-1">
                    User Details
                  </p>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-dark-900 text-base">
                        {viewWd.username || viewWd.userName || wdUser?.name || 'Unknown User'}
                      </p>
                      <p className="text-xs text-dark-600 mt-0.5">
                        {viewWd.userEmail || wdUser?.email || 'No email associated'}
                      </p>
                      <p className="text-xs text-dark-400 font-mono mt-1 select-all">
                        UID: {viewWd.userId}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCopy(viewWd.userId, 'modal-uid')}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded bg-primary-50 border border-primary-200"
                    >
                      {copiedKey === 'modal-uid' ? 'Copied' : 'Copy UID'}
                    </button>
                  </div>
                </div>

                {/* Device Model */}
                <div className="p-3.5 bg-dark-50 rounded-xl col-span-2 border border-dark-100">
                  <p className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-1">
                    Device Model
                  </p>
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-primary-600" />
                    <span className="font-semibold text-dark-900 text-sm">
                      {viewWd.deviceModel ||
                        viewWd.deviceName ||
                        wdUser?.deviceModel ||
                        wdUser?.deviceName ||
                        'Unknown Android Device'}
                    </span>
                  </div>
                </div>

                {/* Withdrawal Coins */}
                <div className="p-3.5 bg-dark-50 rounded-xl border border-dark-100">
                  <p className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-1">
                    Withdrawal Coins
                  </p>
                  <p className="font-bold text-primary-700 text-base">
                    {new Intl.NumberFormat('en-IN').format(
                      viewWd.withdrawalCoins || viewWd.points || 0
                    )}{' '}
                    Coins
                  </p>
                </div>

                {/* Coin Value in INR */}
                <div className="p-3.5 bg-dark-50 rounded-xl border border-dark-100">
                  <p className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-1">
                    Coin Value (INR)
                  </p>
                  <p className="font-bold text-emerald-700 text-base">
                    ₹
                    {Number(
                      viewWd.coinValueInInr ||
                        viewWd.amount ||
                        ((viewWd.withdrawalCoins || viewWd.points || 0) / 100)
                    ).toFixed(0)}{' '}
                    INR
                  </p>
                </div>

                {/* Withdraw Method */}
                <div className="p-3.5 bg-dark-50 rounded-xl border border-dark-100">
                  <p className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-1">
                    Withdraw Method
                  </p>
                  <p className="font-semibold text-dark-900 text-sm">
                    {viewWd.method || 'UPI'}
                  </p>
                </div>

                {/* Status */}
                <div className="p-3.5 bg-dark-50 rounded-xl border border-dark-100">
                  <p className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-1">
                    Current Status
                  </p>
                  <span className={`badge ${getStatusConfig(viewWd.status).color}`}>
                    {getStatusConfig(viewWd.status).label}
                  </span>
                </div>

                {/* Payment Target / UPI ID */}
                <div className="p-3.5 bg-dark-50 rounded-xl col-span-2 border border-dark-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-dark-500 uppercase tracking-wider">
                      {viewWd.method?.toLowerCase() === 'paypal'
                        ? 'PayPal Email'
                        : viewWd.method?.toLowerCase() === 'redeem code'
                        ? 'Redeem Code Voucher'
                        : 'UPI ID'}
                    </p>
                    {(viewWd.upiId || viewWd.details || viewWd.paypalEmail) && (
                      <button
                        onClick={() =>
                          handleCopy(
                            viewWd.upiId || viewWd.details || viewWd.paypalEmail,
                            'modal-target'
                          )
                        }
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        {copiedKey === 'modal-target' ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  <p className="font-mono font-bold text-dark-900 text-sm break-all select-all">
                    {viewWd.upiId || viewWd.details || viewWd.paypalEmail || 'In-App Voucher'}
                  </p>
                </div>

                {/* Google Play Redeem Code Display / Delivery */}
                {viewWd.method?.toLowerCase() === 'redeem code' && (
                  <div className="p-3.5 bg-emerald-50 rounded-xl col-span-2 border border-emerald-200">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5" />
                        Google Play Redeem Code
                      </p>
                      {viewWd.redeemCode && (
                        <button
                          onClick={() => handleCopy(viewWd.redeemCode, 'modal-code')}
                          className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
                        >
                          {copiedKey === 'modal-code' ? 'Copied' : 'Copy Code'}
                        </button>
                      )}
                    </div>
                    {viewWd.redeemCode ? (
                      <p className="font-mono font-bold text-emerald-950 text-base select-all tracking-wider">
                        {viewWd.redeemCode}
                      </p>
                    ) : (
                      <div className="mt-2">
                        <p className="text-xs text-amber-700 mb-2 font-medium">
                          No voucher code assigned yet. Click below to deliver a code.
                        </p>
                        <button
                          onClick={() => {
                            setRedeemModalWd(viewWd);
                            setInputRedeemCode(generateRandomVoucher());
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                        >
                          <Gift className="w-3.5 h-3.5" />
                          Assign & Deliver Redeem Code
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Admin Note if any */}
                {viewWd.adminNote && (
                  <div className="p-3 bg-dark-50 rounded-xl col-span-2 border border-dark-100 text-xs text-dark-600">
                    <span className="font-semibold text-dark-700">Admin Note: </span>
                    {viewWd.adminNote}
                  </div>
                )}
              </div>

              {/* Action Buttons in Modal */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-dark-100">
                {viewWd.status === 'pending' && (
                  <>
                    <button
                      onClick={() => {
                        setRejectModalWd(viewWd);
                        setRejectReason('');
                      }}
                      className="btn-danger text-xs py-2 px-3"
                    >
                      Reject Request
                    </button>
                    {viewWd.method?.toLowerCase() === 'redeem code' ? (
                      <button
                        onClick={() => {
                          setRedeemModalWd(viewWd);
                          setInputRedeemCode(viewWd.redeemCode || generateRandomVoucher());
                        }}
                        className="btn-primary text-xs py-2 px-3 bg-emerald-600 hover:bg-emerald-700"
                      >
                        Deliver Code & Approve
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          updateMutation.mutate({
                            id: viewWd.id,
                            updates: {
                              status: 'approved',
                              adminNote: 'Approved by admin',
                              processedAt: Timestamp.now(),
                              updatedAt: Timestamp.now(),
                            },
                          })
                        }
                        className="btn-primary text-xs py-2 px-3"
                      >
                        Approve Withdrawal
                      </button>
                    )}
                  </>
                )}

                {viewWd.status === 'approved' && (
                  <button
                    onClick={() =>
                      updateMutation.mutate({
                        id: viewWd.id,
                        updates: {
                          status: 'paid',
                          adminNote: 'Marked as paid by admin',
                          processedAt: Timestamp.now(),
                          updatedAt: Timestamp.now(),
                        },
                      })
                    }
                    className="btn-primary text-xs py-2 px-3"
                  >
                    Mark as Paid
                  </button>
                )}

                <button onClick={() => setViewWd(null)} className="btn-secondary text-xs py-2 px-3">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELIVER REDEEM CODE MODAL */}
      {redeemModalWd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setRedeemModalWd(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-dark-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
                <Gift className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-dark-900">
                  Deliver Google Play Code
                </h3>
                <p className="text-xs text-dark-500">
                  User:{' '}
                  {redeemModalWd.username ||
                    redeemModalWd.userName ||
                    redeemModalWd.userEmail ||
                    'User'}{' '}
                  | ₹{redeemModalWd.amount || redeemModalWd.coinValueInInr} Voucher
                </p>
              </div>
            </div>

            <form onSubmit={handleDeliverRedeemCode} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-dark-700 uppercase tracking-wider mb-1.5">
                  Google Play Redeem Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={inputRedeemCode}
                    onChange={(e) => setInputRedeemCode(e.target.value)}
                    placeholder="e.g. ABCD-EFGH-IJKL-MNOP"
                    className="input font-mono font-bold tracking-wider uppercase text-base pl-3 pr-24"
                  />
                  <button
                    type="button"
                    onClick={() => setInputRedeemCode(generateRandomVoucher())}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold px-2 py-1 rounded bg-dark-100 hover:bg-dark-200 text-dark-700"
                  >
                    Generate
                  </button>
                </div>
                <p className="text-xs text-dark-400 mt-1">
                  Once saved, this code will instantly appear on the user's "My Rewards" screen in the app.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRedeemModalWd(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Deliver & Approve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalWd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setRejectModalWd(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-dark-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-100 text-red-700">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-dark-900">
                  Reject Withdrawal Request
                </h3>
                <p className="text-xs text-dark-500">
                  User: {rejectModalWd.username || rejectModalWd.userId}
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-dark-700 uppercase tracking-wider mb-1.5">
                  Reason for Rejection (Optional)
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Invalid UPI ID, Multiple account violation, etc."
                  className="input text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalWd(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="btn-danger text-xs flex items-center gap-1.5"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
