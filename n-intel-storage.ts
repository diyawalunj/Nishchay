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
 * Safely load local stories from browser localStorage
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
 * Safely save/merge stories into browser localStorage
 */
export function saveLocalStories(incoming: NIntelStory[]): NIntelStory[] {
  if (typeof window === 'undefined' || !Array.isArray(incoming)) return [];
  try {
    const existing = getLocalStories();
    const map = new Map<string, NIntelStory>();

    for (const s of existing) {
      if (s && s.id) map.set(s.id, s);
    }
    for (const s of incoming) {
      if (s && s.id) map.set(s.id, s);
    }

    const merged = Array.from(map.values());
    localStorage.setItem(LOCAL_STORIES_KEY, JSON.stringify(merged));
    return merged;
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
 * Safely save/merge batches into browser localStorage
 */
export function saveLocalBatches(incoming: NIntelBatch[]): NIntelBatch[] {
  if (typeof window === 'undefined' || !Array.isArray(incoming)) return [];
  try {
    const existing = getLocalBatches();
    const map = new Map<string, NIntelBatch>();

    for (const b of existing) {
      if (b && b.id) map.set(b.id, b);
    }
    for (const b of incoming) {
      if (b && b.id) map.set(b.id, b);
    }

    const merged = Array.from(map.values());
    localStorage.setItem(LOCAL_BATCHES_KEY, JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.warn('Could not persist local N-INTEL batches:', err);
    return incoming;
  }
}

/**
 * Non-destructively merges server editions with local storage editions.
 * Guarantees that newly published editions never disappear when serverless workers cold-start.
 */
export function mergeEditionsWithLocal(serverEditions: EditionSummary[]): EditionSummary[] {
  const localStories = getLocalStories();
  if (localStories.length === 0) return serverEditions;

  const editionsMap = new Map<string, EditionSummary>();

  // Add server editions first
  for (const ed of serverEditions) {
    if (ed && ed.date) {
      editionsMap.set(ed.date, { ...ed });
    }
  }

  // Group local stories by date
  const localByDate: Record<string, NIntelStory[]> = {};
  for (const story of localStories) {
    if (!story || !story.date || story.isDeleted) continue;
    if (!localByDate[story.date]) {
      localByDate[story.date] = [];
    }
    localByDate[story.date].push(story);
  }

  // Merge each date's data
  for (const [date, stories] of Object.entries(localByDate)) {
    const existing = editionsMap.get(date);
    if (!existing) {
      // New edition synthesized from local storage
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
    } else {
      // Ensure story count is at least the local count
      if (stories.length > existing.storyCount) {
        existing.storyCount = stories.length;
      }
    }
  }

  return Array.from(editionsMap.values()).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Merges server stories with locally saved stories for a given date
 */
export function mergeStoriesWithLocal(serverStories: NIntelStory[], date?: string): NIntelStory[] {
  const localStories = getLocalStories();
  if (localStories.length === 0) return serverStories;

  const storyMap = new Map<string, NIntelStory>();

  for (const s of serverStories) {
    if (s && s.id) storyMap.set(s.id, s);
  }

  for (const s of localStories) {
    if (s && s.id) {
      if (date && s.date !== date) continue;
      // If server doesn't have it, or local has a newer version
      if (!storyMap.has(s.id)) {
        storyMap.set(s.id, s);
      }
    }
  }

  return Array.from(storyMap.values()).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const timeA = a.createdAt || '';
    const timeB = b.createdAt || '';
    if (timeA && timeB && timeA !== timeB) return timeB.localeCompare(timeA);
    return (b.itemNumber || 0) - (a.itemNumber || 0);
  });
}

/**
 * Synchronizes local stories with the remote server.
 * Run in background when an administrator visits the platform.
 */
export async function syncLocalWithServer(token: string): Promise<boolean> {
  const localStories = getLocalStories();
  const localBatches = getLocalBatches();

  if (localStories.length === 0) return false;

  try {
    const res = await fetch('/api/n-intel/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        stories: localStories,
        batches: localBatches
      })
    });

    const data = await res.json();
    return res.ok && data.success;
  } catch (err) {
    console.warn('Background N-INTEL sync attempt failed:', err);
    return false;
  }
}
