import type { NIntelStory, NIntelBatch } from './types';

export interface EditionSummary {
  date: string;
  storyCount: number;
  categories: string[];
  highlights?: string[];
  defenceCount?: number;
  categoryCounts?: Record<string, number>;
}

const LOCAL_STORIES_KEY = 'nishchay_nintel_local_stories';
const LOCAL_BATCHES_KEY = 'nishchay_nintel_local_batches';

/**
 * Safely load local stories from browser localStorage for instant initial paint.
 */
export function getLocalStories(): NIntelStory[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Could not read local N-INTEL stories from storage:', err);
    return [];
  }
}

/**
 * Updates local cache with the authoritative server dataset.
 * Overwrites local cache to prevent resurrection of deleted stories.
 */
export function saveLocalStories(incoming: NIntelStory[]): NIntelStory[] {
  if (typeof window === 'undefined' || !Array.isArray(incoming)) return [];
  try {
    localStorage.setItem(LOCAL_STORIES_KEY, JSON.stringify(incoming));
    return incoming;
  } catch (err) {
    console.warn('Could not persist local N-INTEL stories:', err);
    return incoming;
  }
}

/**
 * Safely load local batches from browser localStorage
 */
export function getLocalBatches(): NIntelBatch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_BATCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Could not read local N-INTEL batches from storage:', err);
    return [];
  }
}

/**
 * Overwrite local batches with authoritative server data
 */
export function saveLocalBatches(incoming: NIntelBatch[]): NIntelBatch[] {
  if (typeof window === 'undefined' || !Array.isArray(incoming)) return [];
  try {
    localStorage.setItem(LOCAL_BATCHES_KEY, JSON.stringify(incoming));
    return incoming;
  } catch (err) {
    console.warn('Could not persist local N-INTEL batches:', err);
    return incoming;
  }
}

/**
 * Server is authoritative: server editions replace cached editions.
 * Fallback to local only if server returns empty due to network offline.
 */
export function mergeEditionsWithLocal(serverEditions: EditionSummary[]): EditionSummary[] {
  if (Array.isArray(serverEditions) && serverEditions.length > 0) {
    // Server returned valid editions — server is authoritative
    return serverEditions;
  }
  // Offline fallback only
  const localStories = getLocalStories();
  if (localStories.length === 0) return serverEditions || [];

  const editionsMap = new Map<string, EditionSummary>();
  const localByDate: Record<string, NIntelStory[]> = {};
  for (const story of localStories) {
    if (!story || !story.date || story.isDeleted) continue;
    if (!localByDate[story.date]) localByDate[story.date] = [];
    localByDate[story.date].push(story);
  }

  for (const [date, stories] of Object.entries(localByDate)) {
    const categories = Array.from(new Set(stories.map(s => s.category).filter(Boolean)));
    const categoryCounts: Record<string, number> = {};
    let defenceCount = 0;
    const highlights: string[] = [];

    for (const s of stories) {
      categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
      if (s.isDefence || s.category.toLowerCase().includes('defence')) {
        defenceCount++;
      }
      if (highlights.length < 3 && s.headline) {
        highlights.push(s.headline);
      }
    }

    editionsMap.set(date, {
      date,
      storyCount: stories.length,
      categories,
      highlights,
      defenceCount,
      categoryCounts
    });
  }

  return Array.from(editionsMap.values()).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Server stories are authoritative.
 * Local cache is only used when serverStories is completely empty due to offline network failure.
 */
export function mergeStoriesWithLocal(serverStories: NIntelStory[], date?: string): NIntelStory[] {
  if (Array.isArray(serverStories) && serverStories.length > 0) {
    // Authoritative from server — update local storage cache for this date
    try {
      const existing = getLocalStories();
      const filtered = date ? existing.filter(s => s.date !== date) : [];
      const updated = [...filtered, ...serverStories];
      localStorage.setItem(LOCAL_STORIES_KEY, JSON.stringify(updated));
    } catch {}
    return serverStories;
  }

  // If server returned empty because user explicitly deleted all stories, return empty!
  if (Array.isArray(serverStories) && serverStories.length === 0 && date) {
    // Clean local storage for this date so deleted stories don't reappear
    try {
      const existing = getLocalStories();
      const filtered = existing.filter(s => s.date !== date);
      localStorage.setItem(LOCAL_STORIES_KEY, JSON.stringify(filtered));
    } catch {}
    return [];
  }

  // Network offline fallback
  const localStories = getLocalStories();
  const filtered = localStories.filter(s => {
    if (date && s.date !== date) return false;
    return !s.isDeleted;
  });

  return filtered.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const timeA = a.createdAt || '';
    const timeB = b.createdAt || '';
    if (timeA && timeB && timeA !== timeB) return timeB.localeCompare(timeA);
    return (b.itemNumber || 0) - (a.itemNumber || 0);
  });
}

/**
 * Removes or marks deleted a single story in localStorage
 */
export function deleteLocalStory(id: string, permanent = false): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalStories();
    const filtered = existing.filter(s => s.id !== id);
    localStorage.setItem(LOCAL_STORIES_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Could not delete story in localStorage:', err);
  }
}

/**
 * Deletes all stories for a specific date in localStorage
 */
export function deleteLocalStoriesByDate(date: string, permanent = false): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalStories();
    const filtered = existing.filter(s => s.date !== date);
    localStorage.setItem(LOCAL_STORIES_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Could not delete stories by date in localStorage:', err);
  }
}

/**
 * Deletes all stories for a category (and optional date) in localStorage
 */
export function deleteLocalStoriesByCategory(category: string, date?: string, permanent = false): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalStories();
    const targetCat = category.trim().toLowerCase();
    const filtered = existing.filter(s => {
      if (s.category.trim().toLowerCase() === targetCat) {
        if (!date || s.date === date) return false;
      }
      return true;
    });
    localStorage.setItem(LOCAL_STORIES_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Could not delete stories by category in localStorage:', err);
  }
}

/**
 * Deletes all stories matching specified IDs in localStorage
 */
export function deleteLocalStoriesByIds(ids: string[], permanent = false): void {
  if (typeof window === 'undefined' || !Array.isArray(ids) || ids.length === 0) return;
  try {
    const existing = getLocalStories();
    const idMap: Record<string, boolean> = {};
    for (const id of ids) idMap[id] = true;
    const filtered = existing.filter(s => !idMap[s.id]);
    localStorage.setItem(LOCAL_STORIES_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Could not delete stories by IDs in localStorage:', err);
  }
}

/**
 * No-op: Automatic background push from client to server is permanently disabled.
 * Firestore is now the authoritative store, eliminating accidental resurrection of deleted data.
 */
export async function syncLocalWithServer(token: string): Promise<boolean> {
  return true;
}
