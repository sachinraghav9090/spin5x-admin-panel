import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Search, Loader2, RefreshCw, MessageSquare, Archive, CheckCircle2, User, Mail, Tag, Smartphone } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { db, auth } from '../firebase/config.js';
import {
  collection,
  query,
  limit,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
  addDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function Chat() {
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState(null);
  const [selectedUserName, setSelectedUserName] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('open');
  const [messageInput, setMessageInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  // Index-free query to ensure support tickets always load without requiring Firestore composite indexes
  const { data: chatsData, isLoading: chatsLoading, refetch } = useQuery({
    queryKey: ['adminChats'],
    queryFn: async () => {
      try {
        const col = collection(db, 'Tickets');
        const q = query(col, limit(300));
        const snap = await getDocs(q);
        let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Fallback: If Tickets collection is empty, check legacy 'Chats' collection
        if (list.length === 0) {
          try {
            const legacySnap = await getDocs(query(collection(db, 'Chats'), limit(150)));
            if (!legacySnap.empty) {
              list = legacySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            }
          } catch (e) {
            console.warn('Fallback Chats query:', e);
          }
        }

        // Sort in memory by lastTimestamp or createdAt descending
        list.sort((a, b) => {
          const getMillis = (obj) => {
            if (!obj) return 0;
            if (typeof obj.toMillis === 'function') return obj.toMillis();
            if (typeof obj.toDate === 'function') return obj.toDate().getTime();
            if (obj.seconds) return obj.seconds * 1000;
            if (typeof obj === 'number') return obj > 1e11 ? obj : obj * 1000;
            const parsed = new Date(obj).getTime();
            return isNaN(parsed) ? 0 : parsed;
          };
          const tA = getMillis(a.lastTimestamp) || getMillis(a.createdAt);
          const tB = getMillis(b.lastTimestamp) || getMillis(b.createdAt);
          return tB - tA;
        });

        return list;
      } catch (err) {
        console.error('Failed to fetch tickets:', err);
        toast.error('Error fetching tickets: ' + (err.message || 'Unknown error'));
        return [];
      }
    },
    refetchInterval: 5000,
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['chatMessages', selectedChatId],
    queryFn: async () => {
      if (!selectedChatId) return [];
      try {
        const q = query(collection(db, 'Tickets', selectedChatId, 'messages'), limit(300));
        const snap = await getDocs(q);
        const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // In-memory sort by timestamp ascending
        msgs.sort((a, b) => {
          const getMillis = (obj) => {
            if (!obj) return 0;
            if (typeof obj.toMillis === 'function') return obj.toMillis();
            if (typeof obj.toDate === 'function') return obj.toDate().getTime();
            if (obj.seconds) return obj.seconds * 1000;
            return 0;
          };
          return getMillis(a.timestamp) - getMillis(b.timestamp);
        });
        return msgs;
      } catch (err) {
        console.error('Failed to fetch messages:', err);
        return [];
      }
    },
    enabled: !!selectedChatId,
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: async (text) => {
      if (!selectedChatId || !text.trim()) return;
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      await addDoc(collection(db, 'Tickets', selectedChatId, 'messages'), {
        senderId: user.uid,
        senderEmail: user.email || 'admin',
        text: text.trim(),
        isAdmin: true,
        timestamp: Timestamp.now(),
      });

      await updateDoc(doc(db, 'Tickets', selectedChatId), {
        lastMessage: text.trim(),
        lastTimestamp: Timestamp.now(),
        hasUnreadUser: true,
        hasUnreadAdmin: false,
        status: 'open',
      });
    },
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['chatMessages', selectedChatId] });
      queryClient.invalidateQueries({ queryKey: ['adminChats'] });
    },
    onError: () => toast.error('Failed to send message'),
  });

  const markReadMutation = useMutation({
    mutationFn: async (chatId) => {
      await updateDoc(doc(db, 'Tickets', chatId), { hasUnreadAdmin: false });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminChats'] }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ chatId, newStatus }) => {
      await updateDoc(doc(db, 'Tickets', chatId), { status: newStatus });
    },
    onSuccess: (_, { newStatus }) => {
      setSelectedStatus(newStatus);
      toast.success(`Ticket marked as ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ['adminChats'] });
    },
    onError: () => toast.error('Failed to update ticket status'),
  });

  const deleteTicketMutation = useMutation({
    mutationFn: async (chatId) => {
      try {
        const msgsSnap = await getDocs(collection(db, 'Tickets', chatId, 'messages'));
        const batch = writeBatch(db);
        msgsSnap.forEach((m) => batch.delete(m.ref));
        batch.delete(doc(db, 'Tickets', chatId));
        await batch.commit();
      } catch (err) {
        await deleteDoc(doc(db, 'Tickets', chatId));
      }
    },
    onSuccess: () => {
      toast.success('Ticket deleted permanently');
      setSelectedChatId(null);
      setSelectedUserEmail(null);
      setSelectedUserName(null);
      setSelectedSubject(null);
      queryClient.invalidateQueries({ queryKey: ['adminChats'] });
    },
    onError: () => toast.error('Failed to delete ticket'),
  });

  const handleSelectChat = (chat) => {
    setSelectedChatId(chat.id);
    setSelectedUserEmail(chat.userEmail || '');
    setSelectedUserName(chat.userName || '');
    setSelectedSubject(chat.subject || 'Support Ticket');
    setSelectedStatus(chat.status || 'open');
    if (chat.hasUnreadAdmin) markReadMutation.mutate(chat.id);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (messageInput.trim()) sendMutation.mutate(messageInput);
  };

  // Client-side filtering
  const filteredChats = (chatsData || []).filter((chat) => {
    // 1. Status Filter
    if (statusFilter === 'unread') {
      if (!chat.hasUnreadAdmin) return false;
    } else if (statusFilter === 'open') {
      if (chat.status === 'closed') return false;
    } else if (statusFilter === 'closed') {
      if (chat.status !== 'closed') return false;
    }

    // 2. Search Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchEmail = chat.userEmail?.toLowerCase().includes(q);
      const matchName = chat.userName?.toLowerCase().includes(q);
      const matchSub = chat.subject?.toLowerCase().includes(q);
      const matchMsg = chat.lastMessage?.toLowerCase().includes(q);
      const matchId = chat.id?.toLowerCase().includes(q) || chat.userId?.toLowerCase().includes(q);
      if (!matchEmail && !matchName && !matchSub && !matchMsg && !matchId) return false;
    }

    return true;
  });

  const unreadCount = (chatsData || []).filter((c) => c.hasUnreadAdmin).length;
  const openCount = (chatsData || []).filter((c) => c.status !== 'closed').length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Support & Tickets</h1>
          <p className="text-dark-500 mt-1">Communicate with users, resolve queries, and manage tickets</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-primary text-xs font-semibold px-2.5 py-1">
            {openCount} Open Tickets
          </span>
          <button
            className="btn-secondary flex items-center"
            onClick={() => {
              refetch();
              toast.success('Tickets refreshed');
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      <div className="card flex flex-col lg:flex-row p-0 overflow-hidden" style={{ height: 'calc(100vh - 240px)', minHeight: '550px' }}>
        {/* Chat List */}
        <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-dark-200 flex flex-col bg-white">
          <div className="p-4 border-b border-dark-200 flex items-center justify-between bg-dark-50/50">
            <h3 className="font-bold text-dark-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary-600" />
              Conversations
            </h3>
            <span className={`badge ${unreadCount > 0 ? 'badge-warning' : 'badge-success'}`}>
              {unreadCount} unread
            </span>
          </div>

          <div className="p-3 border-b border-dark-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
              <input
                type="text"
                placeholder="Search user, email, subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9 text-xs py-2"
              />
            </div>
          </div>

          <div className="flex gap-1.5 p-2.5 border-b border-dark-200 bg-dark-50/30 overflow-x-auto">
            {[
              { id: 'open', label: 'Open' },
              { id: 'unread', label: 'Unread' },
              { id: 'closed', label: 'Closed' },
              { id: 'all', label: 'All' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                  statusFilter === f.id
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-dark-600 hover:bg-dark-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {chatsLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse flex items-start gap-3">
                    <div className="w-10 h-10 bg-dark-200 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-dark-200 rounded w-3/4" />
                      <div className="h-3 bg-dark-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="p-8 text-center text-dark-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-dark-300" />
                <p className="font-medium text-dark-700">No conversations found</p>
                <p className="text-xs text-dark-400 mt-1">
                  {statusFilter !== 'all' ? `No tickets in '${statusFilter}' status` : 'Tickets opened by users will appear here automatically'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-dark-100">
                {filteredChats.map((chat) => {
                  const displayName =
                    chat.userName ||
                    chat.userEmail?.split('@')[0] ||
                    `User ${chat.userId?.slice(0, 6) || chat.id.slice(0, 6)}`;
                  const isSelected = selectedChatId === chat.id;

                  return (
                    <button
                      key={chat.id}
                      onClick={() => handleSelectChat(chat)}
                      className={`w-full p-3.5 text-left transition-colors ${
                        isSelected ? 'bg-primary-50/80 border-l-4 border-primary-600' : 'hover:bg-dark-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold uppercase ${
                            chat.hasUnreadAdmin
                              ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400'
                              : 'bg-primary-100 text-primary-700'
                          }`}
                        >
                          {displayName[0] || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-semibold text-sm text-dark-900 truncate">{displayName}</p>
                            {chat.hasUnreadAdmin && (
                              <span className="badge badge-warning text-[10px] py-0 px-1.5 font-bold uppercase">
                                New
                              </span>
                            )}
                          </div>
                          {chat.userEmail && (
                            <p className="text-xs text-dark-500 truncate">{chat.userEmail}</p>
                          )}
                          <p className="text-xs font-medium text-primary-700 truncate mt-1 flex items-center gap-1">
                            <Tag className="w-3 h-3 flex-shrink-0" />
                            {chat.subject || 'Support Ticket'}
                          </p>
                          <p className="text-xs text-dark-500 truncate mt-0.5">
                            {chat.lastMessage || 'No messages yet'}
                          </p>
                          <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-dark-100 text-[11px] text-dark-400">
                            <span
                              className={`px-1.5 py-0.2 rounded font-semibold uppercase text-[10px] ${
                                chat.status === 'closed'
                                  ? 'bg-gray-100 text-gray-600'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {chat.status || 'open'}
                            </span>
                            <span>
                              {chat.lastTimestamp?.toDate
                                ? formatDistanceToNow(chat.lastTimestamp.toDate(), { addSuffix: true })
                                : 'Recent'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chat Detail */}
        <div className="flex-1 flex flex-col min-w-0 bg-dark-50/20">
          {selectedChatId ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-dark-200 flex items-center justify-between bg-white shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => {
                      setSelectedChatId(null);
                      setSelectedUserEmail(null);
                      setSelectedUserName(null);
                      setSelectedSubject(null);
                    }}
                    className="lg:hidden p-2 rounded-lg text-dark-400 hover:bg-dark-100"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold uppercase text-base flex-shrink-0">
                    {(selectedUserName || selectedUserEmail || 'U')[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-dark-900 text-sm sm:text-base truncate">
                        {selectedSubject}
                      </p>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          selectedStatus === 'closed'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {selectedStatus}
                      </span>
                    </div>
                    <p className="text-xs text-dark-500 truncate flex items-center gap-1.5 mt-0.5">
                      {selectedUserName && <span className="font-semibold text-dark-800">{selectedUserName}</span>}
                      {selectedUserName && selectedUserEmail && <span>•</span>}
                      {selectedUserEmail && <span>{selectedUserEmail}</span>}
                      <span>•</span>
                      <span className="font-mono text-dark-400">ID: {selectedChatId.slice(0, 8)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {selectedStatus === 'open' ? (
                    <button
                      onClick={() =>
                        toggleStatusMutation.mutate({ chatId: selectedChatId, newStatus: 'closed' })
                      }
                      disabled={toggleStatusMutation.isPending}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 flex items-center"
                      title="Mark ticket as resolved"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Mark Resolved
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        toggleStatusMutation.mutate({ chatId: selectedChatId, newStatus: 'open' })
                      }
                      disabled={toggleStatusMutation.isPending}
                      className="px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors border border-primary-200 flex items-center"
                      title="Reopen ticket"
                    >
                      Reopen
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to permanently delete this ticket and all its messages?')) {
                        deleteTicketMutation.mutate(selectedChatId);
                      }
                    }}
                    disabled={deleteTicketMutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center border border-red-200"
                    title="Delete permanently"
                  >
                    <Archive className="w-3.5 h-3.5 mr-1" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading && (
                  <div className="flex justify-center p-4">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                  </div>
                )}
                {messagesData?.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm ${
                        msg.isAdmin
                          ? 'bg-primary-600 text-white rounded-br-none'
                          : 'bg-white text-dark-900 border border-dark-200 rounded-bl-none'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[10px] font-bold uppercase ${msg.isAdmin ? 'text-primary-100' : 'text-primary-700'}`}>
                          {msg.isAdmin ? 'Admin (You)' : (selectedUserName || 'User')}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      <p
                        className={`text-[10px] mt-1 text-right ${
                          msg.isAdmin ? 'text-primary-200' : 'text-dark-400'
                        }`}
                      >
                        {msg.timestamp?.toDate
                          ? format(msg.timestamp.toDate(), 'hh:mm a, dd MMM')
                          : 'Just now'}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Box */}
              <div className="p-4 border-t border-dark-200 bg-white">
                <form onSubmit={handleSend} className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type your reply here..."
                    className="flex-1 input text-sm"
                    disabled={sendMutation.isPending}
                  />
                  <button
                    type="submit"
                    disabled={!messageInput.trim() || sendMutation.isPending}
                    className="btn-primary flex items-center px-4"
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-1.5" />
                        Send
                      </>
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-dark-500 p-8">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-dark-900">Select a support ticket</h3>
                <p className="text-xs text-dark-500 mt-1.5 leading-relaxed">
                  Choose a ticket from the left panel to read the user's issue and reply directly in real-time.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
