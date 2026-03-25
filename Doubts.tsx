import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signInWithGoogle, onAuthStateChanged, type User as FirebaseUser } from './firebase';
import { Lock, MessageSquare, Send, Clock, ChevronLeft, RefreshCw, HelpCircle } from 'lucide-react';
import { useToast } from './Toast';

const CATEGORIES = [
  'General Inquiry',
  'Mathematics',
  'General Ability Test (GAT)',
  'SSB Interview',
  'Physical Training',
  'Medical Queries',
  'Technical Issue'
];

interface Message {
  doubtId: string;
  senderName: string;
  message: string;
  isAdmin: boolean;
  date: string;
}

interface Doubt {
  id: string;
  name: string;
  email: string;
  category: string;
  question: string;
  status: string;
  date: string;
}

// ── Memoized sub-components ──

const ChatMessage = memo(function ChatMessage({ msg }: { msg: Message }) {
  const dateStr = msg.date ? new Date(msg.date).toLocaleString() : '';
  return (
    <div className={`max-w-[80%] flex flex-col ${msg.isAdmin ? 'self-start' : 'self-end'}`}>
      <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${msg.isAdmin ? 'text-[#1B4332]' : 'text-gray-400 text-right'}`}>
        {msg.isAdmin ? msg.senderName.toUpperCase() : 'YOU'}
      </span>
      <div className={`px-5 py-3 rounded-2xl text-sm font-medium shadow-sm ${
        msg.isAdmin
          ? 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
          : 'bg-[#1B4332] text-white rounded-tr-none'
      }`}>
        {msg.message}
      </div>
      {dateStr && (
        <span className={`text-[8px] text-gray-300 mt-1 ${msg.isAdmin ? '' : 'text-right'}`}>
          {dateStr}
        </span>
      )}
    </div>
  );
});

const DoubtListItem = memo(function DoubtListItem({ doubt, isSelected, onSelect }: {
  doubt: Doubt;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const dateStr = doubt.date ? new Date(doubt.date).toLocaleDateString() : 'Just now';
  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ x: 4 }}
      className={`w-full p-6 rounded-[2rem] text-left transition-all border ${
        isSelected
          ? 'bg-[#1B4332] border-[#1B4332] shadow-xl shadow-[#1B4332]/20'
          : 'bg-white border-gray-100 hover:border-[#1B4332]/30 shadow-sm hover:shadow-md'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
          isSelected
            ? 'bg-white/10 text-white border-white/20'
            : 'bg-amber-50 text-amber-600 border-amber-100'
        }`}>
          {doubt.category}
        </span>
        <span className={`text-[8px] font-black uppercase tracking-widest ${isSelected ? 'text-white/40' : 'text-gray-300'}`}>
          {dateStr}
        </span>
      </div>
      <h4 className={`text-sm font-bold line-clamp-2 leading-relaxed mb-3 ${isSelected ? 'text-white' : 'text-gray-800'}`}>
        {doubt.question}
      </h4>
      <div className="flex items-center justify-between">
        <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${
          isSelected
            ? 'text-white'
            : doubt.status === 'resolved'
              ? 'text-green-500'
              : 'text-orange-500'
        }`}>
          {doubt.status}
        </span>
      </div>
    </motion.button>
  );
});

