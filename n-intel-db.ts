/**
 * n-intel-db.ts — Firestore-backed persistent storage for N-Intel daily briefings.
 *
 * MIGRATION: Previously used Vercel /tmp JSON files (ephemeral, caused 24-hour data loss).
 * Now uses Firebase Admin Firestore (permanent, cross-device, single source of truth).
 *
 * Collections:
 *   nIntelStories   — individual story documents
 *   nIntelBatches   — batch/edition metadata
 *   nIntelAudit     — audit log entries
 */

import admin from 'firebase-admin';
import type { NIntelStory, NIntelBatch, NIntelAuditLog } from './types';
import { parseDailyNewsPost } from './n-intel-parser';

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

function getDb(): FirebaseFirestore.Firestore {
  return admin.firestore();
}

// Short-lived in-memory cache to reduce Firestore reads within the same
// serverless invocation. Cleared on each cold-start automatically.
const CACHE_TTL_MS = 30_000; // 30 seconds

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

let storiesCache: CacheEntry<NIntelStory[]> | null = null;
let batchesCache: CacheEntry<NIntelBatch[]> | null = null;
let auditCache: CacheEntry<NIntelAuditLog[]> | null = null;

function isCacheValid<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return entry !== null && Date.now() < entry.expiresAt;
}

function invalidateStoriesCache() { storiesCache = null; }
function invalidateBatchesCache() { batchesCache = null; }
function invalidateAuditCache() { auditCache = null; }

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

async function loadStoriesFromFirestore(): Promise<NIntelStory[]> {
  const db = getDb();
  const snap = await db.collection('nIntelStories').get();
  return snap.docs.map(d => d.data() as NIntelStory);
}

async function loadStories(): Promise<NIntelStory[]> {
  if (isCacheValid(storiesCache)) return storiesCache.data;
  const stories = await loadStoriesFromFirestore();
  storiesCache = { data: stories, expiresAt: Date.now() + CACHE_TTL_MS };
  return stories;
}

async function saveStories(stories: NIntelStory[]): Promise<void> {
  const db = getDb();
  const batch = db.batch();
  for (const story of stories) {
    const ref = db.collection('nIntelStories').doc(story.id);
    batch.set(ref, story, { merge: true });
  }
  await batch.commit();
  storiesCache = { data: stories, expiresAt: Date.now() + CACHE_TTL_MS };
}

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

async function loadBatches(): Promise<NIntelBatch[]> {
  if (isCacheValid(batchesCache)) return batchesCache.data;
  const db = getDb();
  const snap = await db.collection('nIntelBatches').get();
  const batches = snap.docs.map(d => d.data() as NIntelBatch);
  batchesCache = { data: batches, expiresAt: Date.now() + CACHE_TTL_MS };
  return batches;
}

async function saveBatch(batch: NIntelBatch): Promise<void> {
  const db = getDb();
  await db.collection('nIntelBatches').doc(batch.id).set(batch, { merge: true });
  invalidateBatchesCache();
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

async function addAuditLog(
  action: 'PUBLISH' | 'EDIT' | 'DELETE' | 'RESTORE',
  adminEmail: string,
  details: string,
  storyId?: string,
  batchId?: string
): Promise<void> {
  const db = getDb();
  const entry: NIntelAuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    action,
    storyId,
    batchId,
    adminEmail,
    timestamp: new Date().toISOString(),
    details
  };
  await db.collection('nIntelAudit').doc(entry.id).set(entry);
  invalidateAuditCache();
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
    stories = stories.filter(s => s.date.startsWith(options.month!));
  }

  if (options.category && options.category.toLowerCase() !== 'all') {
    const catLower = options.category.toLowerCase();
    stories = stories.filter(s => s.category.toLowerCase() === catLower || s.categoryKey === catLower);
  }

  if (options.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    stories = stories.filter(s =>
      s.headline.toLowerCase().includes(q) ||
      s.content.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      (s.tags && s.tags.some(t => t.toLowerCase().includes(q))) ||
      (s.sourceName && s.sourceName.toLowerCase().includes(q))
    );
  }

  // Sort: newest date first, then newest upload time, then itemNumber
  stories = [...stories].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
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
  const db = getDb();
  const doc = await db.collection('nIntelStories').doc(id).get();
  return doc.exists ? (doc.data() as NIntelStory) : null;
}

export async function getBatches(): Promise<NIntelBatch[]> {
  return loadBatches();
}

