/**
 * Articles use Firestore on Vercel and local JSON files for development.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { readContentCollection, writeContentCollection } from './firestore-content';

export interface Article {
  id: string;
  slug: string;
  title: string;
  bannerImageUrl: string;
  category: string;
  authorName: string;
  authorRole: string;
  authorAvatarUrl?: string;
  publishDate: string;
  readingTime: string;
  pullQuote?: string;
  content: string;
  tags: string[];
  sourceReference?: string;
  viewsCount?: number;
  pdfDownloadCount?: number;
  createdAt: string;
  updatedAt?: string;
  authorEmail?: string;
}

const IS_VERCEL = Boolean(process.env.VERCEL);
const USE_FIRESTORE = process.env.USE_FIRESTORE_CONTENT !== 'false';
const DATA_DIR = IS_VERCEL ? path.join(os.tmpdir(), 'nishchay_data') : path.join(process.cwd(), 'data');
const SEED_DATA_DIR = path.join(process.cwd(), 'data');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');
const SEED_ARTICLES_FILE = path.join(SEED_DATA_DIR, 'articles.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not ensure data directory:', err);
  }
}

let articlesCache: Article[] | null = null;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function calculateReadingTime(text: string): string {
  const words = (text || '').trim().split(/\s+/).length;
  const minutes = Math.max(2, Math.ceil(words / 180));
  return `${minutes} min read`;
}

async function loadArticles(): Promise<Article[]> {
  if (USE_FIRESTORE) return readContentCollection<Article>('articles');
  if (articlesCache) return articlesCache;
  ensureDataDir();

  let targetFile = ARTICLES_FILE;
  if (!fs.existsSync(targetFile) && fs.existsSync(SEED_ARTICLES_FILE)) {
    targetFile = SEED_ARTICLES_FILE;
  }

  if (!fs.existsSync(targetFile)) {
    // Seed initial dataset with the sample editorial
    const initialArticles: Article[] = [
      {
        id: 'article-tied-by-geography-divided-by-politics',
        slug: 'tied-by-geography-divided-by-politics',
        title: 'Tied by geography, divided by politics',
        bannerImageUrl: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80',
        category: 'International Relations',
        authorName: 'Mohammed Ayoob',
        authorRole: 'University Distinguished Professor Emeritus of International Relations, Michigan State University, and author of "The Liberation War" (1972)',
        authorAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        publishDate: '2026-10-30',
        readingTime: '7 min read',
        pullQuote: 'India and Bangladesh must overcome mistrust and pursue pragmatic neighbourhood cooperation.',
        tags: ['International Relations', 'India-Bangladesh', 'Foreign Policy', '1971 Liberation War', 'Defence Studies'],
        sourceReference: 'Strategic Analysis & Editorial Study',
        viewsCount: 142,
        pdfDownloadCount: 29,
        createdAt: new Date().toISOString(),
        content: `With speculation rife that Bangladesh's recently elected Prime Minister Tarique Rahman (and also Bangladesh Nationalist Party [BNP] Chairman) will be visiting New Delhi in November or December, it is time to assess the state of India-Bangladesh relations and analyse the roots of the problems between the two countries.

The seeds of their current tension lie in the ==liberation war of 1971== itself. From the very beginning, the attitude of Bangladesh's elites toward India has wavered between gratitude and resentment — gratitude for India's crucial role in the liberation of their country and resentment against the fact that India had to play the role of liberator — a role they should have performed themselves.

### An ambivalence
Nations cherish narratives in which they are the principal authors of their own liberation. Bangladesh is no exception. The contribution of the Mukti Bahini notwithstanding, the decisive military blow against Pakistan was delivered by India. What was initially the source of immense gratitude with the passage of time became a source of grave discomfort.

Moreover, from the very beginning Dhaka was worried that India's policy towards Bangladesh would be mediated through a Hindu-majority West Bengal next door which has strong cultural and linguistic affinities with Bangladesh that could threaten the development of Bangladesh's independent identity. ^^The open borders in the immediate aftermath of the liberation war also revived memories of the socio-economic dominance of the Hindu bhadralok in pre-Partition Bengal.^^

This was compounded by the fact that ==Bangladesh was virtually surrounded by India, sharing a border of more than 4,000 kilometres.== Its principal rivers flowed through or originated in India. Its economic and strategic room for manoeuvre appeared constrained by geography. Consequently, the fear of Indian hegemony was and is deeply ingrained in the psyche of Bangladesh's ruling circles.

### A regime and identity
During the Sheikh Hasina years (2009–24), relations between the two governments appeared relatively smooth, driven by shared opposition to religious extremism and mutual counterterrorism cooperation. However, popular sentiment in Bangladesh often viewed this closeness as Indian backing for an authoritarian regime that suppressed political opposition.

With the downfall of the Awami League government, anti-India sentiment in Bangladesh has surfaced with renewed intensity. The interim leadership and emerging political configurations, particularly elements of the BNP and Jamaat-e-Islami, reflect a renewed desire to diversify foreign relations — reaching out more explicitly to Beijing and Washington.

### The strategic imperative
Despite political shifts, geography remains immutable. India and Bangladesh share critical shared-river basins, energy grids, and cross-border trade corridors essential for the economic vitality of both northeastern India and Bangladesh itself. Pragmatic diplomacy requires moving beyond historical grievances to build institutional mechanisms that outlive changing political regimes.`
      }
    ];

    await saveArticles(initialArticles);
    return initialArticles;
  }

  try {
    const raw = fs.readFileSync(targetFile, 'utf-8');
    const parsed = JSON.parse(raw);
    articlesCache = Array.isArray(parsed) ? parsed : [];
    return articlesCache;
  } catch (err) {
    console.error('Error reading articles file:', err);
    return [];
  }
}

async function saveArticles(articles: Article[], deletedIds: string[] = []): Promise<void> {
  if (USE_FIRESTORE) {
    await writeContentCollection('articles', articles, deletedIds);
    articlesCache = null;
    return;
  }
  articlesCache = articles;
  ensureDataDir();
  const tempPath = `${ARTICLES_FILE}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(articles, null, 2), 'utf-8');
    fs.renameSync(tempPath, ARTICLES_FILE);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    console.warn('Could not persist articles to disk:', err);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getAllArticles(): Promise<Article[]> {
  const articles = await loadArticles();
  return [...articles].sort(
    (a, b) => new Date(b.publishDate || b.createdAt).getTime() - new Date(a.publishDate || a.createdAt).getTime()
  );
}

export async function getArticleById(idOrSlug: string): Promise<Article | null> {
  if (!idOrSlug) return null;
  const articles = await loadArticles();
  const query = String(idOrSlug).trim().toLowerCase();
  return (
    articles.find(
      a =>
        a.id === idOrSlug ||
        a.slug === idOrSlug ||
        a.id.toLowerCase() === query ||
        (a.slug && a.slug.toLowerCase() === query)
    ) || null
  );
}

export async function createArticle(data: {
  title: string;
  bannerImageUrl: string;
  category: string;
  authorName: string;
  authorRole: string;
  authorAvatarUrl?: string;
  publishDate?: string;
  pullQuote?: string;
  content: string;
  tags?: string[];
  sourceReference?: string;
  authorEmail?: string;
}): Promise<Article> {
  const articles = await loadArticles();
  const slug = slugify(data.title) + '-' + Date.now().toString().slice(-4);
  const id = `article-${slug}`;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const publishDate = data.publishDate?.trim() || todayStr;
  const readingTime = calculateReadingTime(data.content);

  const newArticle: Article = {
    id,
    slug,
    title: data.title.trim(),
    bannerImageUrl: data.bannerImageUrl.trim(),
    category: data.category?.trim() || 'General',
    authorName: data.authorName.trim(),
    authorRole: data.authorRole?.trim() || 'Editorial Contributor',
    authorAvatarUrl: data.authorAvatarUrl?.trim() || undefined,
    publishDate,
    readingTime,
    pullQuote: data.pullQuote?.trim() || undefined,
    content: data.content.trim(),
    tags: Array.isArray(data.tags)
      ? data.tags
      : (typeof data.tags === 'string'
        ? (data.tags as string).split(',').map(t => t.trim()).filter(Boolean)
        : []),
    sourceReference: data.sourceReference?.trim() || undefined,
    viewsCount: 1,
    pdfDownloadCount: 0,
    createdAt: new Date().toISOString(),
    authorEmail: data.authorEmail
  };

  articles.unshift(newArticle);
  await saveArticles(articles);
  return newArticle;
}

export async function updateArticle(id: string, updates: Partial<Article>): Promise<Article | null> {
  const articles = await loadArticles();
  const index = articles.findIndex(a => a.id === id);
  if (index === -1) return null;

  const current = articles[index];

  const updated: Article = {
    ...current,
    title: typeof updates.title === 'string' ? updates.title.trim() : current.title,
    bannerImageUrl: typeof updates.bannerImageUrl === 'string' ? updates.bannerImageUrl.trim() : current.bannerImageUrl,
    category: typeof updates.category === 'string' ? updates.category.trim() : current.category,
    authorName: typeof updates.authorName === 'string' ? updates.authorName.trim() : current.authorName,
    authorRole: typeof updates.authorRole === 'string' ? updates.authorRole.trim() : current.authorRole,
    authorAvatarUrl: updates.authorAvatarUrl !== undefined ? updates.authorAvatarUrl : current.authorAvatarUrl,
    publishDate: typeof updates.publishDate === 'string' ? updates.publishDate.trim() : current.publishDate,
    pullQuote: updates.pullQuote !== undefined ? updates.pullQuote : current.pullQuote,
    content: typeof updates.content === 'string' ? updates.content.trim() : current.content,
    tags: Array.isArray(updates.tags) ? updates.tags : current.tags,
    sourceReference: updates.sourceReference !== undefined ? updates.sourceReference : current.sourceReference,
    updatedAt: new Date().toISOString()
  };

  if (updates.content && typeof updates.content === 'string') {
    updated.readingTime = calculateReadingTime(updates.content);
  }

  articles[index] = updated;
  await saveArticles(articles);
  return updated;
}

export async function deleteArticle(id: string): Promise<boolean> {
  const articles = await loadArticles();
  const index = articles.findIndex(a => a.id === id);
  if (index === -1) return false;
  const articleToDelete = articles[index];

  if (!USE_FIRESTORE && articleToDelete.bannerImageUrl && articleToDelete.bannerImageUrl.startsWith('/uploads/')) {
    const filename = path.basename(articleToDelete.bannerImageUrl);
    if (/^banner-\d+-[a-f0-9]+\.(png|jpg|webp)$/i.test(filename)) {
      const filePath = path.join(process.cwd(), 'public', 'uploads', filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.warn('Could not remove orphaned banner on article deletion:', err);
        }
      }
    }
  }

  const filtered = articles.filter(a => a.id !== id);
  await saveArticles(filtered, [id]);
  return true;
}

export async function incrementDownloadCount(id: string): Promise<void> {
  const articles = await loadArticles();
  const art = articles.find(a => a.id === id || a.slug === id);
  if (art) {
    art.pdfDownloadCount = (art.pdfDownloadCount || 0) + 1;
    await saveArticles(articles);
  }
}

export async function syncArticles(incoming: Article[]): Promise<{ added: number; updated: number; total: number }> {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return { added: 0, updated: 0, total: (await loadArticles()).length };
  }

  const articles = await loadArticles();
  const existingMap = new Map<string, number>();
  articles.forEach((a, i) => {
    existingMap.set(a.id, i);
    if (a.slug) existingMap.set(a.slug, i);
  });

  let added = 0;
  let updated = 0;

  for (const item of incoming) {
    if (!item || !item.id || !item.title) continue;

    const existingIndex = existingMap.get(item.id) ?? (item.slug ? existingMap.get(item.slug) : undefined);

    if (existingIndex !== undefined) {
      const current = articles[existingIndex];
      const incomingTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
      const currentTime = new Date(current.updatedAt || current.createdAt || 0).getTime();

      if (incomingTime > currentTime) {
        articles[existingIndex] = {
          ...current,
          ...item,
          viewsCount: Math.max(current.viewsCount || 0, item.viewsCount || 0),
          pdfDownloadCount: Math.max(current.pdfDownloadCount || 0, item.pdfDownloadCount || 0),
        };
        updated++;
      }
    } else {
      articles.push(item);
      existingMap.set(item.id, articles.length - 1);
      if (item.slug) existingMap.set(item.slug, articles.length - 1);
      added++;
    }
  }

  if (added > 0 || updated > 0) {
    await saveArticles(articles);
  }

  return { added, updated, total: articles.length };
}
