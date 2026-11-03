/**
 * n-intel-db.ts — Persistent Cloud Database Storage for N-Intel daily briefings.
 *
 * Backed by authenticated Google Cloud Storage (via cloud-db.ts).
 * Permanent, cross-device, single source of truth.
 * Survives container recycling, server restarts, and redeployments.
 */

import type { NIntelStory, NIntelBatch, NIntelAuditLog } from './types';
import { parseDailyNewsPost } from './n-intel-parser';
import {
  fetchCollection,
  saveRecord,
  saveBatchRecords,
  deleteRecord,
  deleteRecordsMatching,
  invalidateCollectionCache
} from './cloud-db';

const STORIES_TAB = 'nintel_stories';
const STORIES_HEADERS = ['id', 'date', 'category', 'isDeleted', 'headline', 'json', 'updatedAt'];

const BATCHES_TAB = 'nintel_batches';
const BATCHES_HEADERS = ['id', 'date', 'rawContentHash', 'publishedAt', 'json', 'updatedAt'];

const AUDIT_TAB = 'nintel_audit';
const AUDIT_HEADERS = ['id', 'action', 'storyId', 'batchId', 'adminEmail', 'timestamp', 'details', 'json'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadStories(): Promise<NIntelStory[]> {
  return fetchCollection<NIntelStory>(STORIES_TAB, STORIES_HEADERS);
}

async function loadBatches(): Promise<NIntelBatch[]> {
  return fetchCollection<NIntelBatch>(BATCHES_TAB, BATCHES_HEADERS);
}

async function loadAudit(): Promise<NIntelAuditLog[]> {
  return fetchCollection<NIntelAuditLog>(AUDIT_TAB, AUDIT_HEADERS);
}

async function addAuditLog(
  action: 'PUBLISH' | 'EDIT' | 'DELETE' | 'RESTORE',
  adminEmail: string,
  details: string,
  storyId?: string,
  batchId?: string
): Promise<void> {
  const entry: NIntelAuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    action,
    storyId,
    batchId,
    adminEmail,
    timestamp: new Date().toISOString(),
    details
  };
  await saveRecord(AUDIT_TAB, AUDIT_HEADERS, entry, e => ({
    action: e.action,
    storyId: e.storyId || '',
    batchId: e.batchId || '',
    adminEmail: e.adminEmail,
    timestamp: e.timestamp,
    details: e.details
  }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface StoryFilterOptions {
  includeDeleted?: boolean;
  date?: string;
  month?: string; // YYYY-MM
  category?: string;
  search?: string;
  limit?: number;
}

export async function getAllStories(options: StoryFilterOptions = {}): Promise<NIntelStory[]> {
  let stories = await loadStories();

  if (!options.includeDeleted) {
    stories = stories.filter(s => !s.isDeleted);
  }

  if (options.date) {
    stories = stories.filter(s => s.date === options.date);
  }

  if (options.month) {
    stories = stories.filter(s => s.date && s.date.startsWith(options.month!));
  }

  if (options.category && options.category.toLowerCase() !== 'all') {
    const catLower = options.category.toLowerCase();
    stories = stories.filter(s => (s.category && s.category.toLowerCase() === catLower) || s.categoryKey === catLower);
  }

  if (options.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    stories = stories.filter(s =>
      (s.headline && s.headline.toLowerCase().includes(q)) ||
      (s.content && s.content.toLowerCase().includes(q)) ||
      (s.category && s.category.toLowerCase().includes(q)) ||
      (s.tags && s.tags.some(t => t.toLowerCase().includes(q))) ||
      (s.sourceName && s.sourceName.toLowerCase().includes(q))
    );
  }

  // Always sort latest newly uploaded news at the top
  stories = [...stories].sort((a, b) => {
    if (a.date !== b.date) return (b.date || '').localeCompare(a.date || '');
    const timeA = a.createdAt || '';
    const timeB = b.createdAt || '';
    if (timeA && timeB && timeA !== timeB) return timeB.localeCompare(timeA);
    return (b.itemNumber || 0) - (a.itemNumber || 0);
  });

  if (options.limit && options.limit > 0) {
    return stories.slice(0, options.limit);
  }

  return stories;
}

export async function getStoryById(id: string): Promise<NIntelStory | null> {
  const stories = await loadStories();
  return stories.find(s => s.id === id) || null;
}

export async function getBatches(): Promise<NIntelBatch[]> {
  return loadBatches();
}

export async function findDuplicateBatch(hash: string, date: string): Promise<NIntelBatch | null> {
  const batches = await loadBatches();
  return batches.find(b => b.rawContentHash === hash && b.date === date) || null;
}

export async function saveBatchAndStories(
  batch: NIntelBatch,
  newStories: NIntelStory[],
  adminEmail: string
): Promise<void> {
  // Save batch metadata
  await saveRecord(BATCHES_TAB, BATCHES_HEADERS, batch, b => ({
    date: b.date,
    rawContentHash: b.rawContentHash,
    publishedAt: b.publishedAt
  }));

  // Save stories
  await saveBatchRecords(STORIES_TAB, STORIES_HEADERS, newStories, s => ({
    date: s.date,
    category: s.category,
    isDeleted: s.isDeleted ? 'true' : 'false',
    headline: s.headline.substring(0, 200)
  }));

  await addAuditLog(
    'PUBLISH',
    adminEmail,
    `Published ${newStories.length} stories across ${batch.categories.length} categories for ${batch.date}`,
    undefined,
    batch.id
  );
}

export async function updateStory(
  id: string,
  updates: Partial<NIntelStory>,
  adminEmail: string
): Promise<NIntelStory | null> {
  const stories = await loadStories();
  const current = stories.find(s => s.id === id);
  if (!current) return null;

  let categoryKey = current.categoryKey;
  if (typeof updates.category === 'string' && updates.category.trim()) {
    categoryKey = updates.category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  const updated: NIntelStory = {
    ...current,
    headline: typeof updates.headline === 'string' ? updates.headline.trim() : current.headline,
    content: typeof updates.content === 'string' ? updates.content.trim() : current.content,
    category: typeof updates.category === 'string' ? updates.category.trim() : current.category,
    categoryKey,
    sourceName: updates.sourceName !== undefined ? updates.sourceName : current.sourceName,
    sourceUrl: updates.sourceUrl !== undefined ? updates.sourceUrl : current.sourceUrl,
    isDefence: typeof updates.isDefence === 'boolean' ? updates.isDefence : current.isDefence,
    updatedAt: new Date().toISOString(),
    lastEditedBy: adminEmail
  };

  await saveRecord(STORIES_TAB, STORIES_HEADERS, updated, s => ({
    date: s.date,
    category: s.category,
    isDeleted: s.isDeleted ? 'true' : 'false',
    headline: s.headline.substring(0, 200)
  }));

  await addAuditLog('EDIT', adminEmail, `Edited story [${id}]: updated (${Object.keys(updates).join(', ')})`, id);
  return updated;
}

export async function deleteStory(id: string, adminEmail: string): Promise<boolean> {
  const stories = await loadStories();
  const current = stories.find(s => s.id === id);
  if (!current) return false;

  const updated: NIntelStory = {
    ...current,
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: adminEmail,
    updatedAt: new Date().toISOString()
  };

  await saveRecord(STORIES_TAB, STORIES_HEADERS, updated, s => ({
    date: s.date,
    category: s.category,
    isDeleted: 'true',
    headline: s.headline.substring(0, 200)
  }));

  await addAuditLog('DELETE', adminEmail, `Soft-deleted story [${id}]: "${current.headline}"`, id);
  return true;
}

export async function restoreStory(id: string, adminEmail: string): Promise<boolean> {
  const stories = await loadStories();
  const current = stories.find(s => s.id === id);
  if (!current) return false;

  const updated: NIntelStory = {
    ...current,
    isDeleted: false,
    deletedAt: undefined,
    deletedBy: undefined,
    updatedAt: new Date().toISOString()
  };

  await saveRecord(STORIES_TAB, STORIES_HEADERS, updated, s => ({
    date: s.date,
    category: s.category,
    isDeleted: 'false',
    headline: s.headline.substring(0, 200)
  }));

  await addAuditLog('RESTORE', adminEmail, `Restored story [${id}]: "${current.headline}"`, id);
  return true;
}

export async function purgeStory(id: string, adminEmail: string): Promise<boolean> {
  const stories = await loadStories();
  const story = stories.find(s => s.id === id);
  if (!story) return false;

  await deleteRecord(STORIES_TAB, STORIES_HEADERS, id);
  await addAuditLog('DELETE', adminEmail, `Permanently purged story [${id}]: "${story.headline}"`, id);
  return true;
}

export async function purgeAllDeletedStories(adminEmail: string): Promise<number> {
  const purgedCount = await deleteRecordsMatching(STORIES_TAB, STORIES_HEADERS, r => {
    return r.get('isDeleted') === 'true';
  });

  if (purgedCount > 0) {
    await addAuditLog('DELETE', adminEmail, `Emptied trash: permanently purged all ${purgedCount} deleted stories.`);
  }
  return purgedCount;
}

export async function deleteStoriesByDate(
  date: string,
  adminEmail: string,
  permanent = false
): Promise<{ count: number; date: string }> {
  if (permanent) {
    const count = await deleteRecordsMatching(STORIES_TAB, STORIES_HEADERS, r => {
      return r.get('date') === date;
    });
    await addAuditLog('DELETE', adminEmail, `Permanently purged entire briefing for ${date} (${count} stories removed).`);
    return { count, date };
  } else {
    const stories = await loadStories();
    let count = 0;
    const toUpdate: NIntelStory[] = [];
    for (const s of stories) {
      if (s.date === date && !s.isDeleted) {
        toUpdate.push({
          ...s,
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          deletedBy: adminEmail,
          updatedAt: new Date().toISOString()
        });
        count++;
      }
    }
    if (toUpdate.length > 0) {
      await saveBatchRecords(STORIES_TAB, STORIES_HEADERS, toUpdate, s => ({
        date: s.date,
        category: s.category,
        isDeleted: 'true',
        headline: s.headline.substring(0, 200)
      }));
    }
    await addAuditLog('DELETE', adminEmail, `Soft-deleted entire briefing for ${date} (${count} stories moved to trash).`);
    return { count, date };
  }
}

export async function deleteStoriesByCategory(
  category: string,
  adminEmail: string,
  date?: string,
  permanent = false
): Promise<{ count: number; category: string; date?: string }> {
  const targetCategory = category.trim().toLowerCase();
  const matchesCategory = (r: any) => {
    const cat = (r.get('category') || '').trim().toLowerCase();
    if (cat !== targetCategory) return false;
    if (date && r.get('date') !== date) return false;
    return true;
  };

  if (permanent) {
    const count = await deleteRecordsMatching(STORIES_TAB, STORIES_HEADERS, matchesCategory);
    await addAuditLog('DELETE', adminEmail, `Permanently purged category "${category}"${date ? ` for date ${date}` : ''} (${count} stories removed).`);
    return { count, category, date };
  } else {
    const stories = await loadStories();
    let count = 0;
    const toUpdate: NIntelStory[] = [];
    for (const s of stories) {
      const cat = (s.category || '').trim().toLowerCase();
      if (cat === targetCategory && (!date || s.date === date) && !s.isDeleted) {
        toUpdate.push({
          ...s,
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          deletedBy: adminEmail,
          updatedAt: new Date().toISOString()
        });
        count++;
      }
    }
    if (toUpdate.length > 0) {
      await saveBatchRecords(STORIES_TAB, STORIES_HEADERS, toUpdate, s => ({
        date: s.date,
        category: s.category,
        isDeleted: 'true',
        headline: s.headline.substring(0, 200)
      }));
    }
    await addAuditLog('DELETE', adminEmail, `Soft-deleted category "${category}"${date ? ` for date ${date}` : ''} (${count} stories moved to trash).`);
    return { count, category, date };
  }
}

export async function deleteStoriesByIds(
  ids: string[],
  adminEmail: string,
  permanent = false
): Promise<{ count: number; ids: string[] }> {
  if (!Array.isArray(ids) || ids.length === 0) return { count: 0, ids: [] };

  const idMap: Record<string, boolean> = {};
  for (const id of ids) idMap[id] = true;

  if (permanent) {
    const count = await deleteRecordsMatching(STORIES_TAB, STORIES_HEADERS, r => Boolean(idMap[r.get('id')]));
    await addAuditLog('DELETE', adminEmail, `Permanently purged ${count} selected stories.`);
    return { count, ids };
  } else {
    const stories = await loadStories();
    let count = 0;
    const toUpdate: NIntelStory[] = [];
    for (const s of stories) {
      if (idMap[s.id] && !s.isDeleted) {
        toUpdate.push({
          ...s,
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          deletedBy: adminEmail,
          updatedAt: new Date().toISOString()
        });
        count++;
      }
    }
    if (toUpdate.length > 0) {
      await saveBatchRecords(STORIES_TAB, STORIES_HEADERS, toUpdate, s => ({
        date: s.date,
        category: s.category,
        isDeleted: 'true',
        headline: s.headline.substring(0, 200)
      }));
    }
    await addAuditLog('DELETE', adminEmail, `Soft-deleted ${count} selected stories.`);
    return { count, ids };
  }
}

export async function getAuditLogs(limitCount = 100): Promise<NIntelAuditLog[]> {
  const logs = await loadAudit();
  return logs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limitCount);
}

export async function getAvailableEditions(): Promise<{
  date: string;
  storyCount: number;
  categories: string[];
  highlights: string[];
  defenceCount: number;
  categoryCounts: Record<string, number>;
}[]> {
  const stories = await getAllStories({ includeDeleted: false });
  const map: Record<string, {
    date: string;
    storyCount: number;
    categories: Set<string>;
    categoryCounts: Record<string, number>;
    defenceCount: number;
    headlines: string[];
  }> = {};

  for (const s of stories) {
    if (!s.date) continue;
    if (!map[s.date]) {
      map[s.date] = {
        date: s.date,
        storyCount: 0,
        categories: new Set(),
        categoryCounts: {},
        defenceCount: 0,
        headlines: []
      };
    }
    map[s.date].storyCount++;
    if (s.category) {
      map[s.date].categories.add(s.category);
      map[s.date].categoryCounts[s.category] = (map[s.date].categoryCounts[s.category] || 0) + 1;
      if (s.isDefence || s.category.toLowerCase().includes('defence')) {
        map[s.date].defenceCount++;
      }
    }
    if (map[s.date].headlines.length < 3 && s.headline) {
      map[s.date].headlines.push(s.headline);
    }
  }

  return Object.values(map)
    .map(e => ({
      date: e.date,
      storyCount: e.storyCount,
      categories: Array.from(e.categories),
      highlights: e.headlines,
      defenceCount: e.defenceCount,
      categoryCounts: e.categoryCounts
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Seeds sample data only if the cloud store is completely empty. */
export async function seedSampleDataIfEmpty(samplePostText: string): Promise<void> {
  const existing = await loadStories();
  if (existing.length > 0) return;

  console.log('🌱 Seeding initial N-INTEL sample edition into Cloud Database...');
  const parseResult = parseDailyNewsPost(samplePostText, '2026-10-28');
  if (parseResult.success && parseResult.stories.length > 0) {
    const batch: NIntelBatch = {
      id: `batch-20261028-seed`,
      date: '2026-10-28',
      rawContentHash: parseResult.hash,
      publishedAt: new Date().toISOString(),
      publishedBy: 'system@nishchay.defence',
      storyCount: parseResult.totalStories,
      categories: parseResult.categories
    };
    await saveBatchAndStories(batch, parseResult.stories, 'system@nishchay.defence');
    console.log(`✅ Seeded ${parseResult.totalStories} N-INTEL stories into Cloud Database.`);
  }
}

/** Sync endpoint: merges incoming client stories into Cloud Database (used for hydration). */
export async function syncNIntelStories(
  incomingStories: NIntelStory[],
  incomingBatches?: NIntelBatch[]
): Promise<{ count: number; total: number }> {
  if (!Array.isArray(incomingStories) || incomingStories.length === 0) {
    const all = await loadStories();
    return { count: 0, total: all.length };
  }

  const existing = await loadStories();
  const existingMap = new Map<string, boolean>();
  for (const s of existing) existingMap.set(s.id, true);

  const toAdd = incomingStories.filter(s => s && s.id && !existingMap.has(s.id));
  if (toAdd.length > 0) {
    await saveBatchRecords(STORIES_TAB, STORIES_HEADERS, toAdd, s => ({
      date: s.date,
      category: s.category,
      isDeleted: s.isDeleted ? 'true' : 'false',
      headline: s.headline.substring(0, 200)
    }));
  }

  const all = await loadStories();
  return { count: toAdd.length, total: all.length };
}
