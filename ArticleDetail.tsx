import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, Calendar, Clock, User, Download,
  Printer, MessageCircle, Sparkles, BookOpen, ExternalLink,
  Shield, Check, ArrowLeft
} from 'lucide-react';
import type { Article } from './articles-db';
import { openWhatsAppShare } from './n-intel-whatsapp';
import { getLocalArticles, saveLocalArticle, syncLocalArticlesWithServer } from './articles-storage';

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [article, setArticle] = useState<Article | null>(() => {
    if (!id) return null;
    const q = id.toLowerCase();
    const local = getLocalArticles();
    return local.find(a => a.id === id || a.slug === id || a.id.toLowerCase() === q || (a.slug && a.slug.toLowerCase() === q)) || null;
  });
  const [loading, setLoading] = useState(() => {
    if (!id) return false;
    const q = id.toLowerCase();
    const cached = getLocalArticles().find(a => a.id === id || a.slug === id || a.id.toLowerCase() === q || (a.slug && a.slug.toLowerCase() === q));
    return !cached;
  });
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const q = id.toLowerCase();
    const cached = getLocalArticles().find(a => 
      a.id === id || a.slug === id || a.id.toLowerCase() === q || (a.slug && a.slug.toLowerCase() === q)
    );
    if (cached) {
      setArticle(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetch(`/api/articles/${encodeURIComponent(id)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.article) {
          setArticle(data.article);
          saveLocalArticle(data.article);
          // If URL had ?download=1, auto trigger PDF export after loading
          if (searchParams.get('download') === '1') {
            setTimeout(() => {
              handleDownloadPdf(data.article.id);
            }, 600);
          }
        } else if (cached) {
          // Server lost data due to serverless cold restart — trigger background sync to restore it!
          syncLocalArticlesWithServer().catch(() => {});
        }
      })
      .catch(err => {
        console.warn('Network issue fetching article from server:', err);
        if (cached) {
          syncLocalArticlesWithServer().catch(() => {});
        }
      })
      .finally(() => setLoading(false));
  }, [id, searchParams]);

  const formatPrintDate = (rawDate?: string) => {
    if (!rawDate) return 'October 2026';
    try {
      const parts = rawDate.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      }
      return rawDate;
    } catch {
      return rawDate;
    }
  };

  const handleDownloadPdf = async (articleId?: string) => {
    setIsDownloading(true);
    const targetId = articleId || article?.id;
    if (targetId) {
      try {
        await fetch(`/api/articles/${encodeURIComponent(targetId)}/download`, { method: 'POST' });
      } catch (e) {
        // non-blocking
      }
    }

    // Suppress browser default title in printed headers
    const originalTitle = document.title;
    document.title = ' ';

    const restore = () => {
      document.title = originalTitle;
      setIsDownloading(false);
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore, { once: true });

    // Universal standard: browser print dialog allows saving as crisp vector PDF with our @media print stylesheet
    window.print();

    setTimeout(() => {
      document.title = originalTitle;
      setIsDownloading(false);
    }, 2500);
  };

  const handleWhatsAppShare = () => {
    if (!article) return;
    const text = `*${article.title}*\nBy ${article.authorName} (${article.authorRole})\n\nRead the complete editorial and download the PDF on Team Nishchay:\n${window.location.href}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    openWhatsAppShare(url);
  };

  /**
   * Parses markdown-style headings (###), highlights (==yellow==, ""green""), and paragraphs.
   * Supports both interactive screen view and authentic newspaper print editorial dossier.
   */
  const renderFormattedContent = (rawText: string, isPrint = false) => {
    if (!rawText) return null;

    // Split text by lines
    const lines = rawText.split('\n');
    const elements: React.ReactNode[] = [];
    let isFirstParagraph = true;

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }

      // 1. Subheading (### or ##)
      if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
        const titleText = trimmed.replace(/^#{2,3}\s+/, '');
        if (isPrint) {
          elements.push(
            <h3
              key={`ph-${lineIdx}`}
              className="font-serif font-bold text-[10.5pt] uppercase tracking-wider text-[#1B4332] mt-4 mb-2 pb-1 border-b border-stone-200 print-avoid-break"
              style={{ breakAfter: 'avoid', pageBreakAfter: 'avoid' }}
            >
              {titleText}
            </h3>
          );
        } else {
          elements.push(
            <h3
              key={`h-${lineIdx}`}
              className="text-xl md:text-2xl font-black text-[#1A1A1A] tracking-tight mt-8 mb-4 border-b border-gray-100 pb-2"
            >
              {titleText}
            </h3>
          );
        }
        return;
      }

      // 2. Format inline highlights (==yellow== and ""green""), bold (**text**), and underline (__text__ or <u>text</u>)
      const parseInline = (textStr: string) => {
        const regex = /(==.*?==|""[^"\n]+""|[“”]{2}[^“”\n]+[“”]{2}|\*\*.*?\*\*|__.*?__|<u>.*?<\/u>)/g;
        const parts = textStr.split(regex);

        return parts.map((part, pIdx) => {
          if (part.startsWith('==') && part.endsWith('==')) {
            const inner = part.slice(2, -2);
            return (
              <mark
                key={pIdx}
                className={
                  isPrint
                    ? 'bg-[#FEF08A] text-stone-950 px-1 py-0.5 rounded-xs font-semibold'
                    : 'bg-yellow-200/90 text-stone-900 px-1 py-0.5 rounded font-semibold'
                }
                style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
              >
                {inner}
              </mark>
            );
          }
          if (
            (part.startsWith('""') && part.endsWith('""') && part.length >= 4) ||
            (part.startsWith('““') && part.endsWith('””') && part.length >= 4)
          ) {
            const inner = part.slice(2, -2);
            return (
              <mark
                key={pIdx}
                className={
                  isPrint
                    ? 'bg-[#BBF7D0] text-stone-950 px-1 py-0.5 rounded-xs font-semibold'
                    : 'bg-emerald-200/90 text-stone-900 px-1 py-0.5 rounded font-semibold'
                }
                style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
              >
                {inner}
              </mark>
            );
          }
          if (part.startsWith('**') && part.endsWith('**')) {
            const inner = part.slice(2, -2);
            return <strong key={pIdx} className={isPrint ? 'font-bold text-stone-950' : 'font-black text-[#1A1A1A]'}>{inner}</strong>;
          }
          if (part.startsWith('__') && part.endsWith('__')) {
            const inner = part.slice(2, -2);
            return <u key={pIdx} className="underline decoration-stone-800 decoration-1 underline-offset-2">{inner}</u>;
          }
          if (part.startsWith('<u>') && part.endsWith('</u>')) {
            const inner = part.slice(3, -4);
            return <u key={pIdx} className="underline decoration-stone-800 decoration-1 underline-offset-2">{inner}</u>;
          }
          return part;
        });
      };

      // 3. First paragraph gets elegant newspaper drop-cap
      if (isFirstParagraph) {
        isFirstParagraph = false;
        const firstLetter = trimmed.charAt(0);
        const restOfParagraph = trimmed.slice(1);

        if (isPrint) {
          elements.push(
            <p
              key={`pp-${lineIdx}`}
              className="mb-3 text-justify font-serif text-[9.5pt] leading-[1.65] text-stone-900"
              style={{ hyphens: 'auto', WebkitHyphens: 'auto', textJustify: 'inter-word' }}
            >
              <span
                className="float-left font-serif font-black text-[#1B4332] uppercase leading-none"
                style={{ fontSize: '34pt', lineHeight: 0.8, paddingRight: '8px', paddingTop: '2px' }}
              >
                {firstLetter}
              </span>
              {parseInline(restOfParagraph)}
            </p>
          );
        } else {
          elements.push(
            <p
              key={`p-${lineIdx}`}
              className="text-gray-800 text-base md:text-lg leading-relaxed font-normal mb-5 text-justify"
            >
              <span className="float-left text-5xl md:text-6xl font-serif font-black text-[#1B4332] leading-none pr-3 pt-1 uppercase">
                {firstLetter}
              </span>
              {parseInline(restOfParagraph)}
            </p>
          );
        }
      } else {
        if (isPrint) {
          elements.push(
            <p
              key={`pp-${lineIdx}`}
              className="mb-3 text-justify font-serif text-[9.5pt] leading-[1.65] text-stone-900"
              style={{ hyphens: 'auto', WebkitHyphens: 'auto', textJustify: 'inter-word' }}
            >
              {parseInline(trimmed)}
            </p>
          );
        } else {
          elements.push(
            <p
              key={`p-${lineIdx}`}
              className="text-gray-800 text-base md:text-lg leading-relaxed font-normal mb-5 text-justify"
            >
              {parseInline(trimmed)}
            </p>
          );
        }
      }
    });

    return elements;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] pt-40 pb-24 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#1B4332] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 font-bold text-sm">Loading article dossier...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] pt-40 pb-24 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-xl">
          <h2 className="text-2xl font-black text-gray-900 mb-2">Article Not Found</h2>
          <p className="text-gray-500 text-sm mb-6">
            The requested article could not be located or has been archived.
          </p>
          <Link
            to="/articles"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1B4332] text-white text-xs font-black tracking-widest rounded-xl hover:bg-[#143024] uppercase"
          >
            <ArrowLeft size={16} />
            Back to Articles
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pt-28 md:pt-32 pb-24 text-[#1A1A1A] print:bg-white print:p-0 print:m-0 print:min-h-0 print:overflow-visible print:block">
      {/* ══════════════════════════════════════════════════════════════════════════
          1. DEDICATED PRINT PUBLICATION VIEW (renders ONLY when printing / downloading PDF)
          Authentic Newspaper Op-Ed & Strategic Review Dossier Layout
          ══════════════════════════════════════════════════════════════════════════ */}
      <div className="hidden print:block w-full m-0 p-0 text-stone-900 bg-white font-serif">
        {/* ── OFFICIAL NISHCHAY DEFENCE PUBLICATION MASTHEAD ── */}
        <div className="print-header mb-5 print-avoid-break">
          {/* Main Brand Row (Centralized branding with green dividing rule) */}
          <div className="flex items-center justify-center gap-4 pb-3 mb-3 border-b-2 border-[#1B4332] text-center">
            <img
              src="/logo.jpg"
              alt="Nishchay Defence Logo"
              className="w-13 h-13 object-contain rounded-xl border border-stone-200 shadow-xs shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="text-[26pt] leading-none font-serif font-black tracking-wider text-[#1B4332] uppercase">
              NISHCHAY DEFENCE
            </div>
          </div>

          {/* Structured 4-Column Metadata Ribbon (Boxed Structure) */}
          <table className="w-full border-collapse border border-stone-300 bg-stone-50/70 text-left text-stone-800" style={{ tableLayout: 'fixed' }}>
            <tbody>
              <tr>
                <td className="p-2.5 border-r border-stone-300 align-top" style={{ width: '25%' }}>
                  <div className="text-[7pt] font-black uppercase tracking-widest text-[#1B4332]">
                    STRATEGIC DOMAIN
                  </div>
                  <div className="font-bold text-stone-900 mt-1 text-[8.5pt] whitespace-normal break-words leading-snug">
                    {article.category}
                  </div>
                </td>
                <td className="p-2.5 border-r border-stone-300 align-top" style={{ width: '25%' }}>
                  <div className="text-[7pt] font-black uppercase tracking-widest text-stone-500">
                    PUBLICATION DATE
                  </div>
                  <div className="font-bold text-stone-900 mt-1 text-[8.5pt] whitespace-normal break-words leading-snug">
                    {formatPrintDate(article.publishDate)}
                  </div>
                </td>
                <td className="p-2.5 border-r border-stone-300 align-top" style={{ width: '20%' }}>
                  <div className="text-[7pt] font-black uppercase tracking-widest text-stone-500">
                    EST. READING TIME
                  </div>
                  <div className="font-bold text-stone-900 mt-1 text-[8.5pt] whitespace-normal break-words leading-snug">
                    {article.readingTime || '7 min read'}
                  </div>
                </td>
                <td className="p-2.5 align-top" style={{ width: '30%' }}>
                  <div className="text-[7pt] font-black uppercase tracking-widest text-stone-500">
                    EDITORIAL REFERENCE
                  </div>
                  <div className="font-bold text-stone-900 mt-1 text-[8.5pt] whitespace-normal break-words leading-snug">
                    {article.sourceReference || 'Strategic Affairs Archive'}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Op-Ed Headline */}
        <h1 className="text-[26pt] leading-[1.15] font-serif font-black text-stone-950 tracking-tight mt-3 mb-2 print-avoid-break">
          {article.title}
        </h1>

        {/* Standfirst / Lead Pull Quote */}
        {article.pullQuote && (
          <div className="border-l-4 border-[#1B4332] bg-[#F7F9F8] pl-4 py-2.5 my-3.5 text-[11pt] font-serif italic text-stone-800 leading-relaxed rounded-r-md print-avoid-break">
            "{article.pullQuote}"
          </div>
        )}

        {/* Author Byline */}
        <div className="flex items-center gap-3.5 py-2.5 mb-4 border-b border-stone-300 print-avoid-break">
          {article.authorAvatarUrl ? (
            <img
              src={article.authorAvatarUrl}
              alt={article.authorName}
              className="w-11 h-11 rounded-full object-cover shrink-0 border border-stone-300"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[#1B4332] text-white flex items-center justify-center font-serif font-bold text-base shrink-0">
              {article.authorName.charAt(0)}
            </div>
          )}
          <div className="leading-tight">
            <div className="font-serif font-bold text-[11pt] text-stone-950 tracking-wide uppercase">
              {article.authorName}
            </div>
            <div className="text-[8.5pt] font-serif text-stone-600 italic mt-0.5 leading-snug">
              {article.authorRole}
            </div>
          </div>
        </div>

        {/* Two-Column Editorial Body */}
        <div className="article-print-columns text-justify font-serif text-[9.5pt] leading-[1.65] text-stone-900">
          {renderFormattedContent(article.content, true)}
        </div>

        {/* Keywords / Tags at end */}
        {article.tags && article.tags.length > 0 && (
          <div className="mt-5 pt-3 border-t border-stone-300 flex flex-wrap items-center gap-1.5 print-avoid-break">
            <span className="text-[7.5pt] font-mono font-bold uppercase tracking-wider text-stone-500 mr-2">Keywords:</span>
            {article.tags.map((tag, tIdx) => (
              <span
                key={tIdx}
                className="px-2 py-0.5 rounded bg-stone-100 border border-stone-200 text-stone-700 text-[8pt] font-mono font-medium"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          2. INTERACTIVE SCREEN VIEW (hidden in print)
          Modern, responsive web reading experience
          ══════════════════════════════════════════════════════════════════════════ */}
      <div className="print:hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          {/* Back to Articles Button */}
          <div className="mb-6">
            <Link
              to="/articles"
              className="inline-flex items-center gap-2 text-gray-500 hover:text-[#1A1A1A] transition-colors group"
            >
              <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                <ChevronLeft size={18} />
              </div>
              <span className="font-bold text-xs tracking-widest uppercase">
                Back to Strategic Articles
              </span>
            </Link>
          </div>

          {/* ── MAIN ARTICLE CONTAINER ── */}
          <article className="bg-white rounded-[2.5rem] border border-gray-200/80 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
            {/* Banner Image */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
              <img
                src={article.bannerImageUrl}
                alt={article.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

              {/* Banner Category Badge */}
              <div className="absolute top-6 left-6">
                <span className="px-4 py-1.5 bg-white/95 backdrop-blur-md text-[#1B4332] text-xs font-black uppercase tracking-widest rounded-full shadow-md">
                  {article.category}
                </span>
              </div>

              {/* Banner Reading Time */}
              <div className="absolute bottom-6 right-6 text-white text-xs font-bold flex items-center gap-2 bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full">
                <Clock size={13} />
                <span>{article.readingTime}</span>
              </div>
            </div>

            <div className="p-8 sm:p-12 md:p-16">
              {/* Metadata Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-100">
                <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
                  <span className="flex items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-lg border border-gray-150">
                    <Calendar size={13} className="text-[#1B4332]" />
                    <span>{article.publishDate}</span>
                  </span>
                  {article.sourceReference && (
                    <span className="text-gray-400 font-medium">
                      • Ref: {article.sourceReference}
                    </span>
                  )}
                </div>

                {/* Action Buttons: PDF Download & Share on WhatsApp */}
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleDownloadPdf()}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#1B4332] hover:bg-[#143024] text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md shadow-[#1B4332]/20 hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                    title="Download article in PDF format"
                  >
                    <Download size={14} />
                    <span>{isDownloading ? 'Preparing PDF...' : 'Download PDF'}</span>
                  </button>

                  <button
                    onClick={handleWhatsAppShare}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md shadow-[#25D366]/20 hover:scale-105 active:scale-95 cursor-pointer"
                    title="Share on WhatsApp"
                  >
                    <MessageCircle size={15} />
                    <span>Share on WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Article Headline */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#1A1A1A] tracking-tight leading-tight mb-8 font-serif">
                {article.title}
              </h1>

              {/* Author Box */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 rounded-2xl bg-[#F0F7F4] border border-emerald-200/80 mb-10">
                <div className="flex items-center gap-3.5">
                  {article.authorAvatarUrl ? (
                    <img
                      src={article.authorAvatarUrl}
                      alt={article.authorName}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-[#1B4332] text-white flex items-center justify-center font-serif font-black text-xl shadow-sm shrink-0">
                      {article.authorName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="text-base font-black text-[#1A1A1A] font-serif">
                      {article.authorName}
                    </div>
                    <div className="text-xs text-gray-600 font-medium leading-relaxed max-w-xl">
                      {article.authorRole}
                    </div>
                  </div>
                </div>

                {article.pdfDownloadCount !== undefined && article.pdfDownloadCount > 0 && (
                  <div className="text-[11px] font-bold text-gray-400 bg-white px-3 py-1.5 rounded-xl border border-gray-100 self-start sm:self-auto shrink-0">
                    {article.pdfDownloadCount} Aspirants Downloaded
                  </div>
                )}
              </div>

              {/* Pull Quote Callout */}
              {article.pullQuote && (
                <div className="my-8 p-6 md:p-8 rounded-2xl bg-amber-50/70 border-l-4 border-amber-500 shadow-xs">
                  <blockquote className="text-lg md:text-xl font-serif italic text-amber-950 leading-relaxed font-bold">
                    "{article.pullQuote}"
                  </blockquote>
                </div>
              )}

              {/* Article Content */}
              <div className="prose max-w-none text-[#1A1A1A] leading-relaxed font-sans">
                {renderFormattedContent(article.content, false)}
              </div>

              {/* Tags Section */}
              {article.tags && article.tags.length > 0 && (
                <div className="mt-12 pt-6 border-t border-gray-100 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 mr-2 uppercase tracking-wider">Keywords:</span>
                  {article.tags.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      className="px-3 py-1 rounded-lg bg-gray-50 text-gray-700 border border-gray-200/60 text-xs font-bold"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
