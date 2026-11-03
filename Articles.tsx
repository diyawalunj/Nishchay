import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Calendar, Clock, User, Download, ArrowRight,
  Sparkles, Plus, Edit3, Trash2, X, Upload, Shield,
  FileText, Check, AlertCircle, ExternalLink, Bookmark
} from 'lucide-react';
import type { Article } from './articles-db';
import { safeImageUrl } from './safe-image-url';
import { auth, onAuthStateChanged, checkIfAdmin, type User as FirebaseUser } from './firebase';
import { getLocalTodayDate } from './n-intel-whatsapp';
import {
  getLocalArticles,
  saveLocalArticle,
  saveAllLocalArticles,
  deleteLocalArticle,
  mergeArticlesWithLocal,
  syncLocalArticlesWithServer,
  compressImageToDataUrl
} from './articles-storage';

const CATEGORIES = [
  'All',
  'International Relations',
  'Defence & Strategic Affairs',
  'Internal Security',
  'Polity & Governance',
  'Geopolitics & Bilateral Relations',
  'Economy & Trade',
  'Science & Technology'
];

export default function Articles() {
  const [articles, setArticles] = useState<Article[]>(() => getLocalArticles());
  const [loading, setLoading] = useState(() => getLocalArticles().length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Admin Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Admin Modal States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [deletingArticle, setDeletingArticle] = useState<Article | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [category, setCategory] = useState('International Relations');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [authorRole, setAuthorRole] = useState('');
  const [publishDate, setPublishDate] = useState(() => getLocalTodayDate());
  const [pullQuote, setPullQuote] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [sourceReference, setSourceReference] = useState('');

  // Banner file upload state
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent background scrolling while any modal is open
  useEffect(() => {
    if (isUploadModalOpen || deletingArticle) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isUploadModalOpen, deletingArticle]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const token = await currentUser.getIdTokenResult();
          setIsAdmin(token?.claims?.admin === true || checkIfAdmin(currentUser));
        } catch {
          setIsAdmin(checkIfAdmin(currentUser));
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchArticles = useCallback((showSpinner = false) => {
    if (showSpinner) setLoading(true);
    fetch(`/api/articles?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.articles)) {
          setArticles(data.articles);
          saveAllLocalArticles(data.articles);
        } else {
          const fallback = getLocalArticles();
          if (fallback.length > 0) setArticles(fallback);
        }
      })
      .catch(err => {
        console.warn('Network issue fetching articles, using resilient local cache:', err);
        const fallback = getLocalArticles();
        if (fallback.length > 0) setArticles(fallback);
      })
      .finally(() => setLoading(false));
  }, []);

  // Initial fetch and automatic cross-device sync (revalidate on focus & 25s polling)
  useEffect(() => {
    fetchArticles(articles.length === 0);

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchArticles(false);
      }
    };

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchArticles(false);
      }
    }, 25000);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchArticles]);

  const resetForm = () => {
    setTitle('');
    setBannerImageUrl('');
    setCategory('International Relations');
    setCustomCategory('');
    setIsCustomCategory(false);
    setAuthorName('');
    setAuthorRole('');
    setPublishDate(getLocalTodayDate());
    setPullQuote('');
    setContent('');
    setTags('');
    setSourceReference('');
    setFormError(null);
    setFormSuccess(null);
    setEditingArticle(null);
  };

  const openCreateModal = () => {
    resetForm();
    setPublishDate(getLocalTodayDate());
    setIsUploadModalOpen(true);
  };

  const openEditModal = (art: Article) => {
    setEditingArticle(art);
    setTitle(art.title);
    setBannerImageUrl(art.bannerImageUrl);

    const standardCategories = CATEGORIES.filter(c => c !== 'All');
    if (art.category && !standardCategories.includes(art.category)) {
      setCategory('Custom');
      setCustomCategory(art.category);
      setIsCustomCategory(true);
    } else {
      setCategory(art.category || 'International Relations');
      setCustomCategory('');
      setIsCustomCategory(false);
    }

    setAuthorName(art.authorName);
    setAuthorRole(art.authorRole || '');
    setPublishDate(art.publishDate || getLocalTodayDate());
    setPullQuote(art.pullQuote || '');
    setContent(art.content);
    setTags(Array.isArray(art.tags) ? art.tags.join(', ') : '');
    setSourceReference(art.sourceReference || '');
    setFormError(null);
    setFormSuccess(null);
    setIsUploadModalOpen(true);
  };

  const handleBannerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setFormError('Image size exceeds 15MB. Please choose a smaller image.');
      return;
    }

    setIsUploadingBanner(true);
    setFormError(null);

    try {
      // Store a compact self-contained image so it survives serverless restarts without paid object storage.
      const compressedDataUrl = await compressImageToDataUrl(file, 1280, 800, 0.82);
      setBannerImageUrl(compressedDataUrl);

    } catch (err: any) {
      setFormError(`Image processing failed: ${err.message}`);
    } finally {
      setIsUploadingBanner(false);
      // Reset input value so re-selecting the same file fires change event
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmitArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    // Compulsory field validation
    if (!title.trim()) {
      setFormError('Article headline / title is compulsory.');
      return;
    }
    if (!bannerImageUrl.trim()) {
      setFormError('Banner image is COMPULSORY. Please enter an image URL or upload an image file.');
      return;
    }
    const finalCategory = isCustomCategory ? customCategory.trim() : category.trim();
    if (!finalCategory) {
      setFormError('Category / Topic Domain is compulsory. Please choose or enter a category.');
      return;
    }
    if (!authorName.trim()) {
      setFormError('Author name is compulsory.');
      return;
    }
    if (!content.trim()) {
      setFormError('Article content is compulsory.');
      return;
    }

    setIsSubmitting(true);

    try {
      let token = null;
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload = {
        title: title.trim(),
        bannerImageUrl: bannerImageUrl.trim(),
        category: finalCategory,
        authorName: authorName.trim(),
        authorRole: authorRole.trim(),
        publishDate: (publishDate && publishDate.trim()) ? publishDate.trim() : getLocalTodayDate(),
        pullQuote: pullQuote.trim() || undefined,
        content: content.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        sourceReference: sourceReference.trim() || undefined
      };

      const url = editingArticle ? `/api/articles/${editingArticle.id}` : '/api/articles';
      const method = editingArticle ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save article.');
      }

      if (data.article) {
        saveLocalArticle(data.article);
      }

      setFormSuccess(editingArticle ? 'Article updated successfully!' : 'Article published successfully!');
      fetchArticles();
      setTimeout(() => {
        setIsUploadModalOpen(false);
        resetForm();
      }, 1000);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteArticle = async () => {
    if (!deletingArticle) return;
    setIsSubmitting(true);
    try {
      let token = null;
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/articles/${deletingArticle.id}`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete article.');
      }

      deleteLocalArticle(deletingArticle.id);
      setArticles(prev => prev.filter(a => a.id !== deletingArticle.id && a.slug !== deletingArticle.slug));
      setDeletingArticle(null);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dynamic Categories including custom categories added to articles
  const dynamicCategories = useMemo(() => {
    const list = [...CATEGORIES];
    articles.forEach(art => {
      if (art.category && !list.some(c => c.toLowerCase() === art.category.toLowerCase())) {
        list.push(art.category);
      }
    });
    return list;
  }, [articles]);

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return articles.filter(art => {
      const matchesCategory = selectedCategory === 'All' || art.category.toLowerCase() === selectedCategory.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        art.title.toLowerCase().includes(q) ||
        art.authorName.toLowerCase().includes(q) ||
        art.content.toLowerCase().includes(q) ||
        (art.tags && art.tags.some(t => t.toLowerCase().includes(q)));
      return matchesCategory && matchesSearch;
    });
  }, [articles, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* ── Hero Section (EXACTLY identical in design to Notes, N-Intel, Gallery, About) ── */}
      <section className="relative py-48 pt-32 bg-[#050A0F] overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1B4332]/40 to-transparent"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/camouflage.png')]"></div>
          <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#1B4332]/60 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 text-center">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-[10px] font-black tracking-[0.4em] uppercase mb-8"
          >
            STRATEGIC DOSSIERS & EDITORIALS
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-[8rem] lg:text-[10rem] font-display text-white mb-8 tracking-tighter text-glow-white leading-none px-2"
          >
            ARTICLES
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/60 max-w-2xl mx-auto text-lg md:text-2xl font-medium leading-relaxed tracking-tight mb-8"
          >
            In-depth op-eds, geopolitical analyses, and strategic insights curated for defence aspirants & future officers.
          </motion.p>

          {/* Admin Action Button */}
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex items-center justify-center gap-4"
            >
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-black tracking-widest uppercase transition-all shadow-xl shadow-[#1B4332]/40 hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Plus size={16} />
                <span>Upload New Article</span>
              </button>
            </motion.div>
          )}
        </div>
      </section>

      {/* ── Main Content Area ── */}
      <section className="py-20 px-4 max-w-7xl mx-auto relative">
        {/* Search & Category Filter Toolbar */}
        <div className="mb-14 space-y-6">
          {/* Search Box */}
          <div className="max-w-2xl mx-auto">
            <div className="relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1B4332] transition-colors" size={24} />
              <input
                type="text"
                placeholder="Search articles by title, author, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-16 pr-6 py-6 bg-white border border-gray-150 rounded-[2rem] focus:border-[#1B4332] focus:ring-0 transition-all outline-none text-gray-700 font-bold text-lg shadow-[0_20px_50px_rgba(0,0,0,0.03)] placeholder:text-gray-300"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar py-2">
            {dynamicCategories.map(cat => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${isActive
                      ? 'bg-[#1B4332] text-white shadow-md shadow-[#1B4332]/25 scale-105'
                      : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200/80'
                    }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Articles Grid ── */}
        {loading ? (
          <div className="py-28 text-center text-gray-400 font-bold text-sm animate-pulse bg-white rounded-[2.5rem] border border-gray-150">
            Loading articles dossier...
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-[2.5rem] border border-gray-150 shadow-sm max-w-xl mx-auto">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
              <FileText size={32} />
            </div>
            <h3 className="text-xl font-black text-[#1A1A1A] mb-2 tracking-tight">No articles found</h3>
            <p className="text-gray-500 text-sm font-medium mb-6">
              {searchQuery ? 'No articles match your search criteria.' : 'No articles currently published in this section.'}
            </p>
            {isAdmin && (
              <button
                onClick={openCreateModal}
                className="px-6 py-3 bg-[#1B4332] text-white text-xs font-black tracking-widest uppercase rounded-xl hover:bg-[#143024] transition-all cursor-pointer"
              >
                Upload First Article
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
            {filteredArticles.map((art, idx) => (
              <motion.article
                key={art.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white rounded-[2rem] border border-gray-200/80 shadow-[0_15px_45px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_65px_rgba(0,0,0,0.08)] transition-all hover:-translate-y-1 flex flex-col justify-between overflow-hidden group relative"
              >
                {/* Admin Quick Action Controls */}
                {isAdmin && (
                  <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-black/70 backdrop-blur-md p-1 rounded-xl shadow-lg">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(art);
                      }}
                      title="Edit article"
                      className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/20 transition-colors"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingArticle(art);
                      }}
                      title="Delete article"
                      className="p-1.5 text-red-300 hover:text-red-400 rounded-lg hover:bg-white/20 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}

                <div>
                  {/* Compulsory Banner Image */}
                  <Link to={`/articles/${art.slug || art.id}`} className="block relative aspect-[16/10] overflow-hidden bg-gray-100">
                    <img
                      src={safeImageUrl(art.bannerImageUrl)}
                      alt={art.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        // Fallback image if broken
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                    {/* Category Badge on Banner */}
                    <div className="absolute top-4 left-4 z-10">
                      <span className="px-3 py-1 bg-white/90 backdrop-blur-md text-[#1B4332] text-[10px] font-black uppercase tracking-widest rounded-full border border-white/20 shadow-xs">
                        {art.category}
                      </span>
                    </div>

                    {/* Reading Time */}
                    <div className="absolute bottom-3 right-4 z-10 text-white text-[11px] font-bold flex items-center gap-1.5">
                      <Clock size={12} />
                      <span>{art.readingTime}</span>
                    </div>
                  </Link>

                  {/* Card Content Body */}
                  <div className="p-7">
                    {/* Date */}
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Calendar size={12} className="text-gray-400" />
                      <span>{art.publishDate}</span>
                    </div>

                    {/* Headline */}
                    <Link to={`/articles/${art.slug || art.id}`}>
                      <h2 className="text-xl md:text-2xl font-black text-[#1A1A1A] tracking-tight leading-snug mb-3 group-hover:text-[#1B4332] transition-colors line-clamp-2">
                        {art.title}
                      </h2>
                    </Link>

                    {/* Pull Quote Snippet */}
                    {art.pullQuote && (
                      <p className="text-xs font-semibold text-gray-600 italic border-l-2 border-[#1B4332]/40 pl-3 mb-4 line-clamp-2">
                        "{art.pullQuote}"
                      </p>
                    )}

                    {/* Author Attribution */}
                    <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                      <div className="w-9 h-9 rounded-full bg-[#1B4332]/10 text-[#1B4332] flex items-center justify-center font-black text-xs">
                        {art.authorName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black text-[#1A1A1A] truncate">{art.authorName}</div>
                        <div className="text-[10px] font-medium text-gray-400 truncate">{art.authorRole}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="px-7 pb-7 pt-2 flex items-center justify-between gap-3 border-t border-gray-100/80">
                  <Link
                    to={`/articles/${art.slug || art.id}`}
                    className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#1B4332] group-hover:text-[#143024] transition-colors"
                  >
                    <span>Read Article</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Link>

                  <Link
                    to={`/articles/${art.slug || art.id}?download=1`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-[#1B4332] hover:text-white text-gray-700 text-xs font-black rounded-xl border border-gray-200/80 transition-all shadow-xs"
                    title="Download as PDF"
                  >
                    <Download size={13} />
                    <span>PDF</span>
                  </Link>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </section>

      {/* ── ADMIN CREATE / EDIT ARTICLE MODAL (Rendered via Portal directly to body to bypass stacking contexts) ── */}
      {mounted && isUploadModalOpen && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsUploadModalOpen(false)}
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-10 shadow-2xl border border-gray-100 my-auto max-h-[90vh] overflow-y-auto text-left relative"
          >
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1B4332]/10 text-[#1B4332] rounded-xl flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">
                    {editingArticle ? 'Edit Article' : 'Upload Strategic Article'}
                  </h2>
                  <p className="text-xs text-gray-500 font-medium">
                    Compulsory banner image and editorial formatting for newspaper op-ed layout.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <Check size={16} className="shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmitArticle} className="space-y-6">
              {/* 1. Article Title */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
                  Article Headline / Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tied by geography, divided by politics"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#1B4332] focus:bg-white focus:ring-0 outline-none text-sm font-bold text-gray-800"
                />
              </div>

              {/* 2. COMPULSORY BANNER IMAGE */}
              <div className="p-5 rounded-2xl bg-amber-50/60 border-2 border-dashed border-amber-300">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-2">
                    <Upload size={14} className="text-amber-700" />
                    <span>Compulsory Banner Image <span className="text-red-600 font-black">*</span></span>
                  </label>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200/70 text-amber-900 px-2.5 py-0.5 rounded-full">
                    Required Field
                  </span>
                </div>
                <p className="text-[11px] font-medium text-amber-800 mb-3">
                  Use a public image URL or choose a file to compress and store with the article. Very detailed images may need a smaller image or URL.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Paste image URL (https://...) or choose file below"
                    value={bannerImageUrl}
                    onChange={(e) => setBannerImageUrl(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:border-[#1B4332] outline-none text-xs font-bold text-gray-800 placeholder:text-gray-400"
                  />

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleBannerFileUpload}
                    accept="image/*"
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={isUploadingBanner}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black tracking-wider uppercase flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Upload size={13} />
                    <span>{isUploadingBanner ? 'Compressing...' : 'Choose File'}</span>
                  </button>
                </div>

                {/* Banner Image Live Preview */}
                {bannerImageUrl && (
                  <div className="mt-4 relative aspect-[16/8] rounded-xl overflow-hidden border border-amber-300 shadow-sm bg-gray-100">
                    <img
                      src={safeImageUrl(bannerImageUrl)}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                      onError={() => setFormError('The banner image URL could not be loaded. Please verify the URL.')}
                    />
                    <div className="absolute bottom-2 left-2 px-2.5 py-0.5 bg-black/70 text-white text-[10px] font-bold rounded-md">
                      Banner Preview Loaded
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Category & Date Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
                    Category / Topic Domain <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={isCustomCategory ? 'Custom' : category}
                    onChange={(e) => {
                      if (e.target.value === 'Custom') {
                        setIsCustomCategory(true);
                      } else {
                        setIsCustomCategory(false);
                        setCategory(e.target.value);
                      }
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#1B4332] outline-none text-xs font-bold text-gray-800"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="Custom">+ Custom / Other Topic Domain...</option>
                  </select>

                  {isCustomCategory && (
                    <div className="mt-2.5">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-[#1B4332] mb-1">
                        Specify Custom Topic Domain <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Maritime Strategy, Air Power, Nuclear Geopolitics..."
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border-2 border-[#1B4332]/40 rounded-xl focus:border-[#1B4332] outline-none text-xs font-bold text-gray-800 placeholder:text-gray-400 shadow-xs"
                        autoFocus
                      />
                      <span className="text-[10px] text-gray-400 font-medium block mt-1">
                        Articles under this topic will automatically get their own filter pill on the feed.
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-700">
                      Publication Date
                    </label>
                    <span className="text-[10px] font-bold text-[#1B4332] bg-[#1B4332]/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Check size={11} />
                      <span>Today</span>
                    </span>
                  </div>
                  <input
                    type="date"
                    value={publishDate}
                    onChange={(e) => setPublishDate(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#1B4332] outline-none text-xs font-bold text-gray-800"
                  />
                  <span className="text-[10px] text-gray-400 font-medium block mt-1">
                    Automatically defaults to today's date. You can change it if backdating an article.
                  </span>
                </div>
              </div>

              {/* 4. Author Information */}
              <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-4">
                <div className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-2">
                  <User size={14} className="text-[#1B4332]" />
                  <span>Author Credentials</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      Author Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mohammed Ayoob"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      Author Designation / Academic Affiliation
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Professor Emeritus of International Relations, Michigan State University"
                      value={authorRole}
                      onChange={(e) => setAuthorRole(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Central Thesis / Pull Quote */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
                  Central Thesis / Key Pull Quote
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. India and Bangladesh must overcome mistrust and pursue pragmatic neighbourhood cooperation."
                  value={pullQuote}
                  onChange={(e) => setPullQuote(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#1B4332] outline-none text-xs font-bold text-gray-800"
                />
              </div>

              {/* 6. Article Content & Highlighting Syntax */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black uppercase tracking-wider text-gray-700">
                    Editorial Content <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-gray-500">
                    Use <code className="bg-yellow-100 text-yellow-900 px-1 py-0.5 rounded">==yellow==</code> or <code className="bg-emerald-100 text-emerald-900 px-1 py-0.5 rounded">""green""</code> for exam highlights
                  </span>
                </div>
                <textarea
                  rows={12}
                  required
                  placeholder='Write article paragraphs... Use ### Subheading for editorial sub-sections, ==text== for yellow exam highlights, and ""text"" for green exam highlights.'
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#1B4332] focus:bg-white outline-none text-xs font-medium text-gray-800 leading-relaxed font-mono"
                />
              </div>

              {/* 7. Tags & Source Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="India-Bangladesh, Foreign Policy, 1971 War"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
                    Source / Reference (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Strategic Studies Review"
                    value={sourceReference}
                    onChange={(e) => setSourceReference(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black tracking-wider uppercase transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 rounded-xl bg-[#1B4332] hover:bg-[#143024] text-white text-xs font-black tracking-widest uppercase transition-all shadow-lg shadow-[#1B4332]/25 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Publishing...' : (editingArticle ? 'Save Changes' : 'Publish Article')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>,
        document.body
      )}

      {/* ── ADMIN DELETE CONFIRMATION MODAL (Rendered via Portal directly to body) ── */}
      {mounted && deletingArticle && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDeletingArticle(null)}
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 text-center my-auto relative"
          >
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} />
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">Delete Article?</h3>
            <p className="text-xs text-gray-500 mb-6 font-medium leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-gray-800">"{deletingArticle.title}"</span>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingArticle(null)}
                className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black tracking-wider uppercase transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleDeleteArticle}
                className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black tracking-wider uppercase transition-colors shadow-lg shadow-red-600/30 disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}
