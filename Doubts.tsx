import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, Send, MessageSquare, User, Tag, ChevronRight, Search, Lock, Clock, MessageCircle, Trash2, XCircle } from 'lucide-react';
import { auth, db, collection, addDoc, serverTimestamp, onAuthStateChanged, signInWithGoogle, handleFirestoreError, OperationType, type User as FirebaseUser, query, where, orderBy, onSnapshot, doc, checkIfAdmin, setDoc, retryWrite, deleteDoubtWithMessages } from './firebase';
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
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: any;
  status: 'pending' | 'resolved';
}

const CATEGORIES = [
  'Mathematics',
  'English',
  'GK',
  'Current Affairs',
  'SSB',
  'NCC',
  'Fitness',
  'Strategy'
];

// ── Memoized sub-components to prevent unnecessary re-renders ──

const ChatMessage = memo(function ChatMessage({ msg }: { msg: Message }) {
  return (
    <div className={`max-w-[80%] flex flex-col ${msg.isAdmin ? 'self-start' : 'self-end'}`}>
      <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${msg.isAdmin ? 'text-[#1B4332]' : 'text-gray-400 text-right'}`}>
        {msg.isAdmin ? 'ADMIN MENTOR' : 'YOU'}
      </span>
      <div className={`px-5 py-3 rounded-2xl text-sm font-medium shadow-sm ${
        msg.isAdmin 
          ? 'bg-white text-gray-800 rounded-tl-none border border-gray-100' 
          : 'bg-[#1B4332] text-white rounded-tr-none'
      }`}>
        {msg.text}
      </div>
    </div>
  );
});

const DoubtListItem = memo(function DoubtListItem({ doubt, isSelected, onSelect, onDelete }: {
  doubt: Doubt;
  isSelected: boolean;
  onSelect: (doubt: Doubt) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.button
      onClick={() => onSelect(doubt)}
      whileHover={{ x: 10 }}
      className={`w-full text-left bg-white rounded-3xl p-6 border transition-all flex items-center justify-between group ${
        isSelected 
          ? 'border-[#1B4332] shadow-lg ring-1 ring-[#1B4332]' 
          : 'border-gray-100 shadow-sm hover:shadow-md'
      }`}
    >
      <div className="flex items-center gap-6">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
          isSelected ? 'bg-[#1B4332] text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-[#1B4332]/5 group-hover:text-[#1B4332]'
        }`}>
          <MessageSquare size={24} />
        </div>
        <div>
          <h4 className="font-black text-gray-900 line-clamp-1">{doubt.message}</h4>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">
              {doubt.subject}
            </span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="text-[9px] font-bold text-gray-400">
              {doubt.createdAt?.toDate ? doubt.createdAt.toDate().toLocaleDateString() : 'Just now'}
            </span>
            {doubt.status === 'resolved' && (
              <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[8px] font-black uppercase tracking-widest rounded-full border border-green-100">
                RESOLVED
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(doubt.id);
          }}
          className="p-2 hover:bg-red-50 text-red-400 hover:text-red-500 rounded-full transition-colors"
          title="Delete Chat"
        >
          <Trash2 size={20} />
        </button>
        <ChevronRight size={20} className={`transition-transform ${isSelected ? 'text-[#1B4332] translate-x-2' : 'text-gray-300 group-hover:text-[#1B4332]'}`} />
      </div>
    </motion.button>
  );
});