export default function Doubts() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: CATEGORIES[0],
    question: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [loadingDoubts, setLoadingDoubts] = useState(true);
  const [selectedDoubt, setSelectedDoubt] = useState<Doubt | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  const { showToast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper to get authenticated headers
  const getAuthHeaders = useCallback(async () => {
    if (!auth.currentUser) return {};
    const token = await auth.currentUser.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setFormData(prev => ({ ...prev, name: u.displayName || '' }));
      } else {
        setDoubts([]);
        setLoadingDoubts(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch all doubts for current user
  const fetchMyDoubts = useCallback(async () => {
    if (!user) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/doubts', { headers });
      const data = await res.json();
      if (data.success) {
        setDoubts(data.doubts);
      }
    } catch (error) {
      console.error('Error fetching doubts:', error);
    } finally {
      setLoadingDoubts(false);
    }
  }, [user, getAuthHeaders]);

  useEffect(() => {
    if (user) {
      fetchMyDoubts();
      // Poll every 30s
      const interval = setInterval(fetchMyDoubts, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchMyDoubts]);

  // Fetch messages for selected doubt
  const fetchMessages = useCallback(async () => {
    if (!selectedDoubt || !user) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/doubts/${selectedDoubt.id}/messages`, { headers });
      const data = await res.json();
      if (data.success) setMessages(data.messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [selectedDoubt, user, getAuthHeaders]);

  useEffect(() => {
    if (!selectedDoubt) {
      setMessages([]);
      return;
    }
    fetchMessages();
    // Poll every 10s for new messages
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [selectedDoubt, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Submit a new doubt (optimistic)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) newErrors.name = 'Full name is required';
    if (!formData.question.trim()) newErrors.question = 'Please describe your doubt';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    // Optimistic: Add doubt locally immediately
    const tempId = 'temp-' + Date.now();
    const newDoubt: Doubt = {
      id: tempId,
      name: formData.name.trim(),
      email: user.email || '',
      category: formData.category,
      question: formData.question.trim(),
      status: 'pending',
      date: new Date().toISOString()
    };

    setDoubts(prev => [newDoubt, ...prev]);
    setShowSuccess(true);
    
    // Clear form
    const savedQuestion = formData.question;
    setFormData(prev => ({ ...prev, question: '' }));
    setErrors({});
    showToast('Doubt submitted to Google Sheets!', 'success');

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/doubts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: newDoubt.name,
          email: newDoubt.email,
          category: newDoubt.category,
          question: newDoubt.question,
        }),
      });
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to submit doubt');
      }

      // Replace temp ID with real ID
      setDoubts(prev => prev.map(d => d.id === tempId ? { ...d, id: data.doubtId } : d));
      
    } catch (error: any) {
      console.error('Submit error:', error);
      // Revert optimistic update on failure
      setDoubts(prev => prev.filter(d => d.id !== tempId));
      setFormData(prev => ({ ...prev, question: savedQuestion }));
      showToast('API Error: ' + error.message, 'error');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setShowSuccess(false), 4000);
    }
  };

  // Send a follow-up message (optimistic)
  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDoubt || !newMessage.trim()) return;

    const msgText = newMessage.trim();
    setNewMessage('');

    // Optimistic Update
    const tempMsg: Message = {
      doubtId: selectedDoubt.id,
      senderName: user.displayName || 'Student',
      message: msgText,
      isAdmin: false,
      date: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempMsg]);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/doubts/${selectedDoubt.id}/reply`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          senderName: tempMsg.senderName,
          message: tempMsg.message,
          isAdmin: false,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Fetch actual data to true sync
      fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      // Revert optimistic message
      setMessages(prev => prev.filter(m => m !== tempMsg));
      setNewMessage(msgText);
      showToast('Failed to send. Please try again.', 'error');
    }
  }, [user, selectedDoubt, newMessage, showToast, fetchMessages, getAuthHeaders]);

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Hero Section */}
      <section className="relative py-40 pt-32 bg-[#050A0F] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1B4332]/20 to-transparent" />
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 bg-[#1B4332] rounded-full blur-[128px]" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#1B4332] rounded-full blur-[128px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 max-w-7xl mx-auto px-4 text-center"
        >
          <span className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-[10px] font-black tracking-[0.4em] uppercase mb-8">
            PRIVATE GUIDANCE
          </span>
          <h1 className="text-7xl md:text-[10rem] font-display text-white mb-8 tracking-tighter text-glow-white leading-none">
            DOUBTS
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-lg md:text-2xl font-medium leading-relaxed tracking-tight">
            Ask your doubts privately. Our founders will reply to you directly.
          </p>
        </motion.div>
      </section>

      {/* Content — NO overlap with hero */}
      <div className="max-w-4xl mx-auto px-4 py-16 space-y-8 relative z-20">
        <AnimatePresence mode="wait">
          {selectedDoubt ? (
            /* ── Chat View ── */
            <motion.div
              key={`chat-${selectedDoubt.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Back nav + history */}
              <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-gray-100">
                <button
                  onClick={() => setSelectedDoubt(null)}
                  className="w-full py-3 bg-gray-50 text-gray-500 rounded-2xl font-black tracking-widest text-xs hover:bg-gray-100 transition-all flex items-center justify-center gap-2 mb-4"
                >
                  <ChevronLeft size={16} />
                  BACK TO DOUBTS
                </button>
                {doubts.length > 1 && (
                  <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                    {doubts.map(d => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDoubt(d)}
                        className={`flex-shrink-0 px-5 py-3 rounded-2xl text-left transition-all border ${
                          selectedDoubt?.id === d.id
                            ? 'bg-[#1B4332] border-[#1B4332] text-white'
                            : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-[#1B4332]/30'
                        }`}
                      >
                        <p className={`text-xs font-bold line-clamp-1 max-w-[200px] ${selectedDoubt?.id === d.id ? 'text-white' : 'text-gray-800'}`}>
                          {d.question}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat Panel */}
              <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden flex flex-col h-[600px]">
                <div className="p-6 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#1B4332] flex items-center justify-center text-white">
                      <MessageSquare size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 text-lg line-clamp-1">{selectedDoubt.question}</h3>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[8px] font-black uppercase tracking-widest rounded-full border border-amber-100">
                          {selectedDoubt.category}
                        </span>
                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-full border ${
                          selectedDoubt.status === 'resolved'
                            ? 'bg-green-50 text-green-600 border-green-100'
                            : 'bg-orange-50 text-orange-600 border-orange-100'
                        }`}>
                          {selectedDoubt.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-grow p-6 overflow-y-auto flex flex-col gap-4">
                  {messages.map((msg, i) => (
                    <ChatMessage key={i} msg={msg} />
                  ))}
                  {messages.length === 0 && (
                    <div className="text-center text-gray-300 py-10">
                      <Clock size={32} className="mx-auto mb-3" />
                      <p className="text-xs font-bold uppercase tracking-widest">Waiting for founder response...</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="p-6 border-t border-gray-100 flex gap-3">
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
                    className="w-14 h-14 bg-[#1B4332] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#1B4332]/20 hover:bg-[#2D6A4F] transition-all disabled:opacity-50"
                  >
                    <Send size={20} />
                  </button>
                </form>
              </div>
            </motion.div>
          ) : (
            /* ── Default View: Form + Recent Doubts ── */
            <motion.div
              key="default-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Ask Doubt Card */}
              <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-xl border border-gray-100">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#1B4332]/5 flex items-center justify-center text-[#1B4332]">
                      <HelpCircle size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-gray-900 tracking-tight">Ask a Doubt</h2>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Get a personal response from our founders</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit}>
                  <AnimatePresence>
                    {showSuccess && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-green-50 text-green-700 p-5 rounded-2xl text-[10px] font-black tracking-[0.2em] uppercase border border-green-100 mb-6"
                      >
                        Question submitted to Server!
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
                        onClick={() => signInWithGoogle().catch((err: any) => showToast(err.message, 'error'))}
                        className="px-10 py-4 bg-[#1B4332] text-white rounded-2xl font-black tracking-widest text-xs shadow-xl shadow-[#1B4332]/10"
                      >
                        SIGN IN WITH GOOGLE
                      </motion.button>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] ml-1">Your Name</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. Rahul Singh"
                          className="w-full px-6 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-[#1B4332] outline-none transition-all font-bold text-gray-700"
                        />
                        {errors.name && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.name}</p>}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] ml-1">Category</label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="w-full px-6 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-[#1B4332] outline-none transition-all font-bold text-gray-700 appearance-none cursor-pointer"
                        >
                          {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <label className="block text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] ml-1">Your Question</label>
                        <textarea
                          value={formData.question}
                          onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                          placeholder="Describe your doubt in detail..."
                          rows={3}
                          className="w-full px-6 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-[#1B4332] outline-none transition-all font-bold text-gray-700 resize-none"
                        />
                        {errors.question && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.question}</p>}
                      </div>

                      <div className="md:col-span-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          disabled={isSubmitting}
                          type="submit"
                          className={`w-full py-5 ${isSubmitting ? 'bg-gray-400' : 'bg-[#1B4332]'} text-white rounded-2xl font-black tracking-[0.3em] uppercase text-xs flex items-center justify-center gap-3 shadow-lg shadow-[#1B4332]/20`}
                        >
                          {isSubmitting ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              SUBMITTING...
                            </>
                          ) : 'SUBMIT DOUBT'}
                        </motion.button>
                      </div>
                    </div>
                  )}
                </form>
              </div>

              {/* Recent Doubts Card */}
              <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-xl border border-gray-100">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#1B4332]/5 flex items-center justify-center text-[#1B4332]">
                      <MessageSquare size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-gray-900 tracking-tight">Recent Doubts</h2>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Your private history on our servers</p>
                    </div>
                  </div>
                  <button
                    onClick={fetchMyDoubts}
                    className="p-3 bg-gray-50 rounded-2xl text-[#1B4332] hover:bg-gray-100 transition-all border border-gray-100"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>

                {loadingDoubts ? (
                  <div className="grid md:grid-cols-2 gap-4 animate-pulse">
                    {[1, 2].map(i => (
                      <div key={i} className="h-40 bg-gray-50 border border-gray-100 rounded-2xl" />
                    ))}
                  </div>
                ) : !user ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 font-medium text-sm">Sign in to see your doubt history.</p>
                  </div>
                ) : doubts.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {doubts.map(d => (
                      <DoubtListItem
                        key={d.id}
                        doubt={d}
                        isSelected={selectedDoubt?.id === d.id}
                        onSelect={() => setSelectedDoubt(d)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto text-gray-200 mb-4">
                      <MessageSquare size={32} />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-2">No doubts yet.</h3>
                    <p className="text-gray-400 font-medium text-sm max-w-xs mx-auto">Ask your first question using the form above. We're here to help!</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