export async function findDuplicateBatch(hash: string, date: string): Promise<NIntelBatch | null> {
  const db = getDb();
  const snap = await db.collection('nIntelBatches')
    .where('rawContentHash', '==', hash)
    .where('date', '==', date)
    .limit(1)
    .get();
  return snap.empty ? null : (snap.docs[0].data() as NIntelBatch);
}

export async function saveBatchAndStories(
  batch: NIntelBatch,
  newStories: NIntelStory[],
  adminEmail: string
): Promise<void> {
  const db = getDb();

  // Write all new stories in batched Firestore writes (max 500 per batch)
  const CHUNK = 400;
  for (let i = 0; i < newStories.length; i += CHUNK) {
    const chunk = newStories.slice(i, i + CHUNK);
    const fsBatch = db.batch();
    for (const story of chunk) {
      const ref = db.collection('nIntelStories').doc(story.id);
      fsBatch.set(ref, story, { merge: true });
    }
    await fsBatch.commit();
  }

  // Write batch metadata
  await saveBatch(batch);

  invalidateStoriesCache();
  invalidateBatchesCache();

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
  const db = getDb();
  const docRef = db.collection('nIntelStories').doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;

  const current = snap.data() as NIntelStory;

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

  await docRef.set(updated, { merge: true });
  invalidateStoriesCache();

  await addAuditLog('EDIT', adminEmail, `Edited story [${id}]: updated (${Object.keys(updates).join(', ')})`, id);
  return updated;
}

export async function deleteStory(id: string, adminEmail: string): Promise<boolean> {
  const db = getDb();
  const docRef = db.collection('nIntelStories').doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return false;

  const current = snap.data() as NIntelStory;
  const updated = {
    ...current,
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: adminEmail,
    updatedAt: new Date().toISOString()
  };

  await docRef.set(updated, { merge: true });
  invalidateStoriesCache();

  await addAuditLog('DELETE', adminEmail, `Soft-deleted story [${id}]: "${current.headline}"`, id);
  return true;
}

export async function restoreStory(id: string, adminEmail: string): Promise<boolean> {
  const db = getDb();
  const docRef = db.collection('nIntelStories').doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return false;

  const current = snap.data() as NIntelStory;
  await docRef.set({
    ...current,
    isDeleted: false,
    deletedAt: admin.firestore.FieldValue.delete(),
    deletedBy: admin.firestore.FieldValue.delete(),
    updatedAt: new Date().toISOString()
  }, { merge: true });

  invalidateStoriesCache();
  await addAuditLog('RESTORE', adminEmail, `Restored story [${id}]: "${current.headline}"`, id);
  return true;
}

export async function purgeStory(id: string, adminEmail: string): Promise<boolean> {
  const db = getDb();
  const docRef = db.collection('nIntelStories').doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return false;

  const headline = (snap.data() as NIntelStory).headline;
  await docRef.delete();
  invalidateStoriesCache();

  await addAuditLog('DELETE', adminEmail, `Permanently purged story [${id}]: "${headline}"`, id);
  return true;
}

export async function purgeAllDeletedStories(adminEmail: string): Promise<number> {
  const db = getDb();
  const snap = await db.collection('nIntelStories').where('isDeleted', '==', true).get();
  if (snap.empty) return 0;

  const fsBatch = db.batch();
  for (const doc of snap.docs) {
    fsBatch.delete(doc.ref);
  }
  await fsBatch.commit();
  invalidateStoriesCache();

  await addAuditLog('DELETE', adminEmail, `Emptied trash: permanently purged ${snap.size} deleted stories.`);
  return snap.size;
}

