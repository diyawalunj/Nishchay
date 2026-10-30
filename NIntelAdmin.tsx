import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Upload, Edit3, Trash2, Shield, Calendar, Search, AlertCircle,
  CheckCircle2, Clock, Lock, RefreshCw, Eye, ArrowLeft, History,
  Save, X, FileText, Check, RotateCcw
} from 'lucide-react';
import type { NIntelStory, NIntelAuditLog } from './types';
import { auth, onAuthStateChanged, checkIfAdmin, type User } from './firebase';
import { formatDisplayDate, getLocalTodayDate } from './n-intel-whatsapp';

export default function NIntelAdmin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editStoryIdParam = searchParams.get('edit');
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [activeTab, setActiveTab] = useState<'publish' | 'manage' | 'audit'>(
    searchParams.get('edit') ? 'manage' : 'publish'
  );

  // Publishing State — Defaults automatically to current local date
  const [rawText, setRawText] = useState('');
  const [publishDate, setPublishDate] = useState(getLocalTodayDate());
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
    details?: string[];
  } | null>(null);

  // Management State
  const [stories, setStories] = useState<NIntelStory[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Editing Modal State
  const [editingStory, setEditingStory] = useState<NIntelStory | null>(null);
  const [editForm, setEditForm] = useState({
    headline: '',
    content: '',
    category: '',
    date: '',
    sourceName: '',
    sourceUrl: '',
    tags: '',
    isDefence: false
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);

  // Deletion Confirmation Modal State
  const [deletingStory, setDeletingStory] = useState<NIntelStory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Management Filter: 'active' | 'deleted' (All tab removed per user request)
  const [statusFilter, setStatusFilter] = useState<'active' | 'deleted'>('active');

  // Empty Trash Modal State
  const [showEmptyTrashModal, setShowEmptyTrashModal] = useState(false);
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<NIntelAuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Check auth
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent background scrolling while any modal is open
  useEffect(() => {
    if (editingStory || deletingStory || showEmptyTrashModal) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [editingStory, deletingStory, showEmptyTrashModal]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      const isAdm = checkIfAdmin(currentUser);
      setIsAdmin(isAdm);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const getAuthToken = useCallback(async () => {
    try {
      if (auth.currentUser) {
        return await auth.currentUser.getIdToken();
      }
      const resolvedUser = await new Promise<User | null>((resolve) => {
        const unsub = onAuthStateChanged(auth, (u) => {
          unsub();
          resolve(u);
        });
        setTimeout(() => resolve(auth.currentUser), 1200);
      });
      if (resolvedUser) {
        return await resolvedUser.getIdToken();
      }
    } catch (e) {
      console.warn('Could not retrieve token:', e);
    }
    return null;
  }, []);

  // Fetch stories for management
  const fetchStories = useCallback(async () => {
    setLoadingStories(true);
    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const email = user?.email || auth.currentUser?.email || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'diyawalunj@gmail.com' : undefined);
      if (email) headers['x-user-email'] = email;

      let url = '/api/n-intel/stories?includeDeleted=true';
      if (filterDate) url += `&date=${encodeURIComponent(filterDate)}`;
      if (filterCategory && filterCategory !== 'All') url += `&category=${encodeURIComponent(filterCategory)}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data.success) {
        const sorted = (data.stories || []).sort((a: NIntelStory, b: NIntelStory) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          const timeA = a.createdAt || '';
          const timeB = b.createdAt || '';
          if (timeA && timeB && timeA !== timeB) return timeB.localeCompare(timeA);
          return (b.itemNumber || 0) - (a.itemNumber || 0);
        });
        setStories(sorted);
      }
    } catch (err) {
      console.error('Error fetching stories for management:', err);
    } finally {
      setLoadingStories(false);
    }
  }, [getAuthToken, filterDate, filterCategory, searchQuery, user]);

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch('/api/n-intel/audit', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    if (isAdmin) {
      if (activeTab === 'manage') fetchStories();
      if (activeTab === 'audit') fetchAuditLogs();
    }
  }, [isAdmin, activeTab, fetchStories, fetchAuditLogs]);

  // Deep-link to edit a specific story via query param (e.g. ?edit=story-id)
  useEffect(() => {
    if (editStoryIdParam && stories.length > 0) {
      const target = stories.find(s => s.id === editStoryIdParam);
      if (target) {
        setActiveTab('manage');
        openEditModal(target);
      }
    }
  }, [editStoryIdParam, stories]);

  // Handle One-Step Direct Publish
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) {
      setPublishFeedback({ type: 'error', message: 'Please paste the daily news post before publishing.' });
      return;
    }

    setIsPublishing(true);
    setPublishFeedback(null);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('You must be signed in as an administrator.');

      const targetDate = publishDate && /^\d{4}-\d{2}-\d{2}$/.test(publishDate)
        ? publishDate
        : getLocalTodayDate();

      const res = await fetch('/api/n-intel/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rawText,
          date: targetDate
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setPublishFeedback({
          type: res.status === 409 ? 'warning' : 'error',
          message: data.error || 'Failed to publish news post.'
        });
      } else {
        setPublishFeedback({
          type: 'success',
          message: data.message || `Successfully published ${data.count} stories!`,
          details: data.categories?.map((c: string) => `${c}`)
        });
        setRawText('');
      }
    } catch (err: any) {
      console.error('Publish error:', err);
      setPublishFeedback({
        type: 'error',
        message: err.message || 'An error occurred while publishing.'
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (story: NIntelStory) => {
    setEditModalError(null);
    setEditingStory(story);
    setEditForm({
      headline: story.headline || '',
      content: story.content || '',
      category: story.category || '',
      date: story.date || '',
      sourceName: story.sourceName || '',
      sourceUrl: story.sourceUrl || '',
      tags: story.tags ? story.tags.join(', ') : '',
      isDefence: !!story.isDefence
    });
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStory) return;

    setIsSavingEdit(true);
    setEditModalError(null);
    try {
      const headline = (editForm.headline || '').trim();
      const content = (editForm.content || '').trim();
      const category = (editForm.category || '').trim();
      const date = (editForm.date || '').trim();
      const sourceName = (editForm.sourceName || '').trim();
      const sourceUrl = (editForm.sourceUrl || '').trim();
      const tagsArray = (editForm.tags || '')
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      if (!headline) {
        setEditModalError('Headline cannot be empty.');
        setIsSavingEdit(false);
        return;
      }
      if (!content) {
        setEditModalError('Story content cannot be empty.');
        setIsSavingEdit(false);
        return;
      }
      if (!category) {
        setEditModalError('Category cannot be empty.');
        setIsSavingEdit(false);
        return;
      }
      if (!date) {
        setEditModalError('Date cannot be empty.');
        setIsSavingEdit(false);
        return;
      }

      const token = await getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const email = user?.email || auth.currentUser?.email || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'diyawalunj@gmail.com' : undefined);
      if (email) headers['x-user-email'] = email;

      const res = await fetch(`/api/n-intel/stories/${encodeURIComponent(editingStory.id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          headline,
          content,
          category,
          date,
          sourceName,
          sourceUrl,
          tags: tagsArray,
          isDefence: !!editForm.isDefence
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update story');
      }

      // Update in local stories list
      setStories(prev => prev.map(s => s.id === editingStory.id ? data.story : s));
      setEditingStory(null);
      setActionNotice({ type: 'success', message: `Story "${data.story?.headline?.slice(0, 45)}..." updated successfully!` });
      // Re-fetch stories to guarantee server synchronization
      fetchStories();
    } catch (err: any) {
      console.error('Save edit error:', err);
      setEditModalError(err.message || 'Error saving story update');
      setActionNotice({ type: 'error', message: `Error saving edit: ${err.message}` });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingStory) return;

    setIsDeleting(true);
    setActionNotice(null);
    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const email = user?.email || auth.currentUser?.email || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'diyawalunj@gmail.com' : undefined);
      if (email) headers['x-user-email'] = email;

      const url = `/api/n-intel/stories/${encodeURIComponent(deletingStory.id)}`;

      const res = await fetch(url, {
        method: 'DELETE',
        headers
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete story');
      }

      setStories(prev => prev.map(s => s.id === deletingStory.id ? { ...s, isDeleted: true } : s));
      setActionNotice({ type: 'success', message: 'Story successfully removed from public feed.' });
      setDeletingStory(null);
    } catch (err: any) {
      setActionNotice({ type: 'error', message: `Delete failed: ${err.message}` });
    } finally {
      setIsDeleting(false);
    }
  };

  // Restore Story
  const handleRestoreStory = async (story: NIntelStory) => {
    setActionNotice(null);
    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const email = user?.email || auth.currentUser?.email || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'diyawalunj@gmail.com' : undefined);
      if (email) headers['x-user-email'] = email;

      const res = await fetch(`/api/n-intel/stories/${encodeURIComponent(story.id)}/restore`, {
        method: 'POST',
        headers
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to restore story');
      }

      setStories(prev => prev.map(s => s.id === story.id ? { ...s, isDeleted: false } : s));
      setActionNotice({ type: 'success', message: 'Story successfully restored to public feed.' });
    } catch (err: any) {
      setActionNotice({ type: 'error', message: `Restore failed: ${err.message}` });
    }
  };

  // Empty Trash (Delete All in Trash)
  const handleEmptyTrash = async () => {
    setIsEmptyingTrash(true);
    setActionNotice(null);
    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const email = user?.email || auth.currentUser?.email || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'diyawalunj@gmail.com' : undefined);
      if (email) headers['x-user-email'] = email;

      const res = await fetch('/api/n-intel/trash/empty', {
        method: 'DELETE',
        headers
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to empty trash');
      }

      setStories(prev => prev.filter(s => !s.isDeleted));
      setShowEmptyTrashModal(false);
      setActionNotice({
        type: 'success',
        message: data.message || `Trash emptied successfully. ${data.purgedCount || 0} stories permanently erased.`
      });
    } catch (err: any) {
      setActionNotice({ type: 'error', message: `Empty trash failed: ${err.message}` });
    } finally {
      setIsEmptyingTrash(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-20">
        <div className="animate-spin text-[#1B4332] w-8 h-8 border-4 border-current border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 pb-24 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 text-center border border-gray-100 shadow-xl">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Administrator Access Required</h2>
          <p className="text-gray-500 text-xs sm:text-sm mb-6 leading-relaxed">
            {user
              ? `Your account (${user.email}) does not have administrative permissions for N-INTEL publishing.`
              : 'Please sign in with an authorized Team Nishchay administrator account to access this page.'}
          </p>
          <Link
            to="/n-intel"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1B4332] text-white text-xs font-black tracking-widest rounded-xl hover:bg-[#2D6A4F] transition-all uppercase"
          >
            <ArrowLeft size={16} />
            Back to Public N-INTEL
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pt-28 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-2">
              <Link to="/n-intel" className="hover:text-[#1B4332] transition-colors">N-INTEL</Link>
              <span>/</span>
              <span className="text-gray-900">Admin Control</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <span>N-INTEL Publishing & Management</span>
              <span className="px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-widest rounded-full">
                Admin
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/n-intel"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors"
            >
              <Eye size={16} />
              <span>View Live Feed</span>
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab('publish')}
            className={`px-5 py-3 text-xs font-black tracking-widest uppercase border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'publish'
                ? 'border-[#1B4332] text-[#1B4332]'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            <Upload size={16} />
            <span>One-Step Publish</span>
          </button>

          <button
            onClick={() => setActiveTab('manage')}
            className={`px-5 py-3 text-xs font-black tracking-widest uppercase border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'manage'
                ? 'border-[#1B4332] text-[#1B4332]'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            <Edit3 size={16} />
            <span>Manage Stories</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-5 py-3 text-xs font-black tracking-widest uppercase border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'border-[#1B4332] text-[#1B4332]'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            <History size={16} />
            <span>Audit History</span>
          </button>
        </div>

        {/* ── TAB 1: ONE-STEP PUBLISH ── */}
        {activeTab === 'publish' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <form onSubmit={handlePublish} className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-100">
                  <div>
                    <h2 className="text-lg font-black text-gray-900 tracking-tight">Direct News Bulletin Publisher</h2>
                    <p className="text-xs text-gray-500 font-medium">
                      Paste the daily WhatsApp community broadcast text below. All stories publish immediately.
                    </p>
                  </div>

                  <div className="flex flex-col sm:items-end gap-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <label className="text-xs font-bold text-gray-700 whitespace-nowrap">Publication Date:</label>
                      </div>
                      <input
                        type="date"
                        value={publishDate}
                        onChange={(e) => setPublishDate(e.target.value)}
                        className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:border-[#1B4332] outline-none transition-all"
                      />
                      {publishDate !== getLocalTodayDate() && (
                        <button
                          type="button"
                          onClick={() => setPublishDate(getLocalTodayDate())}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                          title="Reset to current local date"
                        >
                          Set Today
                        </button>
                      )}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                      <Check size={11} className="text-emerald-600" />
                      <span>Auto-adjusted to current date ({getLocalTodayDate()})</span>
                    </div>
                  </div>
                </div>

                {/* Paste Area */}
                <div className="mb-6">
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
                    Paste Raw Broadcast Text:
                  </label>
                  <textarea
                    rows={16}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={`*TODAYS TOP NEWS*\n------------------------------------\n1. President Smt Droupadi Murmu...\n\n*DEFENCE News*\n------------------------------------\n1. Defence Minister Rajnath Singh...`}
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs sm:text-sm font-mono text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#1B4332] focus:bg-white transition-all leading-relaxed"
                  />
                </div>

                {/* Feedback Alert */}
                {publishFeedback && (
                  <div className={`p-4 rounded-2xl mb-6 text-xs font-medium border flex items-start gap-3 ${
                    publishFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : publishFeedback.type === 'warning'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-red-50 text-red-800 border-red-200'
                  }`}>
                    {publishFeedback.type === 'success' ? (
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">{publishFeedback.message}</p>
                      {publishFeedback.details && publishFeedback.details.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {publishFeedback.details.map((c, i) => (
                            <span key={i} className="px-2 py-0.5 bg-white/60 rounded text-[10px] font-bold">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Submit Action */}
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-gray-400 font-medium">
                    ⚡ Auto-parsed into individual news stories & instantly live.
                  </div>

                  <button
                    type="submit"
                    disabled={isPublishing || !rawText.trim()}
                    className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#1B4332] hover:bg-[#2D6A4F] disabled:opacity-50 text-white text-xs font-black tracking-widest uppercase rounded-xl transition-all shadow-lg shadow-[#1B4332]/20 active:scale-95"
                  >
                    {isPublishing ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Publishing...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        <span>Publish All Stories Now</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Sidebar Guide */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Shield size={16} className="text-[#1B4332]" />
                  <span>Dynamic Aspirant Categories</span>
                </h3>

                <p className="text-xs text-gray-500 font-medium mb-3">
                  The system automatically extracts all categories important for defence aspirants and excludes non-relevant noise (e.g. mishaps, accidents, gossip, astrology):
                </p>

                <ul className="space-y-1.5 text-xs text-stone-700 font-bold mb-4">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1B4332]" />
                    <span>Defence News</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1B4332]" />
                    <span>International Relations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1B4332]" />
                    <span>Important Appointments</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1B4332]" />
                    <span>National Affairs</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1B4332]" />
                    <span>Polity & Judiciary</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1B4332]" />
                    <span>World News</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1B4332]" />
                    <span>Sports</span>
                  </li>
                </ul>

                <p className="text-[11px] text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 font-medium mb-4">
                  ✨ <strong>Dynamic Categories:</strong> Any new exam topics (e.g. Science & Tech, Environment, Reports & Indices, Awards) encountered in the post are automatically recognized and displayed.
                </p>

                <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-2">Publishing Rules:</h4>
                <ul className="space-y-2 text-xs text-gray-600 font-medium">
                  <li>• <strong>Zero Approval Delay:</strong> Published immediately upon paste.</li>
                  <li>• <strong>Duplicate Safe:</strong> Content hashes prevent accidental double-posting.</li>
                  <li>• <strong>Clean Briefing:</strong> Non-exam accidents and mishaps are excluded automatically.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: MANAGE STORIES (EDIT & DELETE) ── */}
        {activeTab === 'manage' && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-md p-6 sm:p-8">
            {/* Action Notice Alert */}
            {actionNotice && (
              <div className={`p-4 rounded-2xl mb-6 text-xs font-bold border flex items-center justify-between ${
                actionNotice.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {actionNotice.type === 'success' ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-red-600 shrink-0" />
                  )}
                  <span>{actionNotice.message}</span>
                </div>
                <button onClick={() => setActionNotice(null)} className="text-gray-400 hover:text-gray-700">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Status Tabs: Active vs Trash (All tab removed) */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-100">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 p-1 bg-gray-50 border border-gray-200 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('active')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      statusFilter === 'active'
                        ? 'bg-[#1B4332] text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Active Feed ({stories.filter(s => !s.isDeleted).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('deleted')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      statusFilter === 'deleted'
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-red-700'
                    }`}
                  >
                    <Trash2 size={13} />
                    <span>Trash / Deleted ({stories.filter(s => !!s.isDeleted).length})</span>
                  </button>
                </div>

                {/* Delete All Option in Trash / Deleted Section */}
                {statusFilter === 'deleted' && stories.filter(s => !!s.isDeleted).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowEmptyTrashModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                    title="Permanently erase all stories in Trash"
                  >
                    <Trash2 size={14} />
                    <span>Empty Trash (Delete All)</span>
                  </button>
                )}
              </div>

              {/* Search */}
              <div className="relative w-full md:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stories..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#1B4332]"
                />
              </div>
            </div>

            {/* Filter Bar (Date & Refresh) */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <Calendar size={16} className="text-gray-500" />
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none"
                  />
                  {filterDate && (
                    <button onClick={() => setFilterDate('')} className="text-xs text-gray-400 hover:text-gray-600 font-bold">×</button>
                  )}
                </div>

                <button
                  onClick={fetchStories}
                  className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors"
                  title="Refresh Stories"
                >
                  <RefreshCw size={16} className={loadingStories ? 'animate-spin' : ''} />
                </button>
              </div>

              <span className="text-xs text-gray-400 font-medium">
                Showing {stories.filter(s => statusFilter === 'deleted' ? s.isDeleted : !s.isDeleted).length} stories
              </span>
            </div>

            {/* Stories Table / List */}
            {loadingStories ? (
              <div className="py-16 text-center text-gray-400 text-xs font-bold animate-pulse">
                Loading stories...
              </div>
            ) : stories.filter(s => statusFilter === 'deleted' ? s.isDeleted : !s.isDeleted).length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-xs font-medium">
                {statusFilter === 'deleted'
                  ? 'Trash is currently empty. No deleted stories.'
                  : 'No active stories found.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {stories.filter(s => statusFilter === 'deleted' ? s.isDeleted : !s.isDeleted).map((story) => (
                  <div
                    key={story.id}
                    className={`py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      story.isDeleted ? 'opacity-60 bg-red-50/20' : 'hover:bg-gray-50/50'
                    }`}
                  >
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-bold uppercase rounded">
                          {story.category}
                        </span>
                        <span className="text-[11px] text-gray-400 font-mono">
                          {story.date}
                        </span>
                        {story.isDefence && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded">
                            Defence
                          </span>
                        )}
                        {story.isDeleted && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[9px] font-black uppercase rounded">
                            Removed from feed
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-black text-gray-900 leading-snug">
                        {story.headline}
                      </h4>

                      <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                        {story.content}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEditModal(story)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors"
                      >
                        <Edit3 size={14} />
                        <span>Edit</span>
                      </button>

                      {story.isDeleted ? (
                        <button
                          onClick={() => handleRestoreStory(story)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors"
                          title="Restore to public feed"
                        >
                          <RotateCcw size={14} />
                          <span>Restore</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeletingStory(story)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition-colors"
                          title="Remove from public feed (moves to Trash)"
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: AUDIT HISTORY ── */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-md p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight">Audit Trail</h2>
                <p className="text-xs text-gray-500 font-medium">
                  Complete chronological history of publishing, editing, and deletion operations.
                </p>
              </div>

              <button
                onClick={fetchAuditLogs}
                className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors"
                title="Refresh Audit Trail"
              >
                <RefreshCw size={16} className={loadingAudit ? 'animate-spin' : ''} />
              </button>
            </div>

            {loadingAudit ? (
              <div className="py-16 text-center text-gray-400 text-xs font-bold animate-pulse">
                Loading audit trail...
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-xs font-medium">
                No audit entries recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          log.action === 'PUBLISH'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.action === 'EDIT'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                        }`}>
                          {log.action}
                        </span>
                        <span className="font-bold text-gray-700">{log.adminEmail}</span>
                      </div>
                      <p className="text-gray-600 font-medium">{log.details}</p>
                    </div>

                    <div className="text-[11px] text-gray-400 font-mono shrink-0">
                      {new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── EDIT STORY MODAL (Rendered via Portal directly to body to bypass stacking contexts) ── */}
      {mounted && editingStory && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setEditingStory(null)}
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-gray-200 relative my-auto max-h-[90vh] overflow-y-auto text-left"
          >
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Edit News Story</h3>
              <button
                type="button"
                onClick={() => setEditingStory(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-gray-700 mb-1">Headline:</label>
                <input
                  type="text"
                  value={editForm.headline}
                  onChange={(e) => setEditForm(prev => ({ ...prev, headline: e.target.value }))}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-900 focus:outline-none focus:border-[#1B4332]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-gray-700 mb-1">Category:</label>
                  <input
                    type="text"
                    list="category-suggestions"
                    value={editForm.category}
                    onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="Select or enter category..."
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#1B4332]"
                    required
                  />
                  <datalist id="category-suggestions">
                    <option value="Defence News" />
                    <option value="International Relations" />
                    <option value="Important Appointments" />
                    <option value="National Affairs" />
                    <option value="Polity & Judiciary" />
                    <option value="World News" />
                    <option value="Sports" />
                    <option value="Science & Technology" />
                    <option value="Economy & Banking" />
                    <option value="Environment & Ecology" />
                    <option value="Awards & Honours" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-gray-700 mb-1">Date:</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#1B4332]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-700 mb-1">Story Content:</label>
                <textarea
                  rows={6}
                  value={editForm.content}
                  onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 font-medium focus:outline-none focus:border-[#1B4332]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-gray-700 mb-1">Source Name:</label>
                  <input
                    type="text"
                    value={editForm.sourceName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, sourceName: e.target.value }))}
                    placeholder="e.g. PIB, IMD, Supreme Court"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-gray-700 mb-1">Source URL:</label>
                  <input
                    type="text"
                    value={editForm.sourceUrl}
                    onChange={(e) => setEditForm(prev => ({ ...prev, sourceUrl: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:border-[#1B4332]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-700 mb-1">Tags (comma-separated):</label>
                <input
                  type="text"
                  value={editForm.tags}
                  onChange={(e) => setEditForm(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="Defence, Exercise, Navy"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:border-[#1B4332]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isDefence"
                  checked={editForm.isDefence}
                  onChange={(e) => setEditForm(prev => ({ ...prev, isDefence: e.target.checked }))}
                  className="rounded text-[#1B4332] focus:ring-[#1B4332]"
                />
                <label htmlFor="isDefence" className="text-xs font-bold text-gray-700">
                  Mark as Defence Highlight (prominent military badge)
                </label>
              </div>

              {editModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-bold flex items-center gap-2 mt-4">
                  <AlertCircle size={16} className="text-red-600 shrink-0" />
                  <span>{editModalError}</span>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingStory(null)}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-black tracking-widest uppercase rounded-xl transition-all shadow-md active:scale-95"
                >
                  {isSavingEdit ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── DELETE CONFIRMATION MODAL (Rendered via Portal directly to body) ── */}
      {mounted && deletingStory && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDeletingStory(null)}
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-200 text-center relative my-auto max-h-[90vh] overflow-y-auto"
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-100 text-red-600">
              <Trash2 size={28} />
            </div>

            <h3 className="text-lg font-black text-gray-900 mb-2">
              Remove Story from Feed?
            </h3>
            <p className="text-xs text-gray-500 mb-4 font-medium leading-relaxed">
              This will remove the story from the public website and search results. You can restore it later from Trash.
            </p>

            <div className="p-3 bg-gray-50 rounded-xl text-left border border-gray-100 mb-5">
              <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Target Story:</span>
              <p className="text-xs font-bold text-gray-800 line-clamp-2">
                {deletingStory.headline}
              </p>
              <span className="text-[10px] text-gray-500 font-semibold mt-1 block">
                Category: {deletingStory.category} • Date: {deletingStory.date}
              </span>
            </div>

            {actionNotice?.type === 'error' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-bold mb-4">
                {actionNotice.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingStory(null)}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black tracking-widest uppercase rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-95"
              >
                {isDeleting ? 'Removing...' : 'Remove Story'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── EMPTY TRASH (DELETE ALL) CONFIRMATION MODAL ── */}
      {mounted && showEmptyTrashModal && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowEmptyTrashModal(false)}
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-200 text-center relative my-auto max-h-[90vh] overflow-y-auto"
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-200 text-red-800">
              <Trash2 size={28} />
            </div>

            <h3 className="text-lg font-black text-gray-900 mb-2">
              Permanently Delete All Trash?
            </h3>
            <p className="text-xs text-gray-500 mb-5 font-medium leading-relaxed">
              This will permanently purge all <span className="font-bold text-red-700">{stories.filter(s => !!s.isDeleted).length}</span> deleted stories from the database. This action <span className="font-bold">cannot be undone</span>.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowEmptyTrashModal(false)}
                disabled={isEmptyingTrash}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEmptyTrash}
                disabled={isEmptyingTrash}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black tracking-widest uppercase rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-95"
              >
                {isEmptyingTrash ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Purging All...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Delete All Forever</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
