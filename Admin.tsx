import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  auth, onAuthStateChanged, checkIfAdmin, type User as FirebaseUser
} from './firebase';
import { LayoutDashboard, MessageSquare, Mail, User, Clock, Send, ChevronLeft, RefreshCw, Trash2, X, Paperclip, Image as ImageIcon, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast';
import { supabase, isPlaceholder } from './supabase-frontend';

interface Message {
  doubtId: string;
  senderName: string;
  message: string;
  isAdmin: boolean;
  date: string;
  fileUrl?: string;
  fileType?: string;
  replyToId?: string;
  replyToText?: string;
}

interface Doubt {
  id: string;
  uid: string;
  name: string;
  email: string;
  category: string;
  question: string;
  status: string;
  date: string;
}

// ── Memoized sub-components ──

const AdminChatMessage = memo(function AdminChatMessage({ msg, onReply }: { msg: Message; onReply: (msg: Message) => void }) {
  const dateStr = msg.date ? new Date(msg.date).toLocaleString() : '';
  const isImage = msg.fileType?.startsWith('image/');

  return (
    <motion.div 
      drag="x"
      dragConstraints={{ left: -100, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(_, info) => {
        if (info.offset.x < -80) {
          onReply(msg);
        }
      }}
      className={`max-w-[75%] flex flex-col group relative ${msg.isAdmin ? 'self-end' : 'self-start'}`}
    >
      <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${msg.isAdmin ? 'text-right text-[#1B4332]' : 'text-gray-400'}`}>
        {msg.isAdmin ? msg.senderName.toUpperCase() : msg.senderName}
      </span>

      {/* Reply indicator */}
      <div className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <RefreshCw size={14} className="text-gray-300 animate-spin-slow" />
      </div>

      <div className={`rounded-2xl text-sm font-medium shadow-sm overflow-hidden ${
        msg.isAdmin
          ? 'bg-[#1B4332] text-white rounded-tr-none'
          : 'bg-gray-100 text-gray-800 rounded-tl-none'
      }`}>
        
        {/* Render Quoted Message */}
        {msg.replyToId && (
          <div className={`p-3 text-[11px] border-l-4 mb-2 ${msg.isAdmin ? 'bg-white/10 border-white/30 text-white/70' : 'bg-white border-[#1B4332]/30 text-gray-500'}`}>
            <p className="font-bold mb-1 opacity-70">Replying to...</p>
            <p className="line-clamp-2">{msg.replyToText}</p>
          </div>
        )}

        {/* Render Image */}
        {msg.fileUrl && isImage && (
          <div className="mb-2">
            <img src={msg.fileUrl} alt="attachment" className="w-full max-h-60 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(msg.fileUrl, '_blank')} />
          </div>
        )}

        <div className="px-5 py-3">
          {msg.message && <p>{msg.message}</p>}

          {msg.fileUrl && !isImage && (
            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 p-3 rounded-xl mt-2 transition-colors ${msg.isAdmin ? 'bg-white/10 hover:bg-white/20' : 'bg-white hover:bg-gray-50'}`}>
              <div className="p-2 bg-[#1B4332]/10 rounded-lg text-[#1B4332]">
                <FileText size={16} />
              </div>
              <div className="flex-grow min-w-0">
                <p className="text-xs font-bold truncate">Document Attachment</p>
                <p className="text-[10px] opacity-60 uppercase font-black">Open File</p>
              </div>
            </a>
          )}
        </div>
      </div>
      {dateStr && (
        <span className={`text-[8px] text-gray-300 mt-1 ${msg.isAdmin ? 'text-right' : ''}`}>
          {dateStr}
        </span>
      )}
    </motion.div>
  );
});

