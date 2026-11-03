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
 * Save multiple articles to local storage (replaces cache with authoritative server list).
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
 * Server is authoritative: replaces cached articles with confirmed server response.
 * Local cache is only used when server response is completely empty due to network offline.
 */
export const mergeArticlesWithLocal = (serverArticles: Article[]): Article[] => {
  if (Array.isArray(serverArticles) && serverArticles.length > 0) {
    // Overwrite local storage so deleted articles never resurrect
    saveAllLocalArticles(serverArticles);
    return serverArticles;
  }

  // If server returned explicitly empty array, clear local storage
  if (Array.isArray(serverArticles) && serverArticles.length === 0) {
    saveAllLocalArticles([]);
    return [];
  }

  // Network offline fallback
  return getLocalArticles();
};

/**
 * No-op: Automatic background push from client to server is permanently disabled.
 * Firestore is now the authoritative store, eliminating accidental resurrection of deleted data.
 */
export const syncLocalArticlesWithServer = async (): Promise<boolean> => {
  return true;
};

/**
 * Compresses an image file on the client-side to a WebP/JPEG data URL.
 * Preserves high visual fidelity while keeping payload ultra-lightweight.
 */
export const compressImageToDataUrl = (
  file: File,
  maxWidth = 1600,
  maxHeight = 900,
  quality = 0.82
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for compression'));
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
          return resolve(reader.result as string);
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try webp first, fallback to jpeg
        try {
          const webpUrl = canvas.toDataURL('image/webp', quality);
          if (webpUrl.startsWith('data:image/webp')) {
            return resolve(webpUrl);
          }
        } catch {}

        const jpegUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(jpegUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};
