import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, onAuthStateChanged, checkIfAdmin, collection, getDocs, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from './firebase';
import { LayoutDashboard, MessageSquare, Mail, User, Clock, CheckCircle, XCircle, Send, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

interface Contact {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: any;
}

export default function Admin() {
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'doubts' | 'contacts'>('doubts');
  const [selectedDoubt, setSelectedDoubt] = useState<Doubt | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && checkIfAdmin(user)) {
        setIsAdmin(true);
        fetchData();
      } else {
        setIsAdmin(false);
        if (!loading) navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

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
      });
      return () => unsubMessages();
    } else {
      setMessages([]);
    }
  }, [selectedDoubt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchData = () => {
    setLoading(true);
    
    // Real-time doubts
    const doubtsQuery = query(collection(db, 'doubts'), orderBy('createdAt', 'desc'));
    const unsubDoubts = onSnapshot(doubtsQuery, (snapshot) => {
      const doubtsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Doubt[];
      setDoubts(doubtsList);
      setLoading(false);
    });

    // Real-time contacts
    const contactsQuery = query(collection(db, 'contacts'), orderBy('createdAt', 'desc'));
    const unsubContacts = onSnapshot(contactsQuery, (snapshot) => {
      const contactsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Contact[];
      setContacts(contactsList);
    });

    return () => {
      unsubDoubts();
      unsubContacts();
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !selectedDoubt || !newMessage.trim()) return;

    try {
      await addDoc(collection(db, `doubts/${selectedDoubt.id}/messages`), {
        text: newMessage,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'Admin',
        isAdmin: true,
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleResolveDoubt = async (doubtId: string) => {
    try {
      await updateDoc(doc(db, 'doubts', doubtId), {
        status: 'resolved'
      });
      if (selectedDoubt?.id === doubtId) {
        setSelectedDoubt(prev => prev ? { ...prev, status: 'resolved' } : null);
      }
    } catch (error) {
      console.error("Error resolving doubt:", error);
    }
  };

  const handleDeleteDoubt = async (doubtId: string) => {
    if (!window.confirm('Are you sure you want to delete this doubt?')) return;
    try {
      await deleteDoc(doc(db, 'doubts', doubtId));
      setSelectedDoubt(null);
    } catch (error) {
      console.error("Error deleting doubt:", error);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!window.confirm('Are you sure you want to delete this contact message?')) return;
    try {
      await deleteDoc(doc(db, 'contacts', contactId));
    } catch (error) {
      console.error("Error deleting contact:", error);
    }
  };

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

          <div className="flex gap-4">
            <button
              onClick={() => {
                setActiveTab('doubts');
                setSelectedDoubt(null);
              }}
              className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
                activeTab === 'doubts' ? 'bg-white text-[#1B4332]' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <MessageSquare size={20} />
              Doubts ({doubts.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('contacts');
                setSelectedDoubt(null);
              }}
              className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
                activeTab === 'contacts' ? 'bg-white text-[#1B4332]' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <Mail size={20} />
              Contact Messages ({contacts.length})
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 -mt-10">
        {loading ? (
          <div className="bg-white rounded-3xl p-20 shadow-xl flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 font-bold animate-pulse tracking-widest uppercase text-xs">Loading Dashboard...</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {activeTab === 'doubts' ? (
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
                        onClick={() => handleDeleteDoubt(selectedDoubt.id)}
                        className="px-4 py-2 bg-red-50 text-red-700 rounded-xl text-[10px] font-black tracking-widest hover:bg-red-100 transition-colors flex items-center gap-2"
                      >
                        <XCircle size={14} />
                        DELETE
                      </button>
                      <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-100">
                        {selectedDoubt.subject}
                      </span>
                    </div>
                  </div>

                  <div className="flex-grow p-6 overflow-y-auto flex flex-col gap-4">
                    {messages.map((msg) => (
                      <div 
                        key={msg.id}
                        className={`max-w-[70%] flex flex-col ${msg.isAdmin ? 'self-end' : 'self-start'}`}
                      >
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
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={doubt.id}
                      className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all cursor-pointer"
                      onClick={() => setSelectedDoubt(doubt)}
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
                  ))
                ) : (
                  <div className="bg-white rounded-3xl p-20 shadow-xl text-center">
                    <MessageSquare size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-400 font-bold">No doubts submitted yet.</p>
                  </div>
                )
              )
            ) : (
              contacts.length > 0 ? (
                contacts.map((contact) => (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={contact.id}
                    className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all"
                  >
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-100">
                            {contact.subject}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-gray-400 font-bold">
                            <Clock size={12} />
                            {contact.createdAt?.toDate ? contact.createdAt.toDate().toLocaleString() : 'Just now'}
                          </span>
                        </div>
                        <h3 className="text-xl font-black text-gray-900 mb-4">{contact.message}</h3>
                        <div className="flex flex-wrap gap-4">
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                            <User size={14} className="text-[#1B4332]" />
                            {contact.name}
                          </div>
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                            <Mail size={14} className="text-[#1B4332]" />
                            {contact.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex md:flex-col gap-2 shrink-0">
                        <button className="flex-grow md:flex-grow-0 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-black tracking-widest hover:bg-blue-100 transition-colors flex items-center justify-center gap-2">
                          <Mail size={14} />
                          REPLY
                        </button>
                        <button 
                          onClick={() => handleDeleteContact(contact.id)}
                          className="flex-grow md:flex-grow-0 px-4 py-2 bg-red-50 text-red-700 rounded-xl text-xs font-black tracking-widest hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <XCircle size={14} />
                          DELETE
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="bg-white rounded-3xl p-20 shadow-xl text-center">
                  <Mail size={48} className="mx-auto text-gray-200 mb-4" />
                  <p className="text-gray-400 font-bold">No contact messages yet.</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
