import type { Article } from './articles-db';

const LOCAL_STORAGE_ARTICLES_KEY = 'nishchay_articles_cache';
const DELETED_ARTICLES_KEY = 'nishchay_deleted_articles';

/**
 * Retrieve blacklisted (deleted) article IDs to prevent resurrecting deleted articles.
 */
export const getDeletedArticleIds = (): Record<string, boolean> => {
  try {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem(DELETED_ARTICLES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return {};
    const dict: Record<string, boolean> = {};
    for (const id of parsed) dict[String(id)] = true;
    return dict;
  } catch {
    return {};
  }
};

/**
 * Mark an article as deleted.
 */
export const markArticleDeleted = (id: string): void => {
  try {
    if (typeof window === 'undefined') return;
    const dict = getDeletedArticleIds();
    dict[id] = true;
    localStorage.setItem(DELETED_ARTICLES_KEY, JSON.stringify(Object.keys(dict)));
  } catch (e) {
    console.warn('Could not record deleted article ID:', e);
  }
};

/**
 * Unmark an article from deleted list (e.g. if restored or recreated).
 */
export const unmarkArticleDeleted = (id: string): void => {
  try {
    if (typeof window === 'undefined') return;
    const dict = getDeletedArticleIds();
    delete dict[id];
    localStorage.setItem(DELETED_ARTICLES_KEY, JSON.stringify(Object.keys(dict)));
  } catch (e) {
    console.warn('Could not unmark deleted article ID:', e);
  }
};

/**
 * Read locally cached articles from localStorage.
 */
export const getLocalArticles = (): Article[] => {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(LOCAL_STORAGE_ARTICLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const deleted = getDeletedArticleIds();
    return parsed
      .filter((a): a is Article => Boolean(a && a.id && a.title && !deleted[a.id]))
      .sort((a, b) => new Date(b.publishDate || b.createdAt || 0).getTime() - new Date(a.publishDate || a.createdAt || 0).getTime());
  } catch (e) {
    console.warn('Could not read cached articles from localStorage:', e);
    return [];
  }
};

/**
 * Save an individual article to local storage.
 */
export const saveLocalArticle = (article: Article): void => {
  try {
    if (typeof window === 'undefined' || !article || !article.id) return;
    unmarkArticleDeleted(article.id);
    const existing = getLocalArticles();
    const idx = existing.findIndex(a => a.id === article.id || (article.slug && a.slug === article.slug));
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...article };
    } else {
      existing.unshift(article);
    }
    existing.sort((a, b) => new Date(b.publishDate || b.createdAt || 0).getTime() - new Date(a.publishDate || a.createdAt || 0).getTime());
    localStorage.setItem(LOCAL_STORAGE_ARTICLES_KEY, JSON.stringify(existing));
  } catch (e) {
    console.warn('Could not save article to localStorage:', e);
  }
};

/**
 * Save multiple articles to local storage.
 */
export const saveAllLocalArticles = (articles: Article[]): void => {
  try {
    if (typeof window === 'undefined' || !Array.isArray(articles)) return;
    const deleted = getDeletedArticleIds();
    const valid = articles.filter(a => a && a.id && !deleted[a.id]);
    valid.sort((a, b) => new Date(b.publishDate || b.createdAt || 0).getTime() - new Date(a.publishDate || a.createdAt || 0).getTime());
    localStorage.setItem(LOCAL_STORAGE_ARTICLES_KEY, JSON.stringify(valid));
  } catch (e) {
    console.warn('Could not save articles to localStorage:', e);
  }
};

/**
 * Delete an article from local storage.
 */
export const deleteLocalArticle = (id: string): void => {
  try {
    if (typeof window === 'undefined') return;
    markArticleDeleted(id);
    const existing = getLocalArticles();
    const filtered = existing.filter(a => a.id !== id && a.slug !== id);
    localStorage.setItem(LOCAL_STORAGE_ARTICLES_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Could not remove article from localStorage:', e);
  }
};

/**
 * Merges server articles with local storage articles.
 * Preserves locally authored articles that the server might have lost during a cold restart.
 */
export const mergeArticlesWithLocal = (serverArticles: Article[]): Article[] => {
  const localArticles = getLocalArticles();
  const deleted = getDeletedArticleIds();
  const map: Record<string, Article> = {};

  // 1. Ingest valid server articles first
  if (Array.isArray(serverArticles)) {
    for (const s of serverArticles) {
      if (s && s.id && !deleted[s.id]) {
        map[s.id] = s;
        if (s.slug) map[s.slug] = s;
      }
    }
  }

  // 2. Ingest local articles (if server missed any, preserve them!)
  for (const l of localArticles) {
    if (l && l.id && !deleted[l.id]) {
      const match = map[l.id] || (l.slug ? map[l.slug] : null);
      if (!match) {
        map[l.id] = l;
      } else {
        // If local version has newer timestamp, keep local
        const serverTime = new Date(match.updatedAt || match.createdAt || 0).getTime();
        const localTime = new Date(l.updatedAt || l.createdAt || 0).getTime();
        if (localTime > serverTime) {
          map[l.id] = { ...match, ...l };
        }
      }
    }
  }

  // Unique list
  const seen = new Set<string>();
  const merged: Article[] = [];
  for (const item of Object.values(map)) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }

  merged.sort((a, b) => new Date(b.publishDate || b.createdAt || 0).getTime() - new Date(a.publishDate || a.createdAt || 0).getTime());
  saveAllLocalArticles(merged);
  return merged;
};

/**
 * Background synchronizer: Sends locally cached articles to the server
 * so that a freshly cold-started server container is automatically repopulated.
 */
export const syncLocalArticlesWithServer = async (): Promise<void> => {
  try {
    if (typeof window === 'undefined') return;
    const articles = getLocalArticles();
    if (!articles.length) return;

    await fetch('/api/articles/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articles })
    });
  } catch (e) {
    // Non-blocking background sync
    console.debug('Articles background sync non-critical notice:', e);
  }
};

/**
 * Compresses an image file client-side using an HTML5 Canvas to produce a sharp,
 * optimized WebP/JPEG Data URL. Completely eliminates dependency on server /tmp file storage.
 */
export const compressImageToDataUrl = (
  file: File,
  maxWidth = 1280,
  maxHeight = 800,
  quality = 0.82
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image data'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        // Fill white background for transparent PNGs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Try webp first, fallback to jpeg
        try {
          const webp = canvas.toDataURL('image/webp', quality);
          if (webp.startsWith('data:image/webp')) {
            resolve(webp);
            return;
          }
        } catch {
          // fallback to jpeg
        }
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
};
