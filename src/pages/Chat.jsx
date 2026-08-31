import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Send, 
  Search, 
  Filter, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  MessageSquare,
  Mail,
  User,
  Clock,
  MoreVertical,
  Archive,
  Bell
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
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 30;

export default function Chat() {
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const buildChatsQuery = () => {
    let q = collection(db, 'Chats');
    const constraints = [orderBy('lastTimestamp', 'desc'), limit(50)];
    
    if (statusFilter === 'unread') {
      constraints.unshift(where('hasUnreadAdmin', '==', true));
    }
    
    return query(q, ...constraints);
  };

  const { data: chatsData, isLoading: chatsLoading } = useQuery({
    queryKey: ['adminChats', statusFilter],
    queryFn: async () => {
      const q = buildChatsQuery();
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    refetchInterval: 10000,
  });

  const { data: messagesData } = useQuery({
    queryKey: ['chatMessages', selectedChatId],
    queryFn: async () => {
      if (!selectedChatId) return [];
      const q = query(
        collection(db, 'Chats', selectedChatId, 'messages'),
        orderBy('timestamp', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!selectedChatId,
    refetchInterval: 5000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (text) => {
      if (!selectedChatId || !text.trim()) return;
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const msgRef = doc(collection(db, 'Chats', selectedChatId, 'messages'));
      await setDoc(msgRef, {
        senderId: user.uid,
        senderEmail: user.email || 'admin',
        text: text.trim(),
        isAdmin: true,
        timestamp: Timestamp.now(),
      });
      
      await updateDoc(doc(db, 'Chats', selectedChatId), {
        lastMessage: text.trim(),
        lastTimestamp: Timestamp.now(),
        hasUnreadUser: true,
        hasUnreadAdmin: false,
      });
    },
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['adminChats'] });
    },
    onError: () => toast.error('Failed to send message'),
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (chatId) => {
      await updateDoc(doc(db, 'Chats', chatId), { hasUnreadAdmin: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminChats'] });
    },
  });

  const handleSelectChat = (chat) => {
    setSelectedChatId(chat.id);
    setSelectedUserEmail(chat.userEmail);
    if (chat.hasUnreadAdmin) {
      markAsReadMutation.mutate(chat.id);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim()) {
      sendMessageMutation.mutate(messageInput);
    }
  };

  const filteredChats = chatsData?.filter(chat => 
    chat.userEmail?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messagesData]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Chat & Support</h1>
          <p className="text-dark-500 mt-1">Communicate with users and manage support tickets</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ['adminChats'] })}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      <div className="card min-h-[600px] flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
        {/* Chat List */}
        <div className="w-full lg:w-96 border-r border-dark-200 flex flex-col">
          <div className="p-4 border-b border-dark-200 flex flex-col sm:flex-row sm:items-center gap-3">
            <h3 className="font-semibold text-dark-900">Conversations</h3>
            <span className={'badge ' + (filteredChats.filter(c => c.hasUnreadAdmin).length > 0 ? 'badge-warning' : 'badge-success')}>
              {filteredChats.filter(c => c.hasUnreadAdmin).length} unread
            </span>
          </div>
          
          <div className="p-4 border-b border-dark-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2 px-4 py-2 border-b border-dark-200">
            {['all', 'unread', 'read'].map(filter => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  statusFilter === filter
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-dark-500 hover:bg-dark-100'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {chatsLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-12 bg-dark-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="p-8 text-center text-dark-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-dark-300" />
                <p>No conversations found</p>
                <p className="text-sm mt-1">Users will appear here when they start a chat</p>
              </div>
            ) : (
              <div className="divide-y divide-dark-100">
                {filteredChats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => handleSelectChat(chat)}
                    className={`w-full p-4 text-left transition-colors ${
                      selectedChatId === chat.id
                        ? 'bg-primary-50'
                        : 'hover:bg-dark-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        chat.hasUnreadAdmin ? 'bg-primary-100' : 'bg-dark-100'
                      }`}>
                        <span className={`font-bold ${chat.hasUnreadAdmin ? 'text-primary-700' : 'text-dark-500'}`}>
                          {chat.userEmail?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-dark-900 truncate pr-2">{chat.userEmail}</p>
                          {chat.hasUnreadAdmin && (
                            <span className="badge badge-warning text-xs">New</span>
                          )}
                        </div>
                        <p className="text-sm text-dark-500 truncate mt-1">{chat.lastMessage}</p>
                        <p className="text-xs text-dark-400 mt-1">
                          {chat.lastTimestamp?.toDate ? formatDistanceToNow(chat.lastTimestamp.toDate(), { addSuffix: true }) : 'Just now'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Detail */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedChatId ? (
            <>
              <div className="p-4 border-b border-dark-200 flex items-center gap-3">
                <button
                  onClick={() => { setSelectedChatId(null); setSelectedUserEmail(null); }}
                  className="lg:hidden p-2 rounded-lg text-dark-400 hover:bg-dark-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-700 font-bold">{selectedUserEmail?.[0]?.toUpperCase() || '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-dark-900 truncate">{selectedUserEmail}</p>
                  <p className="text-xs text-dark-500">Chat ID: {selectedChatId?.slice(0, 8)}...</p>
                </div>
                <button
                  onClick={() => toast('Archive functionality coming soon')}
                  className="p-2 rounded-lg text-dark-400 hover:bg-dark-100"
                  title="Archive"
                >
                  <Archive className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={el => { if (el) el.scrollTop = el.scrollHeight; }}>
                {messagesData?.map(msg => (
                  <div key={msg.id} className={`flex ${msg.isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                        msg.isAdmin
                          ? 'bg-primary-600 text-white rounded-br-md'
                          : 'bg-dark-100 text-dark-900 rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      <p className={`text-xs mt-1 ${msg.isAdmin ? 'text-primary-100' : 'text-dark-400'}`}>
                        {msg.timestamp?.toDate ? format(msg.timestamp.toDate(), 'HH:mm') : 'Now'}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-dark-200">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 input"
                    disabled={sendMessageMutation.isPending}
                  />
                  <button
                    type="submit"
                    disabled={!messageInput.trim() || sendMessageMutation.isPending}
                    className="btn-primary"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-dark-500">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-dark-300" />
                <h3 className="text-lg font-medium text-dark-900">Select a conversation</h3>
                <p className="mt-1">Choose a user from the list to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}