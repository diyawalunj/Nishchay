/**
 * articles-db.ts — Persistent Cloud Database Storage for Articles.
 *
 * Backed by authenticated Google Cloud Storage (via cloud-db.ts).
 * Permanent, cross-device, single source of truth.
 * Survives container recycling, server restarts, and redeployments.
 */

import {
  fetchCollection,
  saveRecord,
  deleteRecord
} from './cloud-db';

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

const ARTICLES_TAB = 'articles';
const ARTICLES_HEADERS = ['id', 'slug', 'title', 'category', 'publishDate', 'authorName', 'json', 'updatedAt'];

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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getAllArticles(): Promise<Article[]> {
  const articles = await fetchCollection<Article>(ARTICLES_TAB, ARTICLES_HEADERS);
  return [...articles].sort(
    (a, b) => new Date(b.publishDate || b.createdAt).getTime() - new Date(a.publishDate || a.createdAt).getTime()
  );
}

export async function getArticleById(idOrSlug: string): Promise<Article | null> {
  if (!idOrSlug) return null;
  const articles = await getAllArticles();
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

  await saveRecord(ARTICLES_TAB, ARTICLES_HEADERS, newArticle, a => ({
    slug: a.slug,
    title: a.title,
    category: a.category,
    publishDate: a.publishDate,
    authorName: a.authorName
  }));

  return newArticle;
}

export async function updateArticle(id: string, updates: Partial<Article>): Promise<Article | null> {
  const current = await getArticleById(id);
  if (!current) return null;

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

  await saveRecord(ARTICLES_TAB, ARTICLES_HEADERS, updated, a => ({
    slug: a.slug,
    title: a.title,
    category: a.category,
    publishDate: a.publishDate,
    authorName: a.authorName
  }));

  return updated;
}

export async function deleteArticle(id: string): Promise<boolean> {
  const current = await getArticleById(id);
  if (!current) return false;
  return deleteRecord(ARTICLES_TAB, ARTICLES_HEADERS, current.id);
}

export async function incrementDownloadCount(id: string): Promise<void> {
  const art = await getArticleById(id);
  if (art) {
    art.pdfDownloadCount = (art.pdfDownloadCount || 0) + 1;
    await saveRecord(ARTICLES_TAB, ARTICLES_HEADERS, art, a => ({
      slug: a.slug,
      title: a.title,
      category: a.category,
      publishDate: a.publishDate,
      authorName: a.authorName
    }));
  }
}

export async function syncArticles(incoming: Article[]): Promise<{ added: number; updated: number; total: number }> {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    const all = await getAllArticles();
    return { added: 0, updated: 0, total: all.length };
  }

  const existing = await getAllArticles();
  const existingMap = new Map<string, Article>();
  for (const a of existing) {
    existingMap.set(a.id, a);
    if (a.slug) existingMap.set(a.slug, a);
  }

  let added = 0;
  let updated = 0;

  for (const item of incoming) {
    if (!item || !item.id || !item.title) continue;
    const match = existingMap.get(item.id) || (item.slug ? existingMap.get(item.slug) : undefined);
    if (!match) {
      await saveRecord(ARTICLES_TAB, ARTICLES_HEADERS, item, a => ({
        slug: a.slug,
        title: a.title,
        category: a.category,
        publishDate: a.publishDate,
        authorName: a.authorName
      }));
      added++;
    } else {
      const incomingTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
      const currTime = new Date(match.updatedAt || match.createdAt || 0).getTime();
      if (incomingTime > currTime) {
        await saveRecord(ARTICLES_TAB, ARTICLES_HEADERS, { ...match, ...item }, a => ({
          slug: a.slug,
          title: a.title,
          category: a.category,
          publishDate: a.publishDate,
          authorName: a.authorName
        }));
        updated++;
      }
    }
  }

  const all = await getAllArticles();
  return { added, updated, total: all.length };
}
