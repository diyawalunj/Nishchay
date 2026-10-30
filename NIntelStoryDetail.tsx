import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ChevronLeft, Calendar, Shield, ExternalLink,
  Check, ArrowLeft, AlertCircle, Bookmark
} from 'lucide-react';
import type { NIntelStory } from './types';
import {
  getStoryWhatsAppShareUrl,
  openWhatsAppShare,
  formatDisplayDate
} from './n-intel-whatsapp';

export default function NIntelStoryDetail() {
  const { id } = useParams<{ id: string }>();
  const [story, setStory] = useState<NIntelStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    fetch(`/api/n-intel/stories/${encodeURIComponent(id)}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success && data.story) {
          if (data.story.isDeleted) {
            setError('This story has been deleted or is unavailable.');
          } else {
            setStory(data.story);
          }
        } else {
          setError(data.error || 'Story not found.');
        }
      })
      .catch((err) => {
        console.error('Error fetching story detail:', err);
        setError('Failed to load story. Please check your connection.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleShare = () => {
    if (!story) return;
    const url = getStoryWhatsAppShareUrl(story);
    openWhatsAppShare(url);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] pt-32 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-gray-100 shadow-sm animate-pulse space-y-6">
            <div className="h-6 w-32 bg-gray-200 rounded-md"></div>
            <div className="h-10 w-4/5 bg-gray-200 rounded-lg"></div>
            <div className="h-4 w-48 bg-gray-100 rounded"></div>
            <div className="space-y-3 pt-4">
              <div className="h-4 w-full bg-gray-100 rounded"></div>
              <div className="h-4 w-full bg-gray-100 rounded"></div>
              <div className="h-4 w-3/4 bg-gray-100 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] pt-32 pb-24 flex items-center justify-center">
        <div className="max-w-md w-full mx-4 bg-white rounded-3xl p-8 sm:p-10 text-center border border-gray-100 shadow-xl">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Story Unavailable</h2>
          <p className="text-gray-500 text-xs sm:text-sm mb-6 leading-relaxed">
            {error || 'The requested news story could not be found or has been removed by administrators.'}
          </p>
          <Link
            to="/n-intel"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1B4332] text-white text-xs font-black tracking-widest rounded-xl hover:bg-[#2D6A4F] transition-all uppercase"
          >
            <ArrowLeft size={16} />
            Back to N-INTEL Feed
          </Link>
        </div>
      </div>
    );
  }

  const isDefence = story.isDefence || story.category.toLowerCase().includes('defence');

  return (
    <div className="min-h-screen bg-[#F8F9FA] pt-28 pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Top Back Navigation */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            to={`/n-intel?date=${encodeURIComponent(story.date)}`}
            className="flex items-center gap-2 text-gray-500 hover:text-[#1A1A1A] transition-colors group"
          >
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
              <ChevronLeft size={20} />
            </div>
            <span className="font-bold text-xs tracking-widest uppercase">
              Back to {formatDisplayDate(story.date)} Edition
            </span>
          </Link>

          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-600 hover:text-[#1A1A1A] shadow-sm transition-colors"
          >
            {copied ? (
              <>
                <Check size={16} className="text-emerald-600" />
                <span className="text-emerald-600">Copied Link!</span>
              </>
            ) : (
              <>
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>

        {/* Main Article Container */}
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-8 md:p-12 border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.03)]"
        >
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="section-label mb-0">
              {story.category}
            </span>

            <span className="text-xs font-bold text-gray-400">
              {formatDisplayDate(story.date)}
            </span>

            {story.itemNumber && (
              <span className="px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg text-xs font-mono font-black text-gray-500">
                Item #{story.itemNumber}
              </span>
            )}
          </div>

          {/* Story Body Content - bold unified text without redundant headline */}
          <div className="text-gray-900 font-bold leading-relaxed text-lg sm:text-xl mb-10 whitespace-pre-wrap">
            {story.content}
          </div>

          {/* Source Link if Available */}
          {story.sourceUrl && (
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 mb-8 flex items-center justify-between">
              <div className="text-xs font-medium text-gray-600">
                <span className="font-bold text-gray-900">Reference Link:</span> {story.sourceName || 'External Source'}
              </div>
              <a
                href={story.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#1B4332] hover:underline"
              >
                <span>Open Link</span>
                <ExternalLink size={14} />
              </a>
            </div>
          )}

          {/* Tags */}
          {story.tags && story.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-6 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tags:</span>
              {story.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs font-semibold px-3 py-1 bg-gray-100 text-gray-700 rounded-lg"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </motion.article>
      </div>
    </div>
  );
}