// ── Skeleton loader for initial auth state ──
function DoubtsSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100">
        <div className="h-8 bg-gray-100 rounded-xl w-1/3 mb-8" />
        <div className="space-y-6">
          <div className="h-12 bg-gray-50 rounded-2xl" />
          <div className="h-12 bg-gray-50 rounded-2xl" />
          <div className="h-24 bg-gray-50 rounded-2xl" />
          <div className="h-14 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default function Doubts() {
  const [myDoubts, setMyDoubts] = useState<Doubt[]>([]);
  const [selectedDoubt, setSelectedDoubt] = useState<Doubt | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Mathematics',
    question: ''
  });
  const [errors, setErrors] = useState<{ name?: string; question?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let unsubDoubts: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      if (unsubDoubts) {
        unsubDoubts();
        unsubDoubts = null;
      }

      if (currentUser) {
        if (checkIfAdmin(currentUser)) {
          navigate('/admin');
          return;
        }
        setFormData(prev => ({ ...prev, name: currentUser.displayName || '' }));
        
        const q = query(
          collection(db, 'doubts'),
          where('uid', '==', currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        
        unsubDoubts = onSnapshot(q, (snapshot) => {
          const doubtsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Doubt[];
          setMyDoubts(doubtsList);
        }, (error) => {
          console.error("Error fetching doubts:", error);
          if (error.message.includes('requires an index')) {
            showToast('Database index required. Please contact admin.', 'error');
          }
        });
      } else {
        setMyDoubts([]);
        setSelectedDoubt(null);
      }
    });

    return () => {
      unsubscribe();
      if (unsubDoubts) unsubDoubts();
    };
  }, [navigate, showToast]);

  useEffect(() => {
    if (!selectedDoubt) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, `doubts/${selectedDoubt.id}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
    }, (error) => {
      console.error("Error fetching messages:", error);
      showToast('Failed to load messages. Please try again.', 'error');
    });

    return () => unsubscribe();
  }, [selectedDoubt, showToast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const validate = useCallback(() => {
    const newErrors: { name?: string; question?: string } = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.question.trim()) {
      newErrors.question = 'Question is required';
    } else if (formData.question.trim().length < 10) {
      newErrors.question = 'Question must be at least 10 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData.name, formData.question]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      signInWithGoogle();
      return;
    }
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const doubtRef = doc(collection(db, 'doubts'));
      const messageRef = doc(collection(db, `doubts/${doubtRef.id}/messages`));
      
      const doubtData = {
        uid: user.uid,
        name: formData.name,
        email: user.email,
        subject: formData.category,
        message: formData.question,
        status: 'pending' as const,
        createdAt: serverTimestamp()
      };

      const messageData = {
        text: formData.question,
        senderId: user.uid,
        senderName: user.displayName || 'Student',
        isAdmin: false,
        createdAt: serverTimestamp()
      };

      await retryWrite(() => setDoc(doubtRef, doubtData));
      await retryWrite(() => setDoc(messageRef, messageData));

      const newDoubt: Doubt = {
        id: doubtRef.id,
        ...doubtData,
        createdAt: { toDate: () => new Date() }
      };
      
      setSelectedDoubt(newDoubt);
      setFormData({ name: user.displayName || '', category: 'Mathematics', question: '' });
      setShowSuccess(true);
      showToast('Doubt submitted successfully!', 'success');
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error submitting doubt:', error);
      showToast('Failed to submit doubt. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [user, formData, validate, showToast]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDoubt || !newMessage.trim()) return;

    try {
      await retryWrite(() => addDoc(collection(db, `doubts/${selectedDoubt.id}/messages`), {
        text: newMessage,
        senderId: user.uid,
        senderName: user.displayName || 'Student',
        isAdmin: false,
        createdAt: serverTimestamp()
      }));
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
      showToast('Failed to send message. Please try again.', 'error');
    }
  }, [user, selectedDoubt, newMessage, showToast]);

  const handleDeleteDoubt = useCallback(async (doubtId: string) => {
    setShowDeleteConfirm(null);
    try {
      await deleteDoubtWithMessages(doubtId);
      if (selectedDoubt?.id === doubtId) {
        setSelectedDoubt(null);
      }
      showToast('Doubt deleted successfully.', 'success');
    } catch (error: any) {
      console.error("Error deleting doubt:", error);
      showToast('Failed to delete doubt. Please try again.', 'error');
    }
  }, [selectedDoubt, showToast]);

  const handleSelectDoubt = useCallback((doubt: Doubt) => {
    setSelectedDoubt(doubt);
  }, []);

  const handleRequestDelete = useCallback((id: string) => {
    setShowDeleteConfirm(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Hero Section */}
      <section className="relative py-48 pt-32 bg-[#050A0F] overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1B4332]/40 to-transparent"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/camouflage.png')]"></div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-7xl mx-auto px-4 text-center"
        >
          <span className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-[10px] font-black tracking-[0.4em] uppercase mb-8">
            PRIVATE MENTORSHIP
          </span>
          <h1 className="text-7xl md:text-[10rem] font-display text-white mb-8 tracking-tighter text-glow-white leading-none">
            DOUBTS
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-lg md:text-2xl font-medium leading-relaxed tracking-tight">
            Ask your doubts privately. Our mentors will reply to you directly in a chat.
          </p>
        </motion.div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-24 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Ask Form */}
          <div className="lg:col-span-4">
            {authLoading ? (
              <DoubtsSkeleton />
            ) : (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-[2.5rem] p-10 shadow-[0_40px_100px_rgba(0,0,0,0.03)] border border-gray-100 sticky top-32"
              >
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 rounded-2xl bg-[#1B4332]/5 flex items-center justify-center text-[#1B4332] shadow-inner">
                    <HelpCircle size={28} />
                  </div>
                  <h2 className="text-3xl font-black tracking-tighter text-[#1A1A1A]">Ask Now</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  <AnimatePresence>
                    {showSuccess && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-green-50 text-green-700 p-5 rounded-2xl text-[10px] font-black tracking-[0.2em] uppercase border border-green-100 mb-6"
                      >
                        Question submitted! Chat opened.
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!user ? (
                    <div className="text-center py-10 space-y-6">
                      <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto text-gray-300">
                        <Lock size={32} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black tracking-tight text-gray-800">Sign In Required</h3>
                        <p className="text-sm text-gray-500 font-medium mt-2">Please sign in to ask a private doubt.</p>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={signInWithGoogle}
                        className="w-full py-4 bg-[#1B4332] text-white rounded-2xl font-black tracking-widest text-xs shadow-xl shadow-[#1B4332]/10"
                      >
                        SIGN IN WITH GOOGLE
                      </motion.button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] ml-1">Your Name</label>
                        <input 
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          placeholder="e.g. Rahul Singh"
                          className="w-full px-6 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-[#1B4332] outline-none transition-all font-bold text-gray-700"
                        />
                        {errors.name && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.name}</p>}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] ml-1">Category</label>
                        <select 
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value})}
                          className="w-full px-6 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-[#1B4332] outline-none transition-all font-bold text-gray-700 appearance-none cursor-pointer"
                        >
                          {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] ml-1">Your Question</label>
                        <textarea 
                          value={formData.question}
                          onChange={(e) => setFormData({...formData, question: e.target.value})}
                          placeholder="Describe your doubt..."
                          rows={4}
                          className="w-full px-6 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-[#1B4332] outline-none transition-all font-bold text-gray-700 resize-none"
                        />
                        {errors.question && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.question}</p>}
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={isSubmitting}
                        type="submit"
                        className="w-full py-5 bg-[#1B4332] text-white rounded-2xl font-black tracking-[0.3em] uppercase text-xs flex items-center justify-center gap-3 shadow-lg shadow-[#1B4332]/20"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            SUBMITTING...
                          </>
                        ) : 'SUBMIT DOUBT'}
                      </motion.button>
                    </>
                  )}
                </form>
              </motion.div>
            )}
          </div>

          {/* Right Column: Active Chat & History */}
          <div className="lg:col-span-8 space-y-12">
            {/* Active Chat Section */}
            <AnimatePresence mode="wait">
              {selectedDoubt ? (
                <motion.div
                  key={`chat-${selectedDoubt.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white rounded-[2.5rem] shadow-2xl border border-[#1B4332]/10 overflow-hidden flex flex-col h-[600px]"
                >
                  <div className="p-6 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#1B4332] flex items-center justify-center text-white">
                        <MessageSquare size={20} />
                      </div>
                      <div>
                        <h3 className="font-black text-gray-900 text-lg line-clamp-1">{selectedDoubt.message}</h3>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[8px] font-black uppercase tracking-widest rounded-full border border-amber-100">
                            {selectedDoubt.subject}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold">
                            Status: {selectedDoubt.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setShowDeleteConfirm(selectedDoubt.id)}
                          className="p-2 hover:bg-red-50 text-red-400 hover:text-red-500 rounded-full transition-colors"
                          title="Delete Chat"
                        >
                          <Trash2 size={20} />
                        </button>
                        <button 
                          onClick={() => setSelectedDoubt(null)}
                          className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400"
                        >
                          <XCircle size={24} />
                        </button>
                      </div>
                  </div>

                  <div className="flex-grow p-6 overflow-y-auto flex flex-col gap-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-opacity-5">
                    {messages.map((msg) => (
                      <ChatMessage key={msg.id} msg={msg} />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <form onSubmit={handleSendMessage} className="p-6 border-t border-gray-100 flex gap-3 bg-white">
                    <input 
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-grow px-6 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-[#1B4332] outline-none transition-all font-bold text-gray-700"
                    />
                    <button 
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="w-14 h-14 bg-[#1B4332] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#1B4332]/20 hover:bg-[#2D6A4F] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={20} />
                    </button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="no-chat"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white rounded-[2.5rem] p-20 text-center border border-dashed border-gray-200 flex flex-col items-center justify-center gap-6"
                >
                  <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center text-gray-200">
                    <MessageCircle size={48} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-gray-800 tracking-tight">Select a Chat</h3>
                    <p className="text-gray-400 font-medium mt-2">Choose a previous doubt below to continue the conversation.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* History Section */}
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black tracking-tighter text-[#1A1A1A]">Previous Doubts</h2>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#1B4332] animate-pulse" />
                  <span className="text-[10px] font-black tracking-widest text-[#1B4332] uppercase">
                    {myDoubts.length} TOTAL
                  </span>
                </div>
              </div>

              <div className="grid gap-4">
                {myDoubts.length > 0 ? (
                  myDoubts.map((doubt) => (
                    <DoubtListItem
                      key={doubt.id}
                      doubt={doubt}
                      isSelected={selectedDoubt?.id === doubt.id}
                      onSelect={handleSelectDoubt}
                      onDelete={handleRequestDelete}
                    />
                  ))
                ) : (
                  <div className="bg-white rounded-[2.5rem] p-12 text-center border border-dashed border-gray-200">
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No history yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
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
