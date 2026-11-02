import type { NIntelStory } from './types';

/**
 * Returns the base canonical URL for the site.
 * Defaults to current origin in the browser or Vercel production domain.
 */
export function getBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://nishchay-gules.vercel.app';
}

/**
 * Returns today's date formatted as YYYY-MM-DD in the local calendar timezone (not UTC)
 */
export function getLocalTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a clean date string for sharing (e.g. "2 Nov 2026").
 * Automatically fetches current local date if omitted or invalid.
 */
export function formatDisplayDate(dateStr?: string): string {
  try {
    const target = (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr))
      ? dateStr
      : getLocalTodayDate();
    const parts = target.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return target;
  } catch {
    return dateStr || getLocalTodayDate();
  }
}

/**
 * Builds the official WhatsApp share URL for an individual story
 */
export function getStoryWhatsAppShareUrl(story: NIntelStory, customBaseUrl?: string): string {
  const base = customBaseUrl || getBaseUrl();
  const canonicalUrl = `${base}/n-intel/story/${encodeURIComponent(story.id)}`;
  const dateFormatted = formatDisplayDate(story.date);

  // Take a clean 1-2 sentence excerpt from content
  const cleanContent = story.content.replace(/\r?\n+/g, ' ').trim();
  let excerpt = cleanContent;
  if (excerpt.length > 180) {
    const cut = excerpt.slice(0, 175).lastIndexOf(' ');
    excerpt = (cut > 60 ? excerpt.slice(0, cut) : excerpt.slice(0, 170)) + '...';
  }

  const message = [
    'N-INTEL | Team Nishchay',
    `Date: ${dateFormatted}`,
    '',
    story.headline,
    '',
    excerpt,
    '',
    `Read full update: ${canonicalUrl}`,
    '',
    '🔗 Join Other Nishchay Defence Handles using the link below',
    'https://linktr.ee/nishchay.defence'
  ].join('\n');

  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

/**
 * Builds the official WhatsApp share URL for the full daily edition.
 * Automatically fetches the current local calendar date (e.g. "2 Nov 2026")
 * and current URL parameter (e.g. ?date=2026-11-02) if dateStr is omitted or invalid.
 */
export function getDailyEditionWhatsAppShareUrl(dateStr?: string, totalStories?: number, customBaseUrl?: string): string {
  const base = customBaseUrl || getBaseUrl();
  const today = getLocalTodayDate();
  const effectiveDate = (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) ? dateStr : today;
  const canonicalUrl = `${base}/n-intel?date=${encodeURIComponent(effectiveDate)}`;
  const dateFormatted = formatDisplayDate(effectiveDate);
  const countText = (totalStories && totalStories > 0) ? `${totalStories} top updates` : "55 top updates";

  const message = [
    'N-INTEL Daily Edition | Team Nishchay',
    `Date: ${dateFormatted}`,
    '',
    `Read ${countText} on Defence, National & International Affairs:`,
    canonicalUrl,
    '',
    '🔗 Join Other Nishchay Defence Handles using the link below',
    'https://linktr.ee/nishchay.defence'
  ].join('\n');

  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

/**
 * Triggers opening the WhatsApp share window
 */
export function openWhatsAppShare(url: string) {
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