export async function deleteStoriesByDate(
  date: string,
  adminEmail: string,
  permanent = false
): Promise<{ count: number; date: string }> {
  const db = getDb();
  const snap = await db.collection('nIntelStories').where('date', '==', date).get();
  if (snap.empty) return { count: 0, date };

  const fsBatch = db.batch();
  let count = 0;

  for (const docSnap of snap.docs) {
    const story = docSnap.data() as NIntelStory;
    if (permanent) {
      fsBatch.delete(docSnap.ref);
      count++;
    } else if (!story.isDeleted) {
      fsBatch.set(docSnap.ref, {
        ...story,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: adminEmail,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      count++;
    }
  }

  await fsBatch.commit();
  invalidateStoriesCache();

  const action = permanent ? 'Permanently purged' : 'Soft-deleted';
  await addAuditLog('DELETE', adminEmail, `${action} entire briefing for ${date} (${count} stories).`);
  return { count, date };
}

export async function deleteStoriesByCategory(
  category: string,
  adminEmail: string,
  date?: string,
  permanent = false
): Promise<{ count: number; category: string; date?: string }> {
  const db = getDb();
  let query: FirebaseFirestore.Query = db.collection('nIntelStories')
    .where('category', '==', category.trim());
  if (date) {
    query = query.where('date', '==', date);
  }

  const snap = await query.get();
  if (snap.empty) return { count: 0, category, date };

  const fsBatch = db.batch();
  let count = 0;

  for (const docSnap of snap.docs) {
    const story = docSnap.data() as NIntelStory;
    if (permanent) {
      fsBatch.delete(docSnap.ref);
      count++;
    } else if (!story.isDeleted) {
      fsBatch.set(docSnap.ref, {
        ...story,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: adminEmail,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      count++;
    }
  }

  await fsBatch.commit();
  invalidateStoriesCache();

  const action = permanent ? 'Permanently purged' : 'Soft-deleted';
  await addAuditLog(
    'DELETE',
    adminEmail,
    `${action} category "${category}"${date ? ` for date ${date}` : ''} (${count} stories).`
  );
  return { count, category, date };
}

export async function deleteStoriesByIds(
  ids: string[],
  adminEmail: string,
  permanent = false
): Promise<{ count: number; ids: string[] }> {
  if (!Array.isArray(ids) || ids.length === 0) return { count: 0, ids: [] };

  const db = getDb();
  const fsBatch = db.batch();
  let count = 0;

  for (const id of ids) {
    const docRef = db.collection('nIntelStories').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) continue;
    const story = snap.data() as NIntelStory;

    if (permanent) {
      fsBatch.delete(docRef);
      count++;
    } else if (!story.isDeleted) {
      fsBatch.set(docRef, {
        ...story,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: adminEmail,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      count++;
    }
  }

  await fsBatch.commit();
  invalidateStoriesCache();

  const action = permanent ? 'Permanently purged' : 'Soft-deleted';
  await addAuditLog('DELETE', adminEmail, `${action} ${count} selected stories.`);
  return { count, ids };
}

export async function getAuditLogs(limitCount = 100): Promise<NIntelAuditLog[]> {
  if (isCacheValid(auditCache)) return auditCache.data.slice(0, limitCount);

  const db = getDb();
  const snap = await db.collection('nIntelAudit')
    .orderBy('timestamp', 'desc')
    .limit(Math.min(limitCount, 1000))
    .get();
  const logs = snap.docs.map(d => d.data() as NIntelAuditLog);
  auditCache = { data: logs, expiresAt: Date.now() + CACHE_TTL_MS };
  return logs;
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
    map[s.date].categories.add(s.category);
    map[s.date].categoryCounts[s.category] = (map[s.date].categoryCounts[s.category] || 0) + 1;
    if (s.isDefence || s.category.toLowerCase().includes('defence')) {
      map[s.date].defenceCount++;
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

/** Seeds sample data only if the Firestore collection is completely empty. */
export async function seedSampleDataIfEmpty(samplePostText: string): Promise<void> {
  const db = getDb();
  const snap = await db.collection('nIntelStories').limit(1).get();
  if (!snap.empty) return; // Already has data — never overwrite

  console.log('🌱 Seeding initial N-INTEL sample edition into Firestore...');
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
    console.log(`✅ Seeded ${parseResult.totalStories} N-INTEL stories into Firestore.`);
  }
}

/** Sync endpoint: merges incoming client stories into Firestore (used for cold-start hydration). */
export async function syncNIntelStories(
  incomingStories: NIntelStory[],
  incomingBatches?: NIntelBatch[]
): Promise<{ count: number; total: number }> {
  if (!Array.isArray(incomingStories) || incomingStories.length === 0) {
    const all = await loadStories();
    return { count: 0, total: all.length };
  }

  const db = getDb();
  const fsBatch = db.batch();

  for (const story of incomingStories) {
    if (!story || !story.id) continue;
    const ref = db.collection('nIntelStories').doc(story.id);
    // Only write if story doesn't already exist in Firestore
    const existing = await ref.get();
    if (!existing.exists) {
      fsBatch.set(ref, story);
    }
  }
  await fsBatch.commit();
  invalidateStoriesCache();

  if (Array.isArray(incomingBatches) && incomingBatches.length > 0) {
    const bFsBatch = db.batch();
    for (const b of incomingBatches) {
      if (!b || !b.id) continue;
      const ref = db.collection('nIntelBatches').doc(b.id);
      const existing = await ref.get();
      if (!existing.exists) {
        bFsBatch.set(ref, b);
      }
    }
    await bFsBatch.commit();
    invalidateBatchesCache();
  }

  const all = await loadStories();
  return { count: incomingStories.length, total: all.length };
}
