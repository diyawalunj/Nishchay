import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Calendar, Search, Shield, ExternalLink,
  ChevronLeft, Sparkles, Filter, Check,
  ArrowRight, Lock, MessageCircle, ArrowLeft,
  Newspaper, Scale, Trophy, Briefcase, Globe,
  AlertTriangle, BookOpen, Layers, Clock, Copy,
  X, Trash2, Edit3,
  TrendingUp, Award, Cpu, Landmark, Compass
} from 'lucide-react';
import type { NIntelStory } from './types';
import {
  getDailyEditionWhatsAppShareUrl,
  openWhatsAppShare,
  formatDisplayDate,
  getLocalTodayDate
} from './n-intel-whatsapp';
import { auth, onAuthStateChanged, checkIfAdmin } from './firebase';
import {
  mergeEditionsWithLocal,
  mergeStoriesWithLocal,
  syncLocalWithServer,
  type EditionSummary
} from './n-intel-storage';

interface StoryBreakdown {
  lead: string;
  points: string[];
  tags: string[];
  readingTime: string;
}

/**
 * Parses unstructured story text into high-retention bite-sized exam takeaways.
 * Breaks walls of dense text into a crisp Lead Hook + bulleted Key Points.
 */
function formatStoryBreakdown(content: string, fallbackTags: string[] = [], customHeadline?: string): StoryBreakdown {
  const text = (content || '').replace(/^\d+[\.\)]\s*/, '').trim();
  if (!text && !customHeadline) {
    return { lead: '', points: [], tags: [], readingTime: '15s read' };
  }

  const wordCount = (text || customHeadline || '').split(/\s+/).length;
  const seconds = Math.max(12, Math.round((wordCount / 200) * 60));
  const readingTime = `${seconds}s read`;

  // Protect common honorifics, titles and abbreviations
  const protectedText = text
    .replace(/\b(Shri|Smt|Dr|Mr|Mrs|Ms|Prof|Gen|Lt|Maj|Col|Capt|Adm|Air|CEN|No|vs|v|e\.g|i\.e)\./gi, '$1__DOT__')
    .replace(/\b([A-Z])\.([A-Z])\./g, '$1__DOT__$2__DOT__')
    .replace(/\b([A-Z])\.\s/g, '$1__DOT__ ')
    .replace(/(\d+)\.(\d+)/g, '$1__DEC__$2');

  const rawSentences = protectedText.split(/(?<=[.!?])\s+/);
  const sentences = rawSentences
    .map(s => s.replace(/__DOT__/g, '.').replace(/__DEC__/g, '.').trim())
    .filter(Boolean);

  let lead = customHeadline?.trim() || sentences[0] || text;
  let points = sentences.slice(1);

  // If custom headline was provided and matches first sentence, don't duplicate
  if (customHeadline && customHeadline.trim()) {
    if (sentences.length > 0 && sentences[0].toLowerCase().trim() === customHeadline.toLowerCase().trim()) {
      points = sentences.slice(1);
    } else {
      points = sentences;
    }
  }

  // If there's only 1 long sentence with a semicolon or dash, split for readability
  if (points.length === 0 && lead.length > 130) {
    const semiMatch = lead.split(/\s*;\s*/);
    if (semiMatch.length > 1) {
      lead = semiMatch[0];
      points = semiMatch.slice(1);
    }
  }

  // Extract key exam tags / entities (quotes, uppercase acronyms, key proper nouns)
  const extractedTags: string[] = [];
  const quoteMatches = text.match(/['\u2018\u2019"]([^'\u2018\u2019"]{3,35})['\u2018\u2019"]/g);
  if (quoteMatches) {
    quoteMatches.forEach(q => {
      const clean = q.replace(/['\u2018\u2019"]/g, '').trim();
      // Ignore if pure number
      if (clean.length > 2 && !/^\d+$/.test(clean) && !extractedTags.includes(clean)) {
        extractedTags.push(clean);
      }
    });
  }

  const acronymMatches = text.match(/\b[A-Za-z0-9-]{2,15}\b/g);
  if (acronymMatches) {
    const ignoreList = ['THE', 'AND', 'FOR', 'WITH', 'FROM', 'THIS', 'THAT', 'HAVE', 'BEEN', 'WILL', 'PM', 'SMT', 'SHRI', 'NEW', 'INDIA', 'SAID', 'WERE', 'THEIR', 'AFTER', 'ABOUT', 'MORE', 'THAN', 'OVER', 'ALSO', 'INTO', 'TWO', 'ONE', 'ALL', 'FOUR'];
    acronymMatches.forEach(a => {
      // Must not be a pure number and must contain letters
      if (!/^\d+$/.test(a) && /[A-Za-z]/.test(a)) {
        const upper = a.toUpperCase();
        if (!ignoreList.includes(upper) && a.length >= 3 && !extractedTags.includes(a)) {
          // Keep uppercase acronyms (NHRC, ISRO, DRDO, BJP) or prominent names
          if (a === upper && a.length <= 8) {
            extractedTags.push(a);
          }
        }
      }
    });
  }

  if (extractedTags.length < 2 && fallbackTags && fallbackTags.length > 0) {
    fallbackTags.forEach(t => {
      if (!extractedTags.includes(t)) extractedTags.push(t);
    });
  }

  return {
    lead,
    points,
    tags: extractedTags.slice(0, 3),
    readingTime
  };
}

interface CategoryCardTheme {
  accent: string;
  cardBg: string;
  cardBorder: string;
  cardHoverBorder: string;
  cardShadow: string;
  iconBg: string;
  iconColor: string;
  countBadge: string;
  titleHover: string;
  previewBg: string;
  bulletColor: string;
  footerBorder: string;
  footerText: string;
  borderAccent: string;
  badgeBg: string;
  pillActive: string;
  dotColor: string;
}

// ── Curated Signature Card Palettes ──

const THEME_DEFENCE: CategoryCardTheme = {
  accent: '#1B4332',
  cardBg: 'bg-[#EDF5F0]',
  cardBorder: 'border-emerald-200/90',
  cardHoverBorder: 'hover:border-[#1B4332]/50',
  cardShadow: 'shadow-[0_20px_50px_rgba(27,67,50,0.07)]',
  iconBg: 'bg-[#1B4332]/12',
  iconColor: 'text-[#1B4332]',
  countBadge: 'bg-[#1B4332]/10 border-[#1B4332]/20 text-[#1B4332]',
  titleHover: 'group-hover:text-[#1B4332]',
  previewBg: 'bg-white/80 border-[#1B4332]/15',
  bulletColor: 'text-[#1B4332]',
  footerBorder: 'border-[#1B4332]/15',
  footerText: 'text-[#1B4332] group-hover:text-[#0c1f17]',
  borderAccent: 'border-l-[#1B4332]',
  badgeBg: 'bg-[#1B4332]/10 text-[#1B4332]',
  pillActive: 'bg-[#1B4332] text-white',
  dotColor: 'bg-[#1B4332]'
};

const THEME_NATIONAL: CategoryCardTheme = {
  accent: '#D4AF37',
  cardBg: 'bg-[#FFFBEB]',
  cardBorder: 'border-amber-200/90',
  cardHoverBorder: 'hover:border-amber-400',
  cardShadow: 'shadow-[0_20px_50px_rgba(217,119,6,0.07)]',
  iconBg: 'bg-amber-100',
  iconColor: 'text-amber-700',
  countBadge: 'bg-amber-100/90 border-amber-200 text-amber-900',
  titleHover: 'group-hover:text-amber-800',
  previewBg: 'bg-white/80 border-amber-200/70',
  bulletColor: 'text-amber-600',
  footerBorder: 'border-amber-200/70',
  footerText: 'text-amber-800 group-hover:text-amber-950',
  borderAccent: 'border-l-[#D4AF37]',
  badgeBg: 'bg-[#D4AF37]/20 text-[#855800]',
  pillActive: 'bg-[#855800] text-white',
  dotColor: 'bg-[#D4AF37]'
};

const THEME_APPOINTMENTS: CategoryCardTheme = {
  accent: '#2563EB',
  cardBg: 'bg-[#EFF6FF]',
  cardBorder: 'border-blue-200/90',
  cardHoverBorder: 'hover:border-blue-400',
  cardShadow: 'shadow-[0_20px_50px_rgba(37,99,235,0.07)]',
  iconBg: 'bg-blue-100',
  iconColor: 'text-blue-700',
  countBadge: 'bg-blue-100/90 border-blue-200 text-blue-900',
  titleHover: 'group-hover:text-blue-800',
  previewBg: 'bg-white/80 border-blue-200/70',
  bulletColor: 'text-blue-600',
  footerBorder: 'border-blue-200/70',
  footerText: 'text-blue-800 group-hover:text-blue-950',
  borderAccent: 'border-l-blue-600',
  badgeBg: 'bg-blue-100 text-blue-800',
  pillActive: 'bg-blue-700 text-white',
  dotColor: 'bg-blue-600'
};

const THEME_POLITY: CategoryCardTheme = {
  accent: '#7C3AED',
  cardBg: 'bg-[#FAF5FF]',
  cardBorder: 'border-purple-200/90',
  cardHoverBorder: 'hover:border-purple-400',
  cardShadow: 'shadow-[0_20px_50px_rgba(147,51,234,0.07)]',
  iconBg: 'bg-purple-100',
  iconColor: 'text-purple-700',
  countBadge: 'bg-purple-100/90 border-purple-200 text-purple-900',
  titleHover: 'group-hover:text-purple-800',
  previewBg: 'bg-white/80 border-purple-200/70',
  bulletColor: 'text-purple-600',
  footerBorder: 'border-purple-200/70',
  footerText: 'text-purple-800 group-hover:text-purple-950',
  borderAccent: 'border-l-purple-600',
  badgeBg: 'bg-purple-100 text-purple-800',
  pillActive: 'bg-purple-700 text-white',
  dotColor: 'bg-purple-600'
};

const THEME_INTERNATIONAL: CategoryCardTheme = {
  accent: '#4F46E5',
  cardBg: 'bg-[#EEF2FF]',
  cardBorder: 'border-indigo-200/90',
  cardHoverBorder: 'hover:border-indigo-400',
  cardShadow: 'shadow-[0_20px_50px_rgba(79,70,229,0.07)]',
  iconBg: 'bg-indigo-100',
  iconColor: 'text-indigo-700',
  countBadge: 'bg-indigo-100/90 border-indigo-200 text-indigo-900',
  titleHover: 'group-hover:text-indigo-800',
  previewBg: 'bg-white/80 border-indigo-200/70',
  bulletColor: 'text-indigo-600',
  footerBorder: 'border-indigo-200/70',
  footerText: 'text-indigo-800 group-hover:text-indigo-950',
  borderAccent: 'border-l-indigo-600',
  badgeBg: 'bg-indigo-100 text-indigo-800',
  pillActive: 'bg-indigo-700 text-white',
  dotColor: 'bg-indigo-600'
};

const THEME_WORLD: CategoryCardTheme = {
  accent: '#0891B2',
  cardBg: 'bg-[#ECFEFF]',
  cardBorder: 'border-cyan-200/90',
  cardHoverBorder: 'hover:border-cyan-400',
  cardShadow: 'shadow-[0_20px_50px_rgba(6,182,212,0.07)]',
  iconBg: 'bg-cyan-100',
  iconColor: 'text-cyan-700',
  countBadge: 'bg-cyan-100/90 border-cyan-200 text-cyan-900',
  titleHover: 'group-hover:text-cyan-800',
  previewBg: 'bg-white/80 border-cyan-200/70',
  bulletColor: 'text-cyan-600',
  footerBorder: 'border-cyan-200/70',
  footerText: 'text-cyan-800 group-hover:text-cyan-950',
  borderAccent: 'border-l-cyan-600',
  badgeBg: 'bg-cyan-100 text-cyan-800',
  pillActive: 'bg-cyan-700 text-white',
  dotColor: 'bg-cyan-600'
};

const THEME_SPORTS: CategoryCardTheme = {
  accent: '#E11D48',
  cardBg: 'bg-[#FFF1F2]',
  cardBorder: 'border-rose-200/90',
  cardHoverBorder: 'hover:border-rose-400',
  cardShadow: 'shadow-[0_20px_50px_rgba(244,63,94,0.07)]',
  iconBg: 'bg-rose-100',
  iconColor: 'text-rose-700',
  countBadge: 'bg-rose-100/90 border-rose-200 text-rose-900',
  titleHover: 'group-hover:text-rose-800',
  previewBg: 'bg-white/80 border-rose-200/70',
  bulletColor: 'text-rose-600',
  footerBorder: 'border-rose-200/70',
  footerText: 'text-rose-800 group-hover:text-rose-950',
  borderAccent: 'border-l-rose-600',
  badgeBg: 'bg-rose-100 text-rose-800',
  pillActive: 'bg-rose-700 text-white',
  dotColor: 'bg-rose-600'
};

const THEME_SCIENCE: CategoryCardTheme = {
  accent: '#7C3AED',
  cardBg: 'bg-[#F5F3FF]',
  cardBorder: 'border-violet-200/90',
  cardHoverBorder: 'hover:border-violet-400',
  cardShadow: 'shadow-[0_20px_50px_rgba(139,92,246,0.07)]',
  iconBg: 'bg-violet-100',
  iconColor: 'text-violet-700',
  countBadge: 'bg-violet-100/90 border-violet-200 text-violet-900',
  titleHover: 'group-hover:text-violet-800',
  previewBg: 'bg-white/80 border-violet-200/70',
  bulletColor: 'text-violet-600',
  footerBorder: 'border-violet-200/70',
  footerText: 'text-violet-800 group-hover:text-violet-950',
  borderAccent: 'border-l-violet-600',
  badgeBg: 'bg-violet-100 text-violet-800',
  pillActive: 'bg-violet-700 text-white',
  dotColor: 'bg-violet-600'
};

const THEME_ECONOMY: CategoryCardTheme = {
  accent: '#EA580C',
  cardBg: 'bg-[#FFF7ED]',
  cardBorder: 'border-orange-200/90',
  cardHoverBorder: 'hover:border-orange-400',
  cardShadow: 'shadow-[0_20px_50px_rgba(249,115,22,0.07)]',
  iconBg: 'bg-orange-100',
  iconColor: 'text-orange-700',
  countBadge: 'bg-orange-100/90 border-orange-200 text-orange-900',
  titleHover: 'group-hover:text-orange-800',
  previewBg: 'bg-white/80 border-orange-200/70',
  bulletColor: 'text-orange-600',
  footerBorder: 'border-orange-200/70',
  footerText: 'text-orange-800 group-hover:text-orange-950',
  borderAccent: 'border-l-orange-600',
  badgeBg: 'bg-orange-100 text-orange-800',
  pillActive: 'bg-orange-700 text-white',
  dotColor: 'bg-orange-600'
};

const THEME_ENVIRONMENT: CategoryCardTheme = {
  accent: '#16A34A',
  cardBg: 'bg-[#F0FDF4]',
  cardBorder: 'border-green-200/90',
  cardHoverBorder: 'hover:border-green-400',
  cardShadow: 'shadow-[0_20px_50px_rgba(34,197,94,0.07)]',
  iconBg: 'bg-green-100',
  iconColor: 'text-green-700',
  countBadge: 'bg-green-100/90 border-green-200 text-green-900',
  titleHover: 'group-hover:text-green-800',
  previewBg: 'bg-white/80 border-green-200/70',
  bulletColor: 'text-green-600',
  footerBorder: 'border-green-200/70',
  footerText: 'text-green-800 group-hover:text-green-950',
  borderAccent: 'border-l-green-600',
  badgeBg: 'bg-green-100 text-green-800',
  pillActive: 'bg-green-700 text-white',
  dotColor: 'bg-green-600'
};

const THEME_AWARDS: CategoryCardTheme = {
  accent: '#DB2777',
  cardBg: 'bg-[#FDF2F8]',
  cardBorder: 'border-pink-200/90',
  cardHoverBorder: 'hover:border-pink-400',
  cardShadow: 'shadow-[0_20px_50px_rgba(236,72,153,0.07)]',
  iconBg: 'bg-pink-100',
  iconColor: 'text-pink-700',
  countBadge: 'bg-pink-100/90 border-pink-200 text-pink-900',
  titleHover: 'group-hover:text-pink-800',
  previewBg: 'bg-white/80 border-pink-200/70',
  bulletColor: 'text-pink-600',
  footerBorder: 'border-pink-200/70',
  footerText: 'text-pink-800 group-hover:text-pink-950',
  borderAccent: 'border-l-pink-600',
  badgeBg: 'bg-pink-100 text-pink-800',
  pillActive: 'bg-pink-700 text-white',
  dotColor: 'bg-pink-600'
};

const THEME_SCHEMES: CategoryCardTheme = {
  accent: '#CA8A04',
  cardBg: 'bg-[#FEFCE8]',
  cardBorder: 'border-yellow-200/90',
  cardHoverBorder: 'hover:border-yellow-400',
  cardShadow: 'shadow-[0_20px_50px_rgba(234,179,8,0.07)]',
  iconBg: 'bg-yellow-100',
  iconColor: 'text-yellow-700',
  countBadge: 'bg-yellow-100/90 border-yellow-200 text-yellow-900',
  titleHover: 'group-hover:text-yellow-800',
  previewBg: 'bg-white/80 border-yellow-200/70',
  bulletColor: 'text-yellow-600',
  footerBorder: 'border-yellow-200/70',
  footerText: 'text-yellow-800 group-hover:text-yellow-950',
  borderAccent: 'border-l-yellow-600',
  badgeBg: 'bg-yellow-100 text-yellow-800',
  pillActive: 'bg-yellow-700 text-white',
  dotColor: 'bg-yellow-600'
};

const THEME_SUMMITS: CategoryCardTheme = {
  accent: '#0284C7',
  cardBg: 'bg-[#F0F9FF]',
  cardBorder: 'border-sky-200/90',
  cardHoverBorder: 'hover:border-sky-400',
  cardShadow: 'shadow-[0_20px_50px_rgba(14,165,233,0.07)]',
  iconBg: 'bg-sky-100',
  iconColor: 'text-sky-700',
  countBadge: 'bg-sky-100/90 border-sky-200 text-sky-900',
  titleHover: 'group-hover:text-sky-800',
  previewBg: 'bg-white/80 border-sky-200/70',
  bulletColor: 'text-sky-600',
  footerBorder: 'border-sky-200/70',
  footerText: 'text-sky-800 group-hover:text-sky-950',
  borderAccent: 'border-l-sky-600',
  badgeBg: 'bg-sky-100 text-sky-800',
  pillActive: 'bg-sky-700 text-white',
  dotColor: 'bg-sky-600'
};

const THEME_CULTURE: CategoryCardTheme = {
  accent: '#C026D3',
  cardBg: 'bg-[#FDF4FF]',
  cardBorder: 'border-fuchsia-200/90',
  cardHoverBorder: 'hover:border-fuchsia-400',
  cardShadow: 'shadow-[0_20px_50px_rgba(217,70,239,0.07)]',
  iconBg: 'bg-fuchsia-100',
  iconColor: 'text-fuchsia-700',
  countBadge: 'bg-fuchsia-100/90 border-fuchsia-200 text-fuchsia-900',
  titleHover: 'group-hover:text-fuchsia-800',
  previewBg: 'bg-white/80 border-fuchsia-200/70',
  bulletColor: 'text-fuchsia-600',
  footerBorder: 'border-fuchsia-200/70',
  footerText: 'text-fuchsia-800 group-hover:text-fuchsia-950',
  borderAccent: 'border-l-fuchsia-600',
  badgeBg: 'bg-fuchsia-100 text-fuchsia-800',
  pillActive: 'bg-fuchsia-700 text-white',
  dotColor: 'bg-fuchsia-600'
};

const THEME_REPORTS: CategoryCardTheme = {
  accent: '#65A30D',
  cardBg: 'bg-[#F7FEE7]',
  cardBorder: 'border-lime-200/90',
  cardHoverBorder: 'hover:border-lime-400',
  cardShadow: 'shadow-[0_20px_50px_rgba(132,204,22,0.07)]',
  iconBg: 'bg-lime-100',
  iconColor: 'text-lime-700',
  countBadge: 'bg-lime-100/90 border-lime-200 text-lime-900',
  titleHover: 'group-hover:text-lime-800',
  previewBg: 'bg-white/80 border-lime-200/70',
  bulletColor: 'text-lime-600',
  footerBorder: 'border-lime-200/70',
  footerText: 'text-lime-800 group-hover:text-lime-950',
  borderAccent: 'border-l-lime-600',
  badgeBg: 'bg-lime-100 text-lime-800',
  pillActive: 'bg-lime-700 text-white',
  dotColor: 'bg-lime-600'
};

const THEME_STATES: CategoryCardTheme = {
  accent: '#0D9488',
  cardBg: 'bg-[#F0FDFA]',
  cardBorder: 'border-teal-200/90',
  cardHoverBorder: 'hover:border-teal-400',
  cardShadow: 'shadow-[0_20px_50px_rgba(20,184,166,0.07)]',
  iconBg: 'bg-teal-100',
  iconColor: 'text-teal-700',
  countBadge: 'bg-teal-100/90 border-teal-200 text-teal-900',
  titleHover: 'group-hover:text-teal-800',
  previewBg: 'bg-white/80 border-teal-200/70',
  bulletColor: 'text-teal-600',
  footerBorder: 'border-teal-200/70',
  footerText: 'text-teal-800 group-hover:text-teal-950',
  borderAccent: 'border-l-teal-600',
  badgeBg: 'bg-teal-100 text-teal-800',
  pillActive: 'bg-teal-700 text-white',
  dotColor: 'bg-teal-600'
};

// Distinct pool for dynamic categories
const DYNAMIC_PALETTE_POOL: CategoryCardTheme[] = [
  THEME_NATIONAL,
  THEME_APPOINTMENTS,
  THEME_POLITY,
  THEME_DEFENCE,
  THEME_INTERNATIONAL,
  THEME_WORLD,
  THEME_SPORTS,
  THEME_SCIENCE,
  THEME_ECONOMY,
  THEME_ENVIRONMENT,
  THEME_AWARDS,
  THEME_SCHEMES,
  THEME_SUMMITS,
  THEME_CULTURE,
  THEME_REPORTS,
  THEME_STATES
];

/**
 * Returns distinct individual theme colors for category cards,
 * with deterministic dynamic color assignment for newly added categories.
 */
function getCategoryCardTheme(categoryName: string, index = 0): CategoryCardTheme {
  const lower = (categoryName || '').toLowerCase().trim();

  // 1. Defence & Security
  if (lower.includes('defence') || lower.includes('defense') || lower.includes('military') || lower.includes('army') || lower.includes('navy') || lower.includes('air force')) {
    return THEME_DEFENCE;
  }
  // 2. International Relations & Foreign Affairs (MUST be checked before 'national')
  if (lower.includes('international') || lower.includes('diplomacy') || lower.includes('bilateral') || lower.includes('foreign') || lower.includes('relation')) {
    return THEME_INTERNATIONAL;
  }
  // 3. World & Global News
  if (lower.includes('world') || lower.includes('global') || lower.includes('overseas')) {
    return THEME_WORLD;
  }
  // 4. Appointments & Bureaucracy
  if (lower.includes('appointment') || lower.includes('bureaucracy') || lower.includes('chief') || lower.includes('director')) {
    return THEME_APPOINTMENTS;
  }
  // 5. Polity & Judiciary
  if (lower.includes('polity') || lower.includes('judiciary') || lower.includes('legal') || lower.includes('court') || lower.includes('justice') || lower.includes('constitution')) {
    return THEME_POLITY;
  }
  // 6. Sports
  if (lower.includes('sport') || lower.includes('game') || lower.includes('olympic') || lower.includes('cricket') || lower.includes('medal')) {
    return THEME_SPORTS;
  }
  // 7. Science & Technology
  if (lower.includes('science') || lower.includes('tech') || lower.includes('space') || lower.includes('isro') || lower.includes('drdo') || lower.includes('research')) {
    return THEME_SCIENCE;
  }
  // 8. Economy & Banking
  if (lower.includes('economy') || lower.includes('banking') || lower.includes('finance') || lower.includes('business') || lower.includes('market') || lower.includes('trade')) {
    return THEME_ECONOMY;
  }
  // 9. Environment & Ecology
  if (lower.includes('environment') || lower.includes('ecology') || lower.includes('climate') || lower.includes('wildlife') || lower.includes('forest')) {
    return THEME_ENVIRONMENT;
  }
  // 10. Awards & Honours
  if (lower.includes('award') || lower.includes('honour') || lower.includes('prize') || lower.includes('person')) {
    return THEME_AWARDS;
  }
  // 11. Government Schemes & Policies
  if (lower.includes('scheme') || lower.includes('yojana') || lower.includes('policy') || lower.includes('mission') || lower.includes('initiative')) {
    return THEME_SCHEMES;
  }
  // 12. Summits & Conferences
  if (lower.includes('summit') || lower.includes('conference') || lower.includes('forum') || lower.includes('treaty')) {
    return THEME_SUMMITS;
  }
  // 13. Culture & Heritage
  if (lower.includes('culture') || lower.includes('heritage') || lower.includes('art') || lower.includes('history') || lower.includes('archaeology')) {
    return THEME_CULTURE;
  }
  // 14. Reports & Indices
  if (lower.includes('report') || lower.includes('index') || lower.includes('ranking') || lower.includes('survey')) {
    return THEME_REPORTS;
  }
  // 15. State News
  if (lower.includes('state') || lower.includes('regional')) {
    return THEME_STATES;
  }
  // 16. National Affairs
  if (lower.includes('national') || lower.includes('top affair') || lower.includes('affair') || lower.includes('bharat') || lower.includes('india')) {
    return THEME_NATIONAL;
  }

  // Dynamic deterministic assignment for any custom or newly added category
  let hash = 0;
  for (let i = 0; i < lower.length; i++) {
    hash = (hash << 5) - hash + lower.charCodeAt(i);
    hash |= 0;
  }
  const poolIndex = Math.abs(hash + index) % DYNAMIC_PALETTE_POOL.length;
  return DYNAMIC_PALETTE_POOL[poolIndex];
}

/**
 * Returns theme colors and accents tailored to each category (backward-compatible)
 */
function getCategoryTheme(categoryName: string) {
  return getCategoryCardTheme(categoryName, 0);
}

// Category icon helper matching signature color accents
function getCategoryIcon(categoryName: string, iconColorOverride?: string) {
  const lower = categoryName.toLowerCase();
  const cls = iconColorOverride;
  if (lower.includes('defence') || lower.includes('defense') || lower.includes('military')) {
    return <Shield size={24} className={cls || "text-[#1B4332]"} />;
  }
  // International MUST be checked before national!
  if (lower.includes('international') || lower.includes('diplomacy') || lower.includes('bilateral') || lower.includes('foreign') || lower.includes('relation')) {
    return <Globe size={24} className={cls || "text-indigo-700"} />;
  }
  if (lower.includes('world') || lower.includes('global') || lower.includes('overseas')) {
    return <Compass size={24} className={cls || "text-cyan-700"} />;
  }
  if (lower.includes('appointment')) {
    return <Briefcase size={24} className={cls || "text-blue-700"} />;
  }
  if (lower.includes('polity') || lower.includes('judiciary') || lower.includes('legal') || lower.includes('court')) {
    return <Scale size={24} className={cls || "text-purple-700"} />;
  }
  if (lower.includes('sport')) {
    return <Trophy size={24} className={cls || "text-rose-700"} />;
  }
  if (lower.includes('science') || lower.includes('tech') || lower.includes('space') || lower.includes('isro')) {
    return <Cpu size={24} className={cls || "text-violet-700"} />;
  }
  if (lower.includes('economy') || lower.includes('banking') || lower.includes('finance') || lower.includes('business')) {
    return <TrendingUp size={24} className={cls || "text-orange-700"} />;
  }
  if (lower.includes('award') || lower.includes('honour') || lower.includes('prize')) {
    return <Award size={24} className={cls || "text-pink-700"} />;
  }
  if (lower.includes('national') || lower.includes('top') || lower.includes('affair') || lower.includes('bharat') || lower.includes('india')) {
    return <Landmark size={24} className={cls || "text-amber-700"} />;
  }
  return <BookOpen size={24} className={cls || "text-[#1B4332]"} />;
}

export default function NIntel() {
  const { date: routeDate } = useParams<{ date?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Date & Active Category from URL parameters
  const activeDate = routeDate || searchParams.get('date') || null;
  const activeCategory = searchParams.get('category') || null;

  // Level 1: Editions list
  const [editions, setEditions] = useState<EditionSummary[]>([]);
  const [loadingEditions, setLoadingEditions] = useState(true);
  const [editionSearch, setEditionSearch] = useState('');

  // Level 2 & 3: Stories for activeDate
  const [stories, setStories] = useState<NIntelStory[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const [storySearchQuery, setStorySearchQuery] = useState('');

  // Aspirant Reading Progress & Copy States
  const [copiedStoryId, setCopiedStoryId] = useState<string | null>(null);
  const [storyToDelete, setStoryToDelete] = useState<NIntelStory | null>(null);
  const [isDeletingStory, setIsDeletingStory] = useState(false);

  const handleAdminDeleteFromFeed = async () => {
    if (!storyToDelete) return;
    setIsDeletingStory(true);
    try {
      let token = null;
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/n-intel/stories/${encodeURIComponent(storyToDelete.id)}`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete story');
      }

      setStories(prev => prev.filter(s => s.id !== storyToDelete.id));
      setStoryToDelete(null);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setIsDeletingStory(false);
    }
  };

  const handleCopyStory = (storyId: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedStoryId(storyId);
      setTimeout(() => setCopiedStoryId(null), 2000);
    });
  };

  // Auth state
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const isAdm = checkIfAdmin(currentUser);
      setIsAdmin(isAdm);
      if (isAdm && currentUser) {
        currentUser.getIdToken().then(token => {
          if (token) syncLocalWithServer(token).catch(() => {});
        }).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch all editions with client-side multi-layer persistence
  useEffect(() => {
    setLoadingEditions(true);
    fetch('/api/n-intel/editions')
      .then(res => res.json())
      .then(data => {
        const serverEditions = (data.success && Array.isArray(data.editions)) ? data.editions : [];
        const merged = mergeEditionsWithLocal(serverEditions);
        setEditions(merged);
      })
      .catch(err => {
        console.error('Error fetching editions:', err);
        const fallback = mergeEditionsWithLocal([]);
        if (fallback.length > 0) setEditions(fallback);
      })
      .finally(() => setLoadingEditions(false));
  }, []);

  // When activeDate changes, fetch stories for that date with local cache fallback
  useEffect(() => {
    if (!activeDate) {
      setStories([]);
      return;
    }

    setLoadingStories(true);
    setStorySearchQuery('');

    fetch(`/api/n-intel/stories?date=${encodeURIComponent(activeDate)}`)
      .then(res => res.json())
      .then(data => {
        const serverStories = (data.success && Array.isArray(data.stories)) ? data.stories : [];
        const merged = mergeStoriesWithLocal(serverStories, activeDate);
        setStories(merged);
      })
      .catch(err => {
        console.error('Error fetching stories for date:', err);
        const fallback = mergeStoriesWithLocal([], activeDate);
        setStories(fallback);
      })
      .finally(() => setLoadingStories(false));
  }, [activeDate]);

  // Group active day's stories by category
  const categoriesMap = useMemo(() => {
    const map: Record<string, NIntelStory[]> = {};
    for (const story of stories) {
      const cat = story.category || 'General';
      if (!map[cat]) {
        map[cat] = [];
      }
      map[cat].push(story);
    }
    return map;
  }, [stories]);

  const categoryList = useMemo(() => {
    return Object.keys(categoriesMap);
  }, [categoriesMap]);

  // Filtered stories for Level 3 (Inside a Category)
  const categoryStories = useMemo(() => {
    if (!activeCategory) return [];
    const list = categoriesMap[activeCategory] || [];
    let result = list;
    if (storySearchQuery.trim()) {
      const q = storySearchQuery.toLowerCase().trim();
      result = list.filter(s =>
        s.headline.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q) ||
        (s.sourceName && s.sourceName.toLowerCase().includes(q))
      );
    }
    // Guarantee latest newly uploaded news at top
    return [...result].sort((a, b) => {
      const timeA = a.createdAt || '';
      const timeB = b.createdAt || '';
      if (timeA && timeB && timeA !== timeB) return timeB.localeCompare(timeA);
      return (b.itemNumber || 0) - (a.itemNumber || 0);
    });
  }, [categoriesMap, activeCategory, storySearchQuery]);

  // Filtered editions for Level 1 (All Dates)
  const filteredEditions = useMemo(() => {
    let list = editions;
    if (editionSearch.trim()) {
      const q = editionSearch.toLowerCase().trim();
      list = editions.filter(ed =>
        ed.date.includes(q) ||
        formatDisplayDate(ed.date).toLowerCase().includes(q) ||
        ed.categories.some(c => c.toLowerCase().includes(q)) ||
        (ed.highlights && ed.highlights.some(h => h.toLowerCase().includes(q)))
      );
    }
    // Guarantee latest newly uploaded edition at the top
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [editions, editionSearch]);

  // Navigation handlers
  const handleOpenDate = (date: string) => {
    setSearchParams({ date });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCategory = (cat: string) => {
    if (!activeDate) return;
    setSearchParams({ date: activeDate, category: cat });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCategoryDirect = (date: string, cat: string) => {
    setSearchParams({ date, category: cat });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToCategories = () => {
    if (!activeDate) return;
    setSearchParams({ date: activeDate });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToAllDates = () => {
    setSearchParams({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ─────────────────────────────────────────────────────────────
     LEVEL 3: INSIDE A SPECIFIC CATEGORY OF NEWS
     Transformed: High-retention Intelligence Briefing Cards.
     2-column responsive layout, bite-sized points, fast revision tracking.
     NO WhatsApp button here!
     ───────────────────────────────────────────────────────────── */
  if (activeDate && activeCategory) {
    const formattedDate = formatDisplayDate(activeDate);
    const categoryTheme = getCategoryTheme(activeCategory);

    return (
      <div className="min-h-screen bg-[#F8F9FA] pt-28 md:pt-32 pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Back Navigation Button styled identically to Notes detail view */}
          <button
            onClick={handleBackToCategories}
            className="flex items-center gap-2 text-gray-500 hover:text-[#1A1A1A] mb-6 transition-colors group"
          >
            <div className="w-9 h-9 md:w-10 md:h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
              <ChevronLeft size={18} />
            </div>
            <span className="font-bold text-xs tracking-widest uppercase">
              Back to {formattedDate} Categories
            </span>
          </button>

          {/* Category Header Card — Immersive, Editorial & Themed */}
          <div className={`${categoryTheme.cardBg} rounded-[2.5rem] p-7 md:p-10 border ${categoryTheme.cardBorder} ${categoryTheme.cardShadow} mb-8 relative overflow-hidden transition-all`}>
            {/* Ambient Background Aura */}
            <div
              className="absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-15 blur-3xl pointer-events-none"
              style={{ backgroundColor: categoryTheme.accent }}
            />

            {/* Top Row: Category Identity & Quick Status */}
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-black/5">
              <div className="flex items-center gap-4 md:gap-6">
                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-[1.75rem] flex items-center justify-center shrink-0 ${categoryTheme.iconBg} border ${categoryTheme.cardBorder} shadow-sm group-hover:scale-105 transition-transform`}>
                  {getCategoryIcon(activeCategory, categoryTheme.iconColor)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-white/80 border border-black/5 text-gray-700">
                      {formattedDate} BRIEFING
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${categoryTheme.countBadge}`}>
                      {categoryStories.length} Updates
                    </span>
                  </div>
                  <h1 className="text-3xl md:text-5xl font-black text-[#1A1A1A] tracking-tight">
                    {activeCategory}
                  </h1>
                </div>
              </div>
            </div>

            {/* Middle Toolbar: Search & Exam Subtitle */}
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5 pb-5">
              <span className="text-xs font-bold text-gray-600 flex items-center gap-2">
                <Sparkles size={14} className={categoryTheme.iconColor} />
                <span>Verified Direct Fact Sheet for CDS, NDA, AFCAT & CAPF Aspirants</span>
              </span>

              {/* Quick Search within Category */}
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder={`Search in ${activeCategory}...`}
                  value={storySearchQuery}
                  onChange={(e) => setStorySearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-white/95 border border-black/10 rounded-xl focus:border-black/30 focus:bg-white focus:ring-0 transition-all outline-none text-xs font-bold text-gray-800 placeholder:text-gray-400 shadow-xs"
                />
                {storySearchQuery && (
                  <button
                    onClick={() => setStorySearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Row: Quick Horizontal Switcher for other sections */}
            {categoryList.length > 1 && (
              <div className="relative z-10 flex items-center gap-2 overflow-x-auto no-scrollbar pt-4 border-t border-black/5">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap mr-1">
                  Switch Section:
                </span>
                {categoryList.map(cat => {
                  const isCurrent = cat === activeCategory;
                  const count = (categoriesMap[cat] || []).length;
                  const catTheme = getCategoryCardTheme(cat);

                  return (
                    <button
                      key={cat}
                      onClick={() => handleOpenCategory(cat)}
                      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
                        isCurrent
                          ? `${catTheme.pillActive} shadow-md scale-105`
                          : 'bg-white/80 hover:bg-white text-gray-700 border border-black/5 hover:border-black/10'
                      }`}
                    >
                      <span>{cat}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        isCurrent ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stories Grid for this Category */}
          {loadingStories ? (
            <div className="py-24 text-center text-gray-400 font-bold text-sm animate-pulse bg-white rounded-[2rem] border border-gray-100">
              Loading news updates...
            </div>
          ) : categoryStories.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[2rem] border border-gray-100 shadow-sm">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
                <Newspaper size={32} />
              </div>
              <h3 className="text-xl font-black text-[#1A1A1A] mb-2 tracking-tight">No updates found</h3>
              <p className="text-gray-500 text-sm font-medium">
                {storySearchQuery ? 'No stories match your filter query.' : `No stories available in ${activeCategory}.`}
              </p>
              {storySearchQuery && (
                <button
                  onClick={() => setStorySearchQuery('')}
                  className="mt-4 px-4 py-2 bg-[#1B4332] text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-[#143024] transition-all"
                >
                  Clear Filter
                </button>
              )}
            </div>
          ) : (
            /* 2-Column Responsive Grid on Desktop / Single Column on Mobile */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {categoryStories.map((story, idx) => {
                const breakdown = formatStoryBreakdown(story.content, story.tags, story.headline);
                const isCopied = copiedStoryId === story.id;

                return (
                  <motion.article
                    key={story.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.25) }}
                    className="bg-white rounded-[2rem] p-7 md:p-8 border border-gray-200/80 shadow-[0_10px_35px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all flex flex-col justify-between group relative overflow-hidden"
                  >
                    {/* Top Color Accent Strip */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1.5 transition-all group-hover:h-2"
                      style={{ backgroundColor: categoryTheme.accent }}
                    />

                    <div>
                      {/* Card Header Bar */}
                      <div className="flex items-center justify-between gap-3 mb-5 pb-3.5 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg font-mono font-black text-xs tracking-wider ${categoryTheme.badgeBg} border ${categoryTheme.cardBorder}`}>
                            #{String(story.itemNumber || idx + 1).padStart(2, '0')}
                          </span>
                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                            <Clock size={11} className="text-gray-400" />
                            {breakdown.readingTime}
                          </span>
                        </div>

                        {/* Top Action Buttons: Copy Note & Admin Controls */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCopyStory(story.id, story.content)}
                            title="Copy exam brief to clipboard"
                            className={`p-2 rounded-xl transition-all ${
                              isCopied
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {isCopied ? (
                              <Check size={14} className="text-emerald-600" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>

                          {isAdmin && (
                            <>
                              <Link
                                to={`/n-intel/admin?edit=${encodeURIComponent(story.id)}`}
                                title="Admin: Edit this story"
                                className="p-2 rounded-xl text-gray-400 hover:text-[#1B4332] hover:bg-emerald-50 transition-colors"
                              >
                                <Edit3 size={14} />
                              </Link>
                              <button
                                onClick={() => setStoryToDelete(story)}
                                title="Admin: Remove from feed"
                                className="p-2 rounded-xl text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Story Presentation: Structured High-Retention Points */}
                      <div className="space-y-4">
                        {/* Core Lead Hook */}
                        <h3 className="text-[#1A1A1A] font-black text-lg md:text-[19px] leading-snug tracking-tight group-hover:text-black transition-colors">
                          {breakdown.lead}
                        </h3>

                        {/* Bulleted Key Takeaways Box */}
                        {breakdown.points.length > 0 && (
                          <div className="bg-gray-50/80 border border-gray-100/90 rounded-2xl p-4 md:p-5 space-y-2.5">
                            <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1.5">
                              <Sparkles size={11} className={categoryTheme.iconColor} />
                              <span>Core Exam Takeaways:</span>
                            </div>
                            {breakdown.points.map((pt, pIdx) => (
                              <div
                                key={pIdx}
                                className="flex items-start gap-2.5 text-sm md:text-[14.5px] font-medium text-gray-700 leading-relaxed"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${categoryTheme.dotColor}`} />
                                <span>{pt}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Tags & Source */}
                    <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                      {/* Extracted Exam Entity Chips */}
                      {breakdown.tags.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {breakdown.tags.map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-2.5 py-1 rounded-lg bg-gray-50 text-gray-600 border border-gray-100 text-[11px] font-bold"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : <div />}

                      {/* Source Link */}
                      {story.sourceUrl && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                          <span className="font-bold text-gray-400 text-[11px] uppercase tracking-wider">Source:</span>
                          <a
                            href={story.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#1B4332] hover:underline font-black bg-[#1B4332]/5 px-2.5 py-1 rounded-lg border border-[#1B4332]/10 transition-colors"
                          >
                            <span>{story.sourceName || 'Official'}</span>
                            <ExternalLink size={11} />
                          </a>
                        </div>
                      )}
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}

          {/* Admin Story Delete Confirmation Modal */}
          {storyToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 text-center">
                <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={28} />
                </div>
                <h3 className="text-lg font-black text-gray-900 mb-2">Delete Story from Feed?</h3>
                <p className="text-xs text-gray-500 mb-4 font-medium leading-relaxed">
                  As an administrator, deleting this story will immediately remove it from the public daily edition and search results.
                </p>
                <div className="p-3 bg-gray-50 rounded-xl text-left border border-gray-100 mb-6">
                  <p className="text-xs font-bold text-gray-800 line-clamp-2">
                    {storyToDelete.headline}
                  </p>
                  <span className="text-[10px] text-gray-500 font-semibold mt-1 block">
                    Category: {storyToDelete.category}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStoryToDelete(null)}
                    disabled={isDeletingStory}
                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAdminDeleteFromFeed}
                    disabled={isDeletingStory}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black tracking-widest uppercase rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-95"
                  >
                    {isDeletingStory ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     LEVEL 2: INSIDE A DAY'S CARD — ONE CARD PER CATEGORY
     Consistent with Notes Subjects Grid.
     NO WhatsApp button here!
     ───────────────────────────────────────────────────────────── */
  if (activeDate) {
    const formattedDate = formatDisplayDate(activeDate);
    const isToday = activeDate === getLocalTodayDate();

    return (
      <div className="min-h-screen bg-[#F8F9FA] pt-32 pb-24">
        <div className="max-w-6xl mx-auto px-4">
          {/* Back Navigation Button */}
          <button
            onClick={handleBackToAllDates}
            className="flex items-center gap-2 text-gray-500 hover:text-[#1A1A1A] mb-8 transition-colors group"
          >
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
              <ChevronLeft size={20} />
            </div>
            <span className="font-bold text-xs tracking-widest uppercase">Back to All Daily Editions</span>
          </button>

          {/* Date Summary Card */}
          <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.03)] border border-gray-100 mb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-100 pb-8 mb-4">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="inline-flex items-center justify-center px-3.5 h-6 bg-[#1B4332]/5 text-[#1B4332] text-[10px] font-black tracking-[0.2em] uppercase rounded-full border border-[#1B4332]/15 leading-none">
                    {activeDate}
                  </span>
                  {isToday && (
                    <span className="inline-flex items-center justify-center px-3.5 h-6 bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-[0.2em] uppercase rounded-full border border-emerald-200 leading-none">
                      Today's Edition
                    </span>
                  )}
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-[#1A1A1A] tracking-tighter mb-2">
                  {formattedDate} Briefing
                </h1>
                <p className="text-gray-500 font-medium text-base md:text-lg">
                  Select any category below to view all verified news updates for this day.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-black text-[#1A1A1A]">
                  {stories.length} Total Updates
                </span>
                <span className="px-4 py-2 bg-[#1B4332]/5 text-[#1B4332] border border-[#1B4332]/10 rounded-2xl text-xs font-black">
                  {categoryList.length} Categories
                </span>
              </div>
            </div>
          </div>

          {/* ── ONE CARD FOR EACH CATEGORY ── */}
          {loadingStories ? (
            <div className="py-24 text-center text-gray-400 font-bold text-sm animate-pulse bg-white rounded-[2rem] border border-gray-100">
              Loading categories...
            </div>
          ) : categoryList.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[2rem] border border-gray-100 shadow-sm">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
                <Newspaper size={32} />
              </div>
              <h3 className="text-xl font-black text-[#1A1A1A] mb-2 tracking-tight">No categories found</h3>
              <p className="text-gray-500 text-sm font-medium">No published stories found for this date.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {(() => {
                const usedColors = new Set<string>();
                return categoryList.map((categoryName, idx) => {
                  const catStories = categoriesMap[categoryName] || [];
                  const previewHeadlines = catStories.slice(0, 2);
                  let theme = getCategoryCardTheme(categoryName, idx);

                  // Guarantee no two cards on screen ever share the same background color
                  if (usedColors.has(theme.cardBg)) {
                    for (let i = 0; i < DYNAMIC_PALETTE_POOL.length; i++) {
                      const candidate = DYNAMIC_PALETTE_POOL[(idx + i) % DYNAMIC_PALETTE_POOL.length];
                      if (!usedColors.has(candidate.cardBg)) {
                        theme = candidate;
                        break;
                      }
                    }
                  }
                  usedColors.add(theme.cardBg);

                  return (
                    <motion.div
                      key={categoryName}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleOpenCategory(categoryName)}
                      className={`${theme.cardBg} p-8 md:p-10 rounded-[2rem] border ${theme.cardBorder} ${theme.cardHoverBorder} ${theme.cardShadow} hover:shadow-xl transition-all cursor-pointer group hover:-translate-y-1 flex flex-col justify-between`}
                    >
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-6">
                        <div className={`w-14 h-14 ${theme.iconBg} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                          {getCategoryIcon(categoryName, theme.iconColor)}
                        </div>
                        <span className={`px-3.5 py-1.5 ${theme.countBadge} rounded-xl text-xs font-black border`}>
                          {catStories.length} Updates
                        </span>
                      </div>

                      <h2 className={`text-2xl font-black text-[#1A1A1A] tracking-tight mb-3 ${theme.titleHover} transition-colors`}>
                        {categoryName}
                      </h2>

                      {previewHeadlines.length > 0 && (
                        <div className={`space-y-2 mb-6 ${theme.previewBg} p-4 rounded-2xl border`}>
                          {previewHeadlines.map((st, sIdx) => (
                            <div key={sIdx} className="flex items-start gap-2 text-xs font-bold text-gray-700 leading-snug">
                              <span className={`${theme.bulletColor} font-black mt-0.5`}>•</span>
                              <span className="line-clamp-2">{st.content}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className={`pt-4 border-t ${theme.footerBorder} flex items-center justify-between text-xs font-black uppercase tracking-wider ${theme.footerText}`}>
                      <span>Open Category News</span>
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </motion.div>
                );
              });
            })()}
          </div>
          )}
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     LEVEL 1: MAIN FEED — SINGLE DATE CARDS
     HERO SECTION EXACTLY IDENTICAL TO NOTES, GALLERY, ABOUT, CONTACT.
     Share on WhatsApp ONLY on this single date card!
     ───────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Hero Section — EXACTLY identical to Notes, Gallery, About, Contact */}
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
            DAILY CURRENT AFFAIRS
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-[8rem] lg:text-[10rem] font-display text-white mb-8 tracking-tighter text-glow-white leading-none px-2"
          >
            N-INTEL
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/60 max-w-2xl mx-auto text-lg md:text-2xl font-medium leading-relaxed tracking-tight mb-8"
          >
            Curated daily defence, national, legal and geopolitical intelligence briefings.
          </motion.p>

          {/* Admin Action Links — Visible ONLY to Admins */}
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap items-center justify-center gap-4"
            >
              <Link
                to="/n-intel/admin"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1B4332] text-white text-xs font-black tracking-widest uppercase hover:bg-[#2D6A4F] transition-all shadow-lg shadow-[#1B4332]/30"
              >
                <Lock size={12} />
                <span>Admin Console</span>
              </Link>
            </motion.div>
          )}
        </div>
      </section>

      {/* Main Content Area */}
      <section className="py-24 px-4 max-w-7xl mx-auto relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent"></div>

        {/* Search Bar — Styled exactly like Notes search bar */}
        <div className="max-w-2xl mx-auto mb-16">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1B4332] transition-colors" size={24} />
            <input
              type="text"
              placeholder="Search daily editions or keywords..."
              value={editionSearch}
              onChange={(e) => setEditionSearch(e.target.value)}
              className="w-full pl-16 pr-6 py-6 bg-white border border-gray-100 rounded-[2rem] focus:border-[#1B4332] focus:ring-0 transition-all outline-none text-gray-700 font-bold text-lg shadow-[0_20px_50px_rgba(0,0,0,0.03)] placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* ── SINGLE DATE CARDS ── */}
        {loadingEditions ? (
          <div className="py-24 text-center text-gray-400 font-bold text-sm animate-pulse bg-white rounded-[2rem] border border-gray-100">
            Loading daily editions...
          </div>
        ) : filteredEditions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-gray-100 shadow-sm max-w-xl mx-auto">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Calendar size={32} />
            </div>
            <h3 className="text-xl font-black text-[#1A1A1A] mb-2 tracking-tight">No editions found</h3>
            <p className="text-gray-500 text-sm font-medium mb-6">No daily editions match your search query.</p>
            <button
              onClick={() => setEditionSearch('')}
              className="px-6 py-3 bg-[#1B4332] text-white text-xs font-black tracking-widest uppercase rounded-xl hover:bg-[#143024] transition-all"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredEditions.map((edition, idx) => {
              const displayDate = formatDisplayDate(edition.date);
              const isToday = edition.date === getLocalTodayDate();
              const isLatest = idx === 0;

              return (
                <motion.div
                  key={edition.date}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-8 md:p-12 rounded-[2.5rem] transition-all group relative overflow-hidden ${
                    isLatest
                      ? 'bg-gradient-to-br from-white via-white to-[#F0FDF4] border-2 border-emerald-200/90 shadow-[0_25px_65px_rgba(27,67,50,0.08)] hover:shadow-[0_30px_75px_rgba(27,67,50,0.12)]'
                      : 'bg-white border border-gray-200/80 shadow-[0_15px_45px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_60px_rgba(0,0,0,0.07)] hover:-translate-y-1'
                  }`}
                >
                  {/* Top Ambient Glow & Accent Bar */}
                  {isLatest ? (
                    <>
                      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#1B4332]/8 blur-3xl pointer-events-none" />
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1B4332] via-[#2D6A4F] to-[#D4AF37]" />
                    </>
                  ) : (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 group-hover:bg-[#1B4332] transition-colors" />
                  )}

                  {/* Top Metadata Row */}
                  <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="inline-flex items-center gap-1.5 px-3.5 h-7 bg-white text-[#1B4332] text-xs font-black tracking-wider uppercase rounded-xl border border-gray-200/80 shadow-xs">
                        <Calendar size={13} className="text-[#1B4332]" />
                        <span>{edition.date}</span>
                      </span>
                      {isToday && (
                        <span className="inline-flex items-center gap-1.5 px-3.5 h-7 bg-emerald-600 text-white text-[11px] font-black tracking-widest uppercase rounded-xl shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          <span>Today's Edition</span>
                        </span>
                      )}
                      {isLatest && !isToday && (
                        <span className="inline-flex items-center gap-1.5 px-3.5 h-7 bg-[#D4AF37] text-white text-[11px] font-black tracking-widest uppercase rounded-xl shadow-xs">
                          <Sparkles size={12} className="text-white" />
                          <span>Latest Edition</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-gray-200/80 rounded-xl text-xs font-black text-gray-800 shadow-xs">
                        <BookOpen size={13} className="text-gray-400" />
                        <span>{edition.storyCount} Updates</span>
                      </span>
                      {edition.defenceCount && edition.defenceCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1B4332] text-white rounded-xl text-xs font-black shadow-xs">
                          <Shield size={13} className="text-white" />
                          <span>{edition.defenceCount} Defence</span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Day Headline */}
                  <div className="relative z-10 mb-6">
                    <h2
                      onClick={() => handleOpenDate(edition.date)}
                      className="text-3xl md:text-5xl font-black text-[#1A1A1A] tracking-tight cursor-pointer group-hover:text-[#1B4332] transition-colors flex items-center gap-3"
                    >
                      <span>{displayDate} Briefing</span>
                      <ArrowRight size={28} className="text-gray-300 group-hover:text-[#1B4332] group-hover:translate-x-2 transition-all shrink-0" />
                    </h2>
                    <p className="text-xs md:text-sm font-semibold text-gray-400 mt-1.5">
                      Curated daily intelligence dossier covering verified events across {edition.categories.length} strategic categories.
                    </p>
                  </div>

                  {/* Highlights Preview Box */}
                  {edition.highlights && edition.highlights.length > 0 && (
                    <div className="relative z-10 mb-7 bg-white/80 backdrop-blur-sm p-6 md:p-7 rounded-[1.75rem] border border-gray-200/70 shadow-xs">
                      <div className="text-[11px] font-black tracking-[0.2em] uppercase text-[#1B4332] mb-3.5 flex items-center gap-2">
                        <Sparkles size={13} className="text-[#D4AF37]" />
                        <span>Key Takeaways & Headlines:</span>
                      </div>
                      <div className="space-y-3">
                        {edition.highlights.slice(0, 3).map((hl, hIdx) => (
                          <div key={hIdx} className="flex items-start gap-3 text-sm md:text-base font-bold text-[#1A1A1A] leading-relaxed">
                            <span className="w-2 h-2 rounded-full bg-[#1B4332] shrink-0 mt-2" />
                            <span className="line-clamp-2">{hl}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Categories Pills — Color-coded by individual category theme */}
                  <div className="relative z-10 mb-8">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                      Available Sections ({edition.categories.length}):
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {edition.categories.map(cat => {
                        const catTheme = getCategoryCardTheme(cat);
                        return (
                          <button
                            key={cat}
                            onClick={() => handleOpenCategoryDirect(edition.date, cat)}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${catTheme.cardBg} border ${catTheme.cardBorder} hover:scale-105 hover:shadow-xs ${catTheme.footerText} cursor-pointer`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${catTheme.dotColor}`} />
                            <span>{cat}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="relative z-10 pt-6 border-t border-gray-150 flex flex-wrap items-center justify-between gap-4">
                    {/* Primary Open Day Button */}
                    <button
                      onClick={() => handleOpenDate(edition.date)}
                      className="flex items-center gap-3 px-8 py-4 bg-[#1B4332] hover:bg-[#143024] text-white rounded-2xl font-black text-sm tracking-wide uppercase transition-all shadow-lg shadow-[#1B4332]/25 hover:shadow-xl hover:shadow-[#1B4332]/35 hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      <span>Explore Categories ({edition.categories.length})</span>
                      <ArrowRight size={18} />
                    </button>

                    {/* WhatsApp Share Button — ONLY on single date card! */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = getDailyEditionWhatsAppShareUrl(edition.date, edition.storyCount);
                        openWhatsAppShare(url);
                      }}
                      className="flex items-center gap-2.5 px-7 py-4 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-2xl font-black text-sm tracking-wide uppercase transition-all shadow-lg shadow-[#25D366]/25 hover:shadow-xl hover:shadow-[#25D366]/35 active:scale-95 cursor-pointer"
                    >
                      <MessageCircle size={20} />
                      <span>Share on WhatsApp</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
