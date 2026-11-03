import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Upload, Edit3, Trash2, Shield, Calendar, Search, AlertCircle,
  CheckCircle2, Clock, Lock, RefreshCw, Eye, ArrowLeft, History as HistoryIcon,
  Save, X, FileText, Check, RotateCcw, Download, Sparkles, ChevronDown, ChevronUp,
  MessageCircle, CheckSquare, Square, Filter, Layers
} from 'lucide-react';
import type { NIntelStory, NIntelAuditLog } from './types';
import { auth, onAuthStateChanged, checkIfAdmin, type User } from './firebase';
import {
  formatDisplayDate,
  getLocalTodayDate,
  getDailyEditionWhatsAppShareUrl,
  openWhatsAppShare
} from './n-intel-whatsapp';
import { parseDailyNewsPost } from './n-intel-parser';
import {
  saveLocalStories,
  saveLocalBatches,
  mergeStoriesWithLocal,
  syncLocalWithServer,
  getLocalStories,
  getLocalBatches,
  deleteLocalStory,
  deleteLocalStoriesByDate,
  deleteLocalStoriesByCategory,
  deleteLocalStoriesByIds
} from './n-intel-storage';

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
    shareUrl?: string;
  } | null>(null);

  // Live Client-side Parsing State
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  // Instant real-time parsing preview
  const liveParseResult = useMemo(() => {
    if (!rawText.trim()) return null;
    return parseDailyNewsPost(rawText, publishDate || getLocalTodayDate());
  }, [rawText, publishDate]);

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

  // Bulk & Group Deletion State (Date-wise, Category-wise, Multi-selected)
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState<{
    type: 'date' | 'category' | 'ids';
    title: string;
    description: string;
    date?: string;
    category?: string;
    count: number;
    ids?: string[];
  } | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [deleteModePermanent, setDeleteModePermanent] = useState(false);
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([]);
  const [showBatchDeletePicker, setShowBatchDeletePicker] = useState(false);
  const [batchPickerDate, setBatchPickerDate] = useState<string>('');
  const [batchPickerCategory, setBatchPickerCategory] = useState<string>('All');

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
    if (editingStory || deletingStory || showEmptyTrashModal || bulkDeleteTarget || showBatchDeletePicker) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [editingStory, deletingStory, showEmptyTrashModal, bulkDeleteTarget, showBatchDeletePicker]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const token = await currentUser.getIdTokenResult(true);
          setIsAdmin(token.claims.admin === true);
        } catch {
          setIsAdmin(checkIfAdmin(currentUser));
        }
      } else {
        setIsAdmin(false);
      }
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

      let url = '/api/n-intel/stories?includeDeleted=true';
      if (filterDate) url += `&date=${encodeURIComponent(filterDate)}`;
      if (filterCategory && filterCategory !== 'All') url += `&category=${encodeURIComponent(filterCategory)}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      url += `&_t=${Date.now()}`;

      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data.success) {
        const serverStories = data.stories || [];
        setStories(serverStories);
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

      const handleFocus = () => {
        if (document.visibilityState === 'visible') {
          if (activeTab === 'manage') fetchStories();
          if (activeTab === 'audit') fetchAuditLogs();
        }
      };
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleFocus);
      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleFocus);
      };
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

  // Dynamic categories list from loaded stories
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const s of stories) {
      if (s && s.category) set.add(s.category);
    }
    return Array.from(set).sort();
  }, [stories]);

  // Dynamic available dates and their story counts
  const availableDates = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of stories) {
      if (s && s.date && (statusFilter === 'deleted' ? s.isDeleted : !s.isDeleted)) {
        map[s.date] = (map[s.date] || 0) + 1;
      }
    }
    return Object.entries(map)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [stories, statusFilter]);

  // Filtered stories currently displayed
  const visibleStories = useMemo(() => {
    return stories.filter(s => {
      // 1. Status Filter
      if (statusFilter === 'deleted' ? !s.isDeleted : s.isDeleted) return false;
      // 2. Date Filter
      if (filterDate && s.date !== filterDate) return false;
      // 3. Category Filter
      if (filterCategory && filterCategory !== 'All' && s.category.toLowerCase() !== filterCategory.toLowerCase()) return false;
      // 4. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchH = s.headline?.toLowerCase().includes(q);
        const matchC = s.content?.toLowerCase().includes(q);
        const matchCat = s.category?.toLowerCase().includes(q);
        if (!matchH && !matchC && !matchCat) return false;
      }
      return true;
    });
  }, [stories, statusFilter, filterDate, filterCategory, searchQuery]);

  // Counts for current scopes
  const currentDateCount = useMemo(() => {
    if (!filterDate) return 0;
    return stories.filter(s => s.date === filterDate && (statusFilter === 'deleted' ? s.isDeleted : !s.isDeleted)).length;
  }, [stories, filterDate, statusFilter]);

  const currentCategoryCount = useMemo(() => {
    if (!filterCategory || filterCategory === 'All') return 0;
    const cat = filterCategory.toLowerCase();
    return stories.filter(s => s.category.toLowerCase() === cat && (!filterDate || s.date === filterDate) && (statusFilter === 'deleted' ? s.isDeleted : !s.isDeleted)).length;
  }, [stories, filterCategory, filterDate, statusFilter]);

  const handleToggleSelectAll = () => {
    if (selectedStoryIds.length === visibleStories.length && visibleStories.length > 0) {
      setSelectedStoryIds([]);
    } else {
      setSelectedStoryIds(visibleStories.map(s => s.id));
    }
  };

  const handleToggleStorySelect = (id: string) => {
    setSelectedStoryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

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
        if (Array.isArray(data.stories) && data.stories.length > 0) {
          saveLocalStories(data.stories);
          if (data.batch) {
            saveLocalBatches([data.batch]);
          }
          setStories(prev => {
            const map = new Map<string, NIntelStory>();
            for (const s of data.stories) map.set(s.id, s);
            for (const s of prev) if (!map.has(s.id)) map.set(s.id, s);
            return Array.from(map.values());
          });
        }
        setPublishFeedback({
          type: 'success',
          message: data.message || `Successfully published ${data.count} stories!`,
          details: data.categories?.map((c: string) => `${c}`),
          shareUrl: getDailyEditionWhatsAppShareUrl(targetDate, data.count)
        });
        setRawText('');
        setShowLivePreview(false);
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

  const handleExportBackup = () => {
    try {
      const allStories = getLocalStories();
      const allBatches = getLocalBatches();
      const backupData = {
        exportedAt: new Date().toISOString(),
        stories: allStories,
        batches: allBatches
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nishchay-nintel-backup-${getLocalTodayDate()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMessage('✅ Backup downloaded successfully!');
      setTimeout(() => setBackupMessage(null), 3000);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed.stories)) {
          saveLocalStories(parsed.stories);
          if (Array.isArray(parsed.batches)) {
            saveLocalBatches(parsed.batches);
          }
          setStories(prev => {
            const map = new Map<string, NIntelStory>();
            for (const s of parsed.stories) map.set(s.id, s);
            for (const s of prev) if (!map.has(s.id)) map.set(s.id, s);
            return Array.from(map.values());
          });
          const token = await getAuthToken();
          if (token) {
            await syncLocalWithServer(token);
          }
          setBackupMessage(`✅ Restored ${parsed.stories.length} stories from backup!`);
          setTimeout(() => setBackupMessage(null), 4000);
        } else {
          alert('Invalid backup file: missing stories array.');
        }
      } catch (err: any) {
        alert(`Restore failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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

  // Confirm Delete Individual Story
  const handleConfirmDelete = async () => {
    if (!deletingStory) return;

    setIsDeleting(true);
    setActionNotice(null);
    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const isPermanent = deleteModePermanent || deletingStory.isDeleted;
      const url = `/api/n-intel/stories/${encodeURIComponent(deletingStory.id)}${isPermanent ? '?permanent=true' : ''}`;

      const res = await fetch(url, {
        method: 'DELETE',
        headers
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete story');
      }

      deleteLocalStory(deletingStory.id, isPermanent);

      if (isPermanent) {
        setStories(prev => prev.filter(s => s.id !== deletingStory.id));
        setActionNotice({ type: 'success', message: 'Story permanently erased from database.' });
      } else {
        setStories(prev => prev.map(s => s.id === deletingStory.id ? { ...s, isDeleted: true } : s));
        setActionNotice({ type: 'success', message: 'Story removed from public feed (moved to Trash).' });
      }
      setSelectedStoryIds(prev => prev.filter(id => id !== deletingStory.id));
      setDeletingStory(null);
      setDeleteModePermanent(false);
    } catch (err: any) {
      setActionNotice({ type: 'error', message: `Delete failed: ${err.message}` });
    } finally {
      setIsDeleting(false);
    }
  };

  // Confirm Bulk Delete (Date-wise, Category-wise, or Multi-selected IDs)
  const handleConfirmBulkDelete = async () => {
    if (!bulkDeleteTarget) return;

    setIsBulkDeleting(true);
    setActionNotice(null);
    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/n-intel/stories/bulk-delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: bulkDeleteTarget.type,
          date: bulkDeleteTarget.date,
          category: bulkDeleteTarget.category,
          ids: bulkDeleteTarget.ids,
          permanent: deleteModePermanent
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete deletion');
      }

      // Update local storage
      if (bulkDeleteTarget.type === 'date' && bulkDeleteTarget.date) {
        deleteLocalStoriesByDate(bulkDeleteTarget.date, deleteModePermanent);
      } else if (bulkDeleteTarget.type === 'category' && bulkDeleteTarget.category) {
        deleteLocalStoriesByCategory(bulkDeleteTarget.category, bulkDeleteTarget.date, deleteModePermanent);
      } else if (bulkDeleteTarget.type === 'ids' && bulkDeleteTarget.ids) {
        deleteLocalStoriesByIds(bulkDeleteTarget.ids, deleteModePermanent);
      }

      // Update in-memory state
      if (deleteModePermanent) {
        if (bulkDeleteTarget.type === 'date' && bulkDeleteTarget.date) {
          setStories(prev => prev.filter(s => s.date !== bulkDeleteTarget.date));
        } else if (bulkDeleteTarget.type === 'category' && bulkDeleteTarget.category) {
          const cat = bulkDeleteTarget.category.toLowerCase();
          setStories(prev => prev.filter(s => {
            if (s.category.toLowerCase() !== cat) return true;
            if (bulkDeleteTarget.date && s.date !== bulkDeleteTarget.date) return true;
            return false;
          }));
        } else if (bulkDeleteTarget.type === 'ids' && bulkDeleteTarget.ids) {
          const idSet = new Set(bulkDeleteTarget.ids);
          setStories(prev => prev.filter(s => !idSet.has(s.id)));
        }
      } else {
        if (bulkDeleteTarget.type === 'date' && bulkDeleteTarget.date) {
          setStories(prev => prev.map(s => s.date === bulkDeleteTarget.date ? { ...s, isDeleted: true } : s));
        } else if (bulkDeleteTarget.type === 'category' && bulkDeleteTarget.category) {
          const cat = bulkDeleteTarget.category.toLowerCase();
          setStories(prev => prev.map(s => {
            const match = s.category.toLowerCase() === cat && (!bulkDeleteTarget.date || s.date === bulkDeleteTarget.date);
            return match ? { ...s, isDeleted: true } : s;
          }));
        } else if (bulkDeleteTarget.type === 'ids' && bulkDeleteTarget.ids) {
          const idSet = new Set(bulkDeleteTarget.ids);
          setStories(prev => prev.map(s => idSet.has(s.id) ? { ...s, isDeleted: true } : s));
        }
      }

      setSelectedStoryIds([]);
      setBulkDeleteTarget(null);
      setDeleteModePermanent(false);
      setActionNotice({
        type: 'success',
        message: data.message || `Successfully deleted ${data.count} stories.`
      });
    } catch (err: any) {
      setActionNotice({ type: 'error', message: `Bulk delete failed: ${err.message}` });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Triggers for bulk deletion modals
  const triggerDateDelete = (date: string, count?: number) => {
    setDeleteModePermanent(false);
    const resolvedCount = typeof count === 'number'
      ? count
      : stories.filter(s => s && s.date === date && (statusFilter === 'deleted' ? !!s.isDeleted : !s.isDeleted)).length;
    setBulkDeleteTarget({
      type: 'date',
      title: `Delete Day's Briefing (${formatDisplayDate(date)})`,
      description: `This will remove all ${resolvedCount} stories published for ${date}.`,
      date,
      count: resolvedCount
    });
  };

  const triggerCategoryDelete = (category: string, date?: string, count?: number) => {
    setDeleteModePermanent(false);
    const resolvedCount = typeof count === 'number'
      ? count
      : stories.filter(s => {
          if (statusFilter === 'deleted' ? !s.isDeleted : s.isDeleted) return false;
          if (s.category?.toLowerCase() !== category.toLowerCase()) return false;
          if (date && s.date !== date) return false;
          return true;
        }).length;
    const dateQualifier = date ? ` for date ${date}` : '';
    setBulkDeleteTarget({
      type: 'category',
      title: `Delete Category: "${category}"`,
      description: `This will remove all ${resolvedCount} stories in category "${category}"${dateQualifier}.`,
      category,
      date: date || undefined,
      count: resolvedCount
    });
  };

  const triggerSelectedDelete = (ids: string[]) => {
    setDeleteModePermanent(false);
    setBulkDeleteTarget({
      type: 'ids',
      title: `Delete ${ids.length} Selected Stories`,
      description: `This will remove the ${ids.length} news items you selected.`,
      ids,
      count: ids.length
    });
  };

  // Restore Story
  const handleRestoreStory = async (story: NIntelStory) => {
    setActionNotice(null);
    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

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
            <HistoryIcon size={16} />
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

                {/* Live Parser Dynamic Feedback */}
                {liveParseResult && liveParseResult.success && (
                  <div className="mb-6 p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-emerald-700" />
                        <span className="text-xs font-black text-emerald-900 tracking-wide uppercase">
                          Live Parser: Ready to Publish ({liveParseResult.totalStories} Updates)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowLivePreview(!showLivePreview)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold hover:bg-emerald-100/60 transition-colors"
                      >
                        <span>{showLivePreview ? 'Hide Preview' : 'Preview Extracted Stories'}</span>
                        {showLivePreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {liveParseResult.categories.map((c, i) => (
                        <span key={i} className="px-2.5 py-0.5 bg-white text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-bold">
                          {c}
                        </span>
                      ))}
                    </div>

                    {showLivePreview && (
                      <div className="mt-3 pt-3 border-t border-emerald-200 max-h-72 overflow-y-auto space-y-2 pr-1">
                        {liveParseResult.stories.map((st, sIdx) => (
                          <div key={sIdx} className="p-2.5 bg-white rounded-xl border border-emerald-100 text-xs">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-black uppercase">
                                {st.category}
                              </span>
                              <span className="font-bold text-gray-800 line-clamp-1">{st.headline}</span>
                            </div>
                            <p className="text-gray-500 line-clamp-2">{st.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {liveParseResult && !liveParseResult.success && rawText.trim().length > 30 && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                    <AlertCircle size={18} className="text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 font-medium">
                      <p className="font-bold mb-1">Notice from Parser:</p>
                      <p>{liveParseResult.error || 'Check formatting of the broadcast text.'}</p>
                    </div>
                  </div>
                )}

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
                      {publishFeedback.type === 'success' && publishFeedback.shareUrl && (
                        <div className="mt-3 pt-3 border-t border-emerald-200/80 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openWhatsAppShare(publishFeedback.shareUrl!)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl text-xs font-black tracking-wide uppercase transition-all shadow-md shadow-[#25D366]/20 cursor-pointer"
                          >
                            <MessageCircle size={15} />
                            <span>Share This Edition on WhatsApp</span>
                          </button>
                          <span className="text-[11px] text-emerald-800 font-bold">
                            Auto-fetches current date & direct briefing link
                          </span>
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
                  <li>• <strong>Multi-Layer Persistence:</strong> Locally cached and synced across serverless containers.</li>
                </ul>
              </div>

              {/* Data Safety & Backup Panel */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-black text-gray-900 tracking-tight uppercase mb-3 flex items-center gap-2">
                  <Shield size={16} className="text-[#1B4332]" />
                  <span>Data Safety & Backup</span>
                </h3>
                <p className="text-xs text-gray-500 font-medium mb-4">
                  Export all published N-INTEL editions or restore them onto any device with one click.
                </p>

                {backupMessage && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold mb-3">
                    {backupMessage}
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="w-full py-2.5 px-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download size={15} />
                    <span>Download JSON Backup</span>
                  </button>

                  <label className="w-full py-2.5 px-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer text-center">
                    <Upload size={15} />
                    <span>Restore from JSON Backup</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      className="hidden"
                    />
                  </label>
                </div>
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

            {/* Filter Bar (Date, Category, Search & Bulk Delete Tools) */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div className="flex flex-wrap items-center gap-3">
                {/* Date Filter */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <Calendar size={15} className="text-gray-500" />
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none"
                    title="Filter by date"
                  />
                  {filterDate && (
                    <button
                      onClick={() => setFilterDate('')}
                      className="text-xs text-gray-400 hover:text-gray-600 font-bold px-1"
                      title="Clear date filter"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <Filter size={14} className="text-gray-500" />
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Categories</option>
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {filterCategory !== 'All' && (
                    <button
                      onClick={() => setFilterCategory('All')}
                      className="text-xs text-gray-400 hover:text-gray-600 font-bold px-1"
                      title="Reset category filter"
                    >
                      ×
                    </button>
                  )}
                </div>

                <button
                  onClick={fetchStories}
                  className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors"
                  title="Refresh Stories"
                >
                  <RefreshCw size={15} className={loadingStories ? 'animate-spin' : ''} />
                </button>

                {/* Quick Bulk Delete Tools Launcher */}
                <button
                  type="button"
                  onClick={() => setShowBatchDeletePicker(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="Delete whole briefing or specific category in 1-click"
                >
                  <Layers size={14} />
                  <span>Bulk Delete Tools</span>
                </button>
              </div>

              <span className="text-xs text-gray-400 font-medium">
                Showing {visibleStories.length} of {stories.filter(s => statusFilter === 'deleted' ? s.isDeleted : !s.isDeleted).length} stories
              </span>
            </div>

            {/* ── HIGH-LEVEL BULK ACTION BANNERS ── */}
            {/* 1. Date-Wise Deletion Banner */}
            {filterDate && currentDateCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-rose-50/90 border border-rose-200 rounded-2xl mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-rose-950">
                      Day's Briefing: <span className="font-black">{formatDisplayDate(filterDate)}</span> ({filterDate})
                    </p>
                    <p className="text-[11px] text-rose-700 font-medium">
                      Contains <span className="font-bold">{currentDateCount}</span> stories {statusFilter === 'deleted' ? 'in Trash' : 'in active feed'}.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerDateDelete(filterDate, currentDateCount)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Delete Entire Day's Briefing ({currentDateCount} Stories)</span>
                </button>
              </div>
            )}

            {/* 2. Category-Wise Deletion Banner */}
            {filterCategory !== 'All' && currentCategoryCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <Filter size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-950">
                      Category Scope: <span className="font-black">{filterCategory}</span>{filterDate ? ` on ${filterDate}` : ' (All Dates)'}
                    </p>
                    <p className="text-[11px] text-amber-800 font-medium">
                      Contains <span className="font-bold">{currentCategoryCount}</span> stories matching this category.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerCategoryDelete(filterCategory, filterDate || undefined, currentCategoryCount)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Delete All in "{filterCategory}" ({currentCategoryCount} Stories)</span>
                </button>
              </div>
            )}

            {/* 3. Multi-Select Floating Banner */}
            {selectedStoryIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl mb-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <CheckSquare size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-indigo-950">
                      <span className="font-black">{selectedStoryIds.length}</span> news stories selected
                    </p>
                    <p className="text-[11px] text-indigo-700 font-medium">
                      Apply deletion to the chosen news updates.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => triggerSelectedDelete(selectedStoryIds)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Delete Selected ({selectedStoryIds.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStoryIds([])}
                    className="px-3 py-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            {/* Table / List Header with Select All Checkbox */}
            {visibleStories.length > 0 && (
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50/90 rounded-xl mb-3 text-xs font-bold text-gray-500 border border-gray-100">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-2 text-gray-700 hover:text-gray-900 cursor-pointer select-none"
                >
                  {selectedStoryIds.length > 0 && selectedStoryIds.length === visibleStories.length ? (
                    <CheckSquare size={16} className="text-[#1B4332]" />
                  ) : (
                    <Square size={16} className="text-gray-400" />
                  )}
                  <span>
                    {selectedStoryIds.length === visibleStories.length && visibleStories.length > 0
                      ? `Deselect All (${visibleStories.length})`
                      : `Select All Visible (${visibleStories.length})`}
                  </span>
                </button>
                <span className="text-[11px] text-gray-400">
                  Select checkbox for batch deletion or click Delete on any story below
                </span>
              </div>
            )}

            {/* Stories Table / List */}
            {loadingStories ? (
              <div className="py-16 text-center text-gray-400 text-xs font-bold animate-pulse">
                Loading stories...
              </div>
            ) : visibleStories.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-xs font-medium">
                {statusFilter === 'deleted'
                  ? 'Trash is currently empty. No deleted stories matching filters.'
                  : 'No active stories found matching your filter.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {visibleStories.map((story) => {
                  const isSelected = selectedStoryIds.includes(story.id);

                  return (
                    <div
                      key={story.id}
                      className={`py-4 px-2 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                        isSelected
                          ? 'bg-indigo-50/40 border border-indigo-100'
                          : story.isDeleted
                          ? 'opacity-60 bg-red-50/20'
                          : 'hover:bg-gray-50/50'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 pr-4">
                        {/* Multi-Select Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleStorySelect(story.id)}
                          className="mt-1 text-gray-400 hover:text-[#1B4332] transition-colors cursor-pointer shrink-0"
                          title={isSelected ? 'Deselect story' : 'Select story for batch action'}
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-[#1B4332]" />
                          ) : (
                            <Square size={18} className="text-gray-300 hover:text-gray-500" />
                          )}
                        </button>

                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
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
                      </div>

                      {/* Individual Actions */}
                      <div className="flex items-center gap-2 shrink-0 sm:self-center self-end pl-8 sm:pl-0">
                        <button
                          onClick={() => openEditModal(story)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Edit3 size={14} />
                          <span>Edit</span>
                        </button>

                        {story.isDeleted ? (
                          <>
                            <button
                              onClick={() => handleRestoreStory(story)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              title="Restore to public feed"
                            >
                              <RotateCcw size={14} />
                              <span>Restore</span>
                            </button>
                            <button
                              onClick={() => {
                                setDeleteModePermanent(true);
                                setDeletingStory(story);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              title="Permanently erase from database"
                            >
                              <Trash2 size={14} />
                              <span>Purge</span>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setDeleteModePermanent(false);
                              setDeletingStory(story);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            title="Remove from public feed (moves to Trash)"
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
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

      {/* ── DELETE CONFIRMATION MODAL (Single Story) ── */}
      {mounted && deletingStory && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setDeletingStory(null);
            setDeleteModePermanent(false);
          }}
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-200 text-center relative my-auto max-h-[90vh] overflow-y-auto"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              deleteModePermanent ? 'bg-red-200 text-red-700' : 'bg-red-100 text-red-600'
            }`}>
              <Trash2 size={28} />
            </div>

            <h3 className="text-lg font-black text-gray-900 mb-2">
              {deleteModePermanent ? 'Permanently Purge Story?' : 'Remove Story from Feed?'}
            </h3>
            <p className="text-xs text-gray-500 mb-4 font-medium leading-relaxed">
              {deleteModePermanent
                ? 'This will completely erase this story from the database and storage. This action CANNOT be undone.'
                : 'This will remove the story from the live website and archive. You can restore it anytime from Trash.'}
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

            {/* Deletion Mode Selector */}
            <div className="flex items-center justify-center gap-2 p-1.5 bg-gray-100 rounded-xl mb-5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDeleteModePermanent(false)}
                className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  !deleteModePermanent ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Soft Delete (Trash)
              </button>
              <button
                type="button"
                onClick={() => setDeleteModePermanent(true)}
                className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  deleteModePermanent ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Permanent Purge
              </button>
            </div>

            {actionNotice?.type === 'error' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-bold mb-4">
                {actionNotice.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeletingStory(null);
                  setDeleteModePermanent(false);
                }}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className={`inline-flex items-center gap-2 px-6 py-2.5 text-white text-xs font-black tracking-widest uppercase rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer ${
                  deleteModePermanent
                    ? 'bg-red-700 hover:bg-red-800 shadow-red-700/25'
                    : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                }`}
              >
                {isDeleting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : deleteModePermanent ? (
                  <>
                    <Trash2 size={14} />
                    <span>Purge Forever</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Move to Trash</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── BULK / GROUP DELETE CONFIRMATION MODAL ── */}
      {mounted && bulkDeleteTarget && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setBulkDeleteTarget(null);
            setDeleteModePermanent(false);
          }}
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-200 text-center relative my-auto max-h-[90vh] overflow-y-auto"
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              deleteModePermanent ? 'bg-red-200 text-red-700 ring-4 ring-red-100' : 'bg-red-100 text-red-600'
            }`}>
              <Layers size={32} />
            </div>

            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-[10px] font-black uppercase tracking-wider inline-block mb-3">
              Bulk Deletion Operation
            </span>

            <h3 className="text-xl font-black text-gray-900 mb-2">
              {bulkDeleteTarget.title}
            </h3>

            <p className="text-xs text-gray-600 mb-4 font-medium leading-relaxed max-w-md mx-auto">
              {bulkDeleteTarget.description}
            </p>

            <div className="p-4 bg-gray-50 rounded-2xl text-left border border-gray-100 mb-5">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700 mb-1">
                <span>Operation Scope:</span>
                <span className="font-mono text-red-600 uppercase font-black">{bulkDeleteTarget.type}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-gray-700 mb-1">
                <span>Total Stories Affected:</span>
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md font-mono font-black">
                  {bulkDeleteTarget.count} {bulkDeleteTarget.count === 1 ? 'story' : 'stories'}
                </span>
              </div>
              {bulkDeleteTarget.date && (
                <div className="flex items-center justify-between text-xs font-bold text-gray-700 mb-1">
                  <span>Target Date:</span>
                  <span className="font-mono text-gray-900">{bulkDeleteTarget.date}</span>
                </div>
              )}
              {bulkDeleteTarget.category && (
                <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                  <span>Target Category:</span>
                  <span className="font-mono text-gray-900">{bulkDeleteTarget.category}</span>
                </div>
              )}
            </div>

            {/* Mode switch */}
            <div className="p-1 bg-gray-100 rounded-xl mb-5 flex items-center text-xs font-bold">
              <button
                type="button"
                onClick={() => setDeleteModePermanent(false)}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                  !deleteModePermanent ? 'bg-white text-gray-900 shadow-sm font-black' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Move {bulkDeleteTarget.count} to Trash
              </button>
              <button
                type="button"
                onClick={() => setDeleteModePermanent(true)}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                  deleteModePermanent ? 'bg-red-600 text-white shadow-sm font-black' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Permanently Purge All
              </button>
            </div>

            {actionNotice?.type === 'error' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-bold mb-4">
                {actionNotice.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setBulkDeleteTarget(null);
                  setDeleteModePermanent(false);
                }}
                disabled={isBulkDeleting}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                disabled={isBulkDeleting || bulkDeleteTarget.count === 0}
                className={`inline-flex items-center gap-2 px-6 py-2.5 text-white text-xs font-black tracking-widest uppercase rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer ${
                  deleteModePermanent
                    ? 'bg-red-700 hover:bg-red-800 shadow-red-700/25'
                    : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                }`}
              >
                {isBulkDeleting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Deleting {bulkDeleteTarget.count} Stories...</span>
                  </>
                ) : deleteModePermanent ? (
                  <>
                    <Trash2 size={14} />
                    <span>Purge {bulkDeleteTarget.count} Stories Forever</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Move {bulkDeleteTarget.count} Stories to Trash</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── BATCH DELETE TOOLS PICKER MODAL (Quick Modal for Date & Category) ── */}
      {mounted && showBatchDeletePicker && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowBatchDeletePicker(false)}
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-gray-200 relative my-auto max-h-[90vh] overflow-y-auto text-left"
          >
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Bulk Deletion Management</h3>
                  <p className="text-xs text-gray-500 font-medium">Quick tools to delete full briefings or specific categories</p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchDeletePicker(false)}
                className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Option 1: Date-wise whole briefing */}
              <div className="p-5 rounded-2xl border border-red-100 bg-red-50/40">
                <div className="flex items-center gap-2 mb-2 text-red-900 font-black text-sm">
                  <Calendar size={16} />
                  <span>Option A: Delete an Entire Day's Briefing</span>
                </div>
                <p className="text-xs text-gray-600 mb-4">
                  Select any publishing date to remove all stories published on that day in one single operation.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={batchPickerDate}
                    onChange={(e) => setBatchPickerDate(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-red-500"
                  >
                    <option value="">-- Choose a Date to Delete --</option>
                    {availableDates.map(({ date, count }) => (
                      <option key={date} value={date}>
                        {date} ({count} {count === 1 ? 'story' : 'stories'})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={!batchPickerDate}
                    onClick={() => {
                      if (!batchPickerDate) return;
                      setShowBatchDeletePicker(false);
                      triggerDateDelete(batchPickerDate);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer shrink-0"
                  >
                    Delete Day's Edition
                  </button>
                </div>
              </div>

              {/* Option 2: Category-wise */}
              <div className="p-5 rounded-2xl border border-amber-100 bg-amber-50/40">
                <div className="flex items-center gap-2 mb-2 text-amber-900 font-black text-sm">
                  <Filter size={16} />
                  <span>Option B: Delete Stories by Category</span>
                </div>
                <p className="text-xs text-gray-600 mb-4">
                  Select a category to delete all stories under it (optionally scoped to a specific date).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1">
                      Category
                    </label>
                    <select
                      value={batchPickerCategory}
                      onChange={(e) => setBatchPickerCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-amber-500"
                    >
                      <option value="All">-- Select Category --</option>
                      {availableCategories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1">
                      Date Scope (Optional)
                    </label>
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="text-right">
                  <button
                    type="button"
                    disabled={!batchPickerCategory || batchPickerCategory === 'All'}
                    onClick={() => {
                      if (!batchPickerCategory || batchPickerCategory === 'All') return;
                      setShowBatchDeletePicker(false);
                      triggerCategoryDelete(batchPickerCategory, filterDate || undefined);
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Delete Category Stories
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 text-right">
              <button
                type="button"
                onClick={() => setShowBatchDeletePicker(false)}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close
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