const AdminDoubtCard = memo(function AdminDoubtCard({ doubt, onSelect }: {
  doubt: Doubt;
  onSelect: (doubt: Doubt) => void;
}) {
  const dateStr = doubt.date ? new Date(doubt.date).toLocaleString() : 'Just now';
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
              {doubt.category}
            </span>
            <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border ${
              doubt.status === 'resolved'
                ? 'bg-green-50 text-green-600 border-green-100'
                : 'bg-orange-50 text-orange-600 border-orange-100'
            }`}>
              {doubt.status}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400 font-bold">
              <Clock size={12} />
              {dateStr}
            </span>
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-4">{doubt.question}</h3>
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [selectedDoubt, setSelectedDoubt] = useState<Doubt | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [adminUser, setAdminUser] = useState<FirebaseUser | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const getAuthHeaders = useCallback(async () => {
    if (!auth.currentUser) return {};
    const token = await auth.currentUser.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  // Auth check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && checkIfAdmin(user)) {
        setIsAdmin(true);
        setAdminUser(user);
      } else {
        setIsAdmin(false);
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Fetch all doubts
  const fetchDoubts = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/doubts', { headers });
      const data = await res.json();
      if (data.success) {
        setDoubts(data.doubts);
      }
    } catch (error) {
      console.error('Failed to load doubts:', error);
      showToast('Failed to load doubts', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, getAuthHeaders, showToast]);

  useEffect(() => {
    if (!isAdmin) return;
    
    fetchDoubts();

    // REAL-TIME: Listen for any new doubts or status changes
    try {
      if (isPlaceholder) {
        console.warn('⚠️ Supabase Realtime skipped: No URL configured');
        return;
      }

      const channel = supabase
        .channel('admin_doubts_changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'doubts' 
        }, () => {
          fetchDoubts();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.error('❌ Supabase Realtime Error (Admin Doubts):', err);
    }
  }, [isAdmin, fetchDoubts]);

  // Filter doubts
  const filteredDoubts = statusFilter === 'all'
    ? doubts
    : doubts.filter(d => d.status === statusFilter);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!selectedDoubt) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/doubts/${selectedDoubt.id}/messages`, { headers });
      const data = await res.json();
      if (data.success) setMessages(data.messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [selectedDoubt, getAuthHeaders]);

  useEffect(() => {
    if (!selectedDoubt) {
      setMessages([]);
      return;
    }

    fetchMessages();

    // REAL-TIME: Listen for new messages in THIS specific doubt
    try {
      if (isPlaceholder) return;

      const channel = supabase
        .channel(`admin_doubt_messages_${selectedDoubt.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `doubt_id=eq.${selectedDoubt.id}`
        }, (payload) => {
          const newMessage = payload.new as any;
          setMessages(prev => {
            if (prev.some(m => m.date === newMessage.created_at && m.message === newMessage.message)) return prev;
            return [...prev, {
              doubtId: newMessage.doubt_id,
              senderName: newMessage.sender_name,
              message: newMessage.message,
              isAdmin: newMessage.is_admin,
              date: newMessage.created_at,
              fileUrl: newMessage.file_url,
              fileType: newMessage.file_type,
              replyToId: newMessage.reply_to_id,
              replyToText: newMessage.reply_to_text,
            }];
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.error('❌ Supabase Realtime Error (Admin Messages):', err);
    }
  }, [selectedDoubt, fetchMessages]);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.parentElement?.scrollTo({
        top: messagesEndRef.current.parentElement.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages.length]);

  const handleFileUpload = async (file: File) => {
    if (!adminUser || !selectedDoubt) return;
    
    setUploading(true);

    try {
      // Read file as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // strip data:...;base64, prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload via server proxy (bypasses Supabase Storage RLS)
      const headers = await getAuthHeaders();
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fileName: file.name,
          fileData: base64,
          fileType: file.type,
          doubtId: selectedDoubt.id,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Send message automatically with the file
      await handleSendMessage(null as any, { 
        fileUrl: data.publicUrl, 
        fileType: file.type,
        message: `Sent an attachment: ${file.name}` 
      });

      showToast('File uploaded successfully', 'success');
    } catch (error: any) {
      console.error('Upload error:', error);
      showToast('Upload failed: ' + error.message, 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Send reply (optimistic)
  const handleSendMessage = useCallback(async (e: React.FormEvent | null, fileData?: { fileUrl: string, fileType: string, message: string }) => {
    if (e) e.preventDefault();
    if (!adminUser || !selectedDoubt) return;
    if (!newMessage.trim() && !fileData) return;

    const msgText = fileData ? fileData.message : newMessage.trim();
    if (!fileData) setNewMessage('');
    
    const currentReplyTo = replyingTo;
    setReplyingTo(null);

    const tempMsg: Message = {
      doubtId: selectedDoubt.id,
      senderName: adminUser.displayName || 'Admin',
      message: msgText,
      isAdmin: true,
      date: new Date().toISOString(),
      fileUrl: fileData?.fileUrl,
      fileType: fileData?.fileType,
      replyToId: currentReplyTo?.date,
      replyToText: currentReplyTo?.message
    };
    
    // Optimistic UI updates
    setMessages(prev => [...prev, tempMsg]);
    setDoubts(prev => prev.map(d => d.id === selectedDoubt.id ? { ...d, status: 'resolved' } : d));
    
    // Update local selected doubt state
    setSelectedDoubt(prev => prev ? { ...prev, status: 'resolved' } : null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/doubts/${selectedDoubt.id}/reply`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          senderName: tempMsg.senderName,
          message: tempMsg.message,
          isAdmin: true,
          fileUrl: tempMsg.fileUrl,
          fileType: tempMsg.fileType,
          replyToId: currentReplyTo?.date,
          replyToText: currentReplyTo?.message
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast('Reply sent and resolved!', 'success');
      // No need to fetchMessages/fetchDoubts — Supabase Realtime handles the update
    } catch (error) {
      console.error('Error sending reply:', error);
      // Revert optimistic
      setMessages(prev => prev.filter(m => m !== tempMsg));
      setNewMessage(msgText);
      showToast('Failed to send reply.', 'error');
    }
  }, [adminUser, selectedDoubt, newMessage, showToast, getAuthHeaders, fetchMessages, fetchDoubts]);

  const handleSelectDoubt = useCallback((doubt: Doubt) => {
    setSelectedDoubt(doubt);
  }, []);

  // Reopen a doubt (optimistic)
  const handleReopen = useCallback(async () => {
    if (!selectedDoubt) return;
    
    const prevStatus = selectedDoubt.status;
    
    // Optimistic Update
    setDoubts(prev => prev.map(d => d.id === selectedDoubt.id ? { ...d, status: 'pending' } : d));
    setSelectedDoubt(prev => prev ? { ...prev, status: 'pending' } : null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/doubts/${selectedDoubt.id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'pending' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
      showToast('Doubt reopened.', 'info');
    } catch (error) {
      // Revert
      setDoubts(prev => prev.map(d => d.id === selectedDoubt.id ? { ...d, status: prevStatus } : d));
      setSelectedDoubt(prev => prev ? { ...prev, status: prevStatus } : null);
      showToast('Failed to update status.', 'error');
    }
  }, [selectedDoubt, showToast, getAuthHeaders]);

  const handleDeleteDoubt = useCallback(async (doubtId: string, mode: 'me' | 'everyone') => {
    const doubtToRemove = doubts.find(d => d.id === doubtId);
    
    // Optimistic Delete
    setDoubts(prev => prev.filter(d => d.id !== doubtId));
    if (selectedDoubt?.id === doubtId) setSelectedDoubt(null);
    setShowDeleteConfirm(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/doubts/${doubtId}?mode=${mode}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
      showToast('Doubt deleted.', 'success');
    } catch (error) {
      console.error('Error deleting doubt:', error);
      // Revert
      if (doubtToRemove) {
        setDoubts(prev => [doubtToRemove, ...prev]);
      }
      showToast('Failed to delete doubt.', 'error');
    }
  }, [doubts, selectedDoubt, showToast, getAuthHeaders]);

  if (!isAdmin && !loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6"><p>Redirecting...</p></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Admin Header */}
      <div className="bg-[#1B4332] text-white pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                <LayoutDashboard size={32} />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight">Admin Dashboard</h1>
                <p className="text-white/70 font-medium">Manage student inquiries and doubts</p>
              </div>
            </div>
            <button
              onClick={fetchDoubts}
              className="p-3 bg-white/10 rounded-2xl backdrop-blur-md hover:bg-white/20 transition-all text-white border border-white/20"
              title="Refresh"
            >
              <RefreshCw size={24} />
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex gap-4">
              <button className="px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 bg-white text-[#1B4332]">
                <MessageSquare size={20} />
                Doubts ({filteredDoubts.length})
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
            {selectedDoubt ? (
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
                    {selectedDoubt.status === 'resolved' ? (
                      <button
                        onClick={handleReopen}
                        className="px-4 py-2 bg-orange-50 text-orange-700 rounded-xl text-[10px] font-black tracking-widest hover:bg-orange-100 transition-colors flex items-center gap-2"
                      >
                        REOPEN
                      </button>
                    ) : (
                      <span className="px-4 py-2 bg-orange-50 text-orange-700 rounded-xl text-[10px] font-black tracking-widest">
                        PENDING
                      </span>
                    )}
                    <button
                      onClick={() => setShowDeleteConfirm(selectedDoubt.id)}
                      className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                      title="Delete Doubt"
                    >
                      <Trash2 size={20} />
                    </button>
                    <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-100">
                      {selectedDoubt.category}
                    </span>
                  </div>
                </div>

                {/* Conversation History */}
                <div className="flex-grow p-6 overflow-y-auto flex flex-col gap-4">
                  {messages.map((msg, i) => (
                    <AdminChatMessage key={i} msg={msg} onReply={setReplyingTo} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Preview */}
                {replyingTo && (
                  <div className="mx-6 mb-2 p-3 bg-gray-50 border-l-4 border-[#1B4332] rounded-lg flex justify-between items-center animate-in slide-in-from-bottom-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-[#1B4332] uppercase tracking-widest mb-1">Replying to {replyingTo.senderName}</p>
                      <p className="text-xs text-gray-500 line-clamp-1">{replyingTo.message}</p>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="p-6 border-t border-gray-100 flex flex-col gap-3">
                  <div className="flex gap-3 items-center">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-12 h-12 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center hover:bg-gray-100 transition-all"
                    >
                      {uploading ? <RefreshCw size={20} className="animate-spin" /> : <Paperclip size={20} />}
                    </button>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your reply to send an email to the student..."
                      className="flex-grow px-6 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-[#1B4332] outline-none transition-all font-bold text-gray-700"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() && !uploading}
                      className="w-14 h-14 bg-[#1B4332] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#1B4332]/20 hover:bg-[#2D6A4F] transition-all disabled:opacity-50"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              filteredDoubts.length > 0 ? (
                filteredDoubts.map((doubt) => (
                  <AdminDoubtCard
                    key={doubt.id}
                    doubt={doubt}
                    onSelect={handleSelectDoubt}
                  />
                ))
              ) : (
                <div className="bg-white rounded-3xl p-20 shadow-xl text-center">
                  <MessageSquare size={48} className="mx-auto text-gray-200 mb-4" />
                  <p className="text-gray-400 font-bold">No {statusFilter !== 'all' ? statusFilter : ''} doubts found.</p>
                </div>
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
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Delete Chat?</h3>
              <p className="text-gray-500 font-medium mb-8">Choose how you want to delete this conversation.</p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleDeleteDoubt(showDeleteConfirm, 'me')}
                  className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-black tracking-widest text-xs hover:bg-gray-200 transition-all uppercase"
                >
                  Delete for me
                </button>
                <button
                  onClick={() => handleDeleteDoubt(showDeleteConfirm, 'everyone')}
                  className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-black tracking-widest text-xs hover:bg-red-100 transition-all uppercase"
                >
                  Delete for everyone
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="w-full py-4 text-gray-400 font-black tracking-widest text-xs hover:text-gray-600 transition-all uppercase mt-2"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
