/**
 * articles-db.ts — Firestore-backed persistent storage for Articles.
 *
 * MIGRATION: Previously used Vercel /tmp JSON files (ephemeral, caused 24-hour data loss).
 * Now uses Firebase Admin Firestore (permanent, cross-device, single source of truth).
 *
 * Collection: articles
 */

import admin from 'firebase-admin';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDb(): FirebaseFirestore.Firestore {
  return admin.firestore();
}

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

// Short-lived in-memory cache (30 seconds) to reduce cold-read Firestore costs
const CACHE_TTL_MS = 30_000;
let articlesCache: { data: Article[]; expiresAt: number } | null = null;

function invalidateArticlesCache() { articlesCache = null; }

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getAllArticles(): Promise<Article[]> {
  if (articlesCache && Date.now() < articlesCache.expiresAt) {
    return articlesCache.data;
  }
  const db = getDb();
  const snap = await db.collection('articles').orderBy('publishDate', 'desc').get();
  const articles = snap.docs.map(d => d.data() as Article);
  articlesCache = { data: articles, expiresAt: Date.now() + CACHE_TTL_MS };
  return articles;
}

export async function getArticleById(idOrSlug: string): Promise<Article | null> {
  if (!idOrSlug) return null;
  const db = getDb();
  const query = String(idOrSlug).trim();

  // Try direct doc lookup by ID first (fast)
  const byId = await db.collection('articles').doc(query).get();
  if (byId.exists) return byId.data() as Article;

  // Fall back to slug query
  const slugSnap = await db.collection('articles').where('slug', '==', query).limit(1).get();
  if (!slugSnap.empty) return slugSnap.docs[0].data() as Article;

  return null;
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
  const db = getDb();
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

  await db.collection('articles').doc(id).set(newArticle);
  invalidateArticlesCache();
  return newArticle;
}

export async function updateArticle(id: string, updates: Partial<Article>): Promise<Article | null> {
  const db = getDb();
  const docRef = db.collection('articles').doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;

  const current = snap.data() as Article;

  // Security: Explicit field whitelisting — protected fields cannot be overwritten
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

  await docRef.set(updated, { merge: true });
  invalidateArticlesCache();
  return updated;
}

export async function deleteArticle(id: string): Promise<boolean> {
  const db = getDb();
  const docRef = db.collection('articles').doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return false;

  await docRef.delete();
  invalidateArticlesCache();
  return true;
}

export async function incrementDownloadCount(id: string): Promise<void> {
  const db = getDb();
  // Try both id and slug
  const byId = await db.collection('articles').doc(id).get();
  if (byId.exists) {
    await byId.ref.update({
      pdfDownloadCount: admin.firestore.FieldValue.increment(1)
    });
    invalidateArticlesCache();
    return;
  }
  const slugSnap = await db.collection('articles').where('slug', '==', id).limit(1).get();
  if (!slugSnap.empty) {
    await slugSnap.docs[0].ref.update({
      pdfDownloadCount: admin.firestore.FieldValue.increment(1)
    });
    invalidateArticlesCache();
  }
}

/** Sync: merge client-side articles into Firestore only if they don't exist yet. */
export async function syncArticles(incoming: Article[]): Promise<{ added: number; updated: number; total: number }> {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    const all = await getAllArticles();
    return { added: 0, updated: 0, total: all.length };
  }

  const db = getDb();
  let added = 0;
  let updated = 0;

  for (const item of incoming) {
    if (!item || !item.id || !item.title) continue;
    const ref = db.collection('articles').doc(item.id);
    const snap = await ref.get();

    if (!snap.exists) {
      await ref.set(item);
      added++;
    } else {
      // Only update if incoming is newer
      const curr = snap.data() as Article;
      const incomingTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
      const currTime = new Date(curr.updatedAt || curr.createdAt || 0).getTime();
      if (incomingTime > currTime) {
        await ref.set({
          ...curr,
          ...item,
          viewsCount: Math.max(curr.viewsCount || 0, item.viewsCount || 0),
          pdfDownloadCount: Math.max(curr.pdfDownloadCount || 0, item.pdfDownloadCount || 0),
        }, { merge: true });
        updated++;
      }
    }
  }

  invalidateArticlesCache();
  const all = await getAllArticles();
  return { added, updated, total: all.length };
}
