import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, onAuthStateChanged, checkIfAdminAsync, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, limit, where, retryWrite, deleteDoubtWithMessages } from './firebase';
import { LayoutDashboard, MessageSquare, Mail, User, Clock, CheckCircle, XCircle, Send, ChevronLeft, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  isAdmin: boolean;
  createdAt: any;
}

interface Doubt {
  id: string;
  uid: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: any;
  status: 'pending' | 'resolved';
}

// ── Memoized sub-components ──

const AdminChatMessage = memo(function AdminChatMessage({ msg }: { msg: Message }) {
  return (
    <div className={`max-w-[70%] flex flex-col ${msg.isAdmin ? 'self-end' : 'self-start'}`}>
      <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${msg.isAdmin ? 'text-right text-[#1B4332]' : 'text-gray-400'}`}>
        {msg.isAdmin ? 'YOU (ADMIN)' : msg.senderName}
      </span>
      <div className={`px-5 py-3 rounded-2xl text-sm font-medium shadow-sm ${
        msg.isAdmin 
          ? 'bg-[#1B4332] text-white rounded-tr-none' 
          : 'bg-gray-100 text-gray-800 rounded-tl-none'
      }`}>
        {msg.text}
      </div>
    </div>
  );
});

const AdminDoubtCard = memo(function AdminDoubtCard({ doubt, onSelect }: {
  doubt: Doubt;
  onSelect: (doubt: Doubt) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all cursor-pointer"
      onClick={() => onSelect(doubt)}
    >
      <div className="flex flex-col md:flex-row justify-between gap-6">
        <div className="flex-grow">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-100">
              Subject: {doubt.subject}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400 font-bold">
              <Clock size={12} />
              {doubt.createdAt?.toDate ? doubt.createdAt.toDate().toLocaleString() : 'Just now'}
            </span>
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-4">{doubt.message}</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
              <User size={14} className="text-[#1B4332]" />
              {doubt.name}
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
              <Mail size={14} className="text-[#1B4332]" />
              {doubt.email}
            </div>
          </div>
        </div>
        <div className="flex md:flex-col gap-2 shrink-0 justify-center">
          <button className="px-6 py-3 bg-[#1B4332] text-white rounded-xl text-xs font-black tracking-widest hover:bg-[#2D6A4F] transition-all flex items-center gap-2">
            <MessageSquare size={16} />
            OPEN CHAT
          </button>
        </div>
      </div>
    </motion.div>
  );
});

// ── Skeleton loader ──
function AdminSkeleton() {
  return (
    <div className="grid gap-6 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            <div className="flex-grow space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-24 bg-gray-100 rounded-full" />
                <div className="h-4 w-32 bg-gray-50 rounded" />
              </div>
              <div className="h-6 bg-gray-100 rounded-xl w-3/4" />
              <div className="flex gap-4">
                <div className="h-4 w-28 bg-gray-50 rounded" />
                <div className="h-4 w-36 bg-gray-50 rounded" />
              </div>
            </div>
            <div className="flex md:flex-col gap-2 shrink-0 justify-center">
              <div className="h-10 w-32 bg-gray-100 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'doubts'>('doubts');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [selectedDoubt, setSelectedDoubt] = useState<Doubt | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let unsubDoubts: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Use async Firestore-based admin check
        const adminStatus = await checkIfAdminAsync(user);
        if (adminStatus) {
          setIsAdmin(true);
          
          if (unsubDoubts) {
            unsubDoubts();
            unsubDoubts = null;
          }

          setLoading(true);
          
          let doubtsQuery;
          if (statusFilter === 'all') {
            doubtsQuery = query(
              collection(db, 'doubts'), 
              orderBy('createdAt', 'desc'),
              limit(50)
            );
          } else {
            doubtsQuery = query(
              collection(db, 'doubts'), 
              where('status', '==', statusFilter),
              orderBy('createdAt', 'desc'),
              limit(50)
            );
          }

          unsubDoubts = onSnapshot(doubtsQuery, (snapshot) => {
            const doubtsList = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Doubt[];
            setDoubts(doubtsList);
            setLoading(false);
          }, (error) => {
            console.error("Error fetching doubts:", error);
            showToast('Failed to load doubts. Please refresh.', 'error');
            setLoading(false);
          });
        } else {
          setIsAdmin(false);
          navigate('/');
        }
      } else {
        setIsAdmin(false);
        if (!loading) navigate('/');
      }
    });

    return () => {
      unsubscribe();
      if (unsubDoubts) unsubDoubts();
    };
  }, [navigate, statusFilter, showToast]);

  useEffect(() => {
    if (selectedDoubt) {
      const q = query(
        collection(db, `doubts/${selectedDoubt.id}/messages`),
        orderBy('createdAt', 'asc')
      );
      const unsubMessages = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];
        setMessages(msgs);
      }, (error) => {
        console.error("Error fetching messages:", error);
        showToast('Failed to load messages.', 'error');
      });
      return () => unsubMessages();
    } else {
      setMessages([]);
    }
  }, [selectedDoubt, showToast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !selectedDoubt || !newMessage.trim()) return;

    try {
      await retryWrite(() => addDoc(collection(db, `doubts/${selectedDoubt.id}/messages`), {
        text: newMessage,
        senderId: auth.currentUser!.uid,
        senderName: auth.currentUser!.displayName || 'Admin',
        isAdmin: true,
        createdAt: serverTimestamp()
      }));
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
      showToast('Failed to send message. Please try again.', 'error');
    }
  }, [selectedDoubt, newMessage, showToast]);

  const handleResolveDoubt = useCallback(async (doubtId: string) => {
    try {
      await retryWrite(() => updateDoc(doc(db, 'doubts', doubtId), {
        status: 'resolved'
      }));
      if (selectedDoubt?.id === doubtId) {
        setSelectedDoubt(prev => prev ? { ...prev, status: 'resolved' } : null);
      }
      showToast('Doubt marked as resolved.', 'success');
    } catch (error) {
      console.error("Error resolving doubt:", error);
      showToast('Failed to resolve doubt. Please try again.', 'error');
    }
  }, [selectedDoubt, showToast]);

  const handleDeleteDoubt = useCallback(async (doubtId: string) => {
    setShowDeleteConfirm(null);
    try {
      await deleteDoubtWithMessages(doubtId);
      setSelectedDoubt(null);
      showToast('Doubt and messages deleted.', 'success');
    } catch (error) {
      console.error("Error deleting doubt:", error);
      showToast('Failed to delete doubt. Please try again.', 'error');
    }
  }, [showToast]);

  const handleSelectDoubt = useCallback((doubt: Doubt) => {
    setSelectedDoubt(doubt);
  }, []);

  if (!isAdmin && !loading) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Admin Header */}
      <div className="bg-[#1B4332] text-white pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
              <LayoutDashboard size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight">Admin Dashboard</h1>
              <p className="text-white/70 font-medium">Manage student inquiries and doubts</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('doubts')}
                className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'doubts' ? 'bg-white text-[#1B4332]' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <MessageSquare size={20} />
                Doubts ({doubts.length})
              </button>
            </div>

            <div className="flex bg-white/10 backdrop-blur-md rounded-2xl p-1.5 border border-white/20">
              {(['pending', 'resolved', 'all'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${
                    statusFilter === status 
                      ? 'bg-white text-[#1B4332] shadow-lg' 
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 -mt-10">
        {loading ? (
          <AdminSkeleton />
        ) : (
          <div className="grid gap-6">
            {activeTab === 'doubts' && (
              selectedDoubt ? (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col h-[700px]"
                >
                  <div className="p-6 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setSelectedDoubt(null)}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <div>
                        <h3 className="font-black text-gray-900 text-lg">{selectedDoubt.name}</h3>
                        <p className="text-sm text-[#1B4332] font-bold">{selectedDoubt.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {selectedDoubt.status === 'pending' && (
                        <button 
                          onClick={() => handleResolveDoubt(selectedDoubt.id)}
                          className="px-4 py-2 bg-green-50 text-green-700 rounded-xl text-[10px] font-black tracking-widest hover:bg-green-100 transition-colors flex items-center gap-2"
                        >
                          <CheckCircle size={14} />
                          RESOLVE
                        </button>
                      )}
                      <button 
                        onClick={() => setShowDeleteConfirm(selectedDoubt.id)}
                        className="px-4 py-2 bg-red-50 text-red-700 rounded-xl text-[10px] font-black tracking-widest hover:bg-red-100 transition-colors flex items-center gap-2"
                      >
                        <Trash2 size={14} />
                        DELETE
                      </button>
                      <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-100">
                        {selectedDoubt.subject}
                      </span>
                    </div>
                  </div>

                  <div className="flex-grow p-6 overflow-y-auto flex flex-col gap-4">
                    {messages.map((msg) => (
                      <AdminChatMessage key={msg.id} msg={msg} />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <form onSubmit={handleSendMessage} className="p-6 border-t border-gray-100 flex gap-3">
                    <input 
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your reply..."
                      className="flex-grow px-6 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-[#1B4332] outline-none transition-all font-bold text-gray-700"
                    />
                    <button 
                      type="submit"
                      className="w-14 h-14 bg-[#1B4332] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#1B4332]/20 hover:bg-[#2D6A4F] transition-all"
                    >
                      <Send size={20} />
                    </button>
                  </form>
                </motion.div>
              ) : (
                doubts.length > 0 ? (
                  doubts.map((doubt) => (
                    <AdminDoubtCard
                      key={doubt.id}
                      doubt={doubt}
                      onSelect={handleSelectDoubt}
                    />
                  ))
                ) : (
                  <div className="bg-white rounded-3xl p-20 shadow-xl text-center">
                    <MessageSquare size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-400 font-bold">No doubts submitted yet.</p>
                  </div>
                )
              )
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto text-red-500 mb-6">
                <Trash2 size={48} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Are you sure?</h3>
              <p className="text-gray-500 font-medium mb-8">This will permanently delete this doubt and all its messages. This action cannot be undone.</p>
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black tracking-widest text-xs hover:bg-gray-200 transition-all"
                >
                  CANCEL
                </button>
                <button 
                  type="button"
                  onClick={() => handleDeleteDoubt(showDeleteConfirm)}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black tracking-widest text-xs shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all"
                >
                  DELETE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
