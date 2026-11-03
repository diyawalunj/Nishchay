/**
 * N-Intel storage uses Firestore on Vercel and local JSON files for development.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { NIntelStory, NIntelBatch, NIntelAuditLog } from './types';
import { parseDailyNewsPost } from './n-intel-parser';
import { readContentCollection, writeContentCollection } from './firestore-content';

const IS_VERCEL = Boolean(process.env.VERCEL);
const USE_FIRESTORE = process.env.USE_FIRESTORE_CONTENT !== 'false';
const DATA_DIR = IS_VERCEL ? path.join(os.tmpdir(), 'nishchay_data') : path.join(process.cwd(), 'data');
const SEED_DATA_DIR = path.join(process.cwd(), 'data');
const STORIES_FILE = path.join(DATA_DIR, 'n-intel-stories.json');
const BATCHES_FILE = path.join(DATA_DIR, 'n-intel-batches.json');
const AUDIT_FILE = path.join(DATA_DIR, 'n-intel-audit.json');

const SEED_STORIES_FILE = path.join(SEED_DATA_DIR, 'n-intel-stories.json');
const SEED_BATCHES_FILE = path.join(SEED_DATA_DIR, 'n-intel-batches.json');
const SEED_AUDIT_FILE = path.join(SEED_DATA_DIR, 'n-intel-audit.json');

// Ensure data directory exists
function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (IS_VERCEL) {
      if (!fs.existsSync(STORIES_FILE) && fs.existsSync(SEED_STORIES_FILE)) {
        try { fs.copyFileSync(SEED_STORIES_FILE, STORIES_FILE); } catch {}
      }
      if (!fs.existsSync(BATCHES_FILE) && fs.existsSync(SEED_BATCHES_FILE)) {
        try { fs.copyFileSync(SEED_BATCHES_FILE, BATCHES_FILE); } catch {}
      }
      if (!fs.existsSync(AUDIT_FILE) && fs.existsSync(SEED_AUDIT_FILE)) {
        try { fs.copyFileSync(SEED_AUDIT_FILE, AUDIT_FILE); } catch {}
      }
    }
  } catch (err) {
    console.warn('Could not ensure data directory:', err);
  }
}

// In-memory cache for ultra-fast reading
let storiesCache: NIntelStory[] | null = null;
let batchesCache: NIntelBatch[] | null = null;
let auditCache: NIntelAuditLog[] | null = null;

async function loadStories(): Promise<NIntelStory[]> {
  if (USE_FIRESTORE) return readContentCollection<NIntelStory>('nintel_stories');
  if (storiesCache) return storiesCache;
  ensureDataDir();

  let targetFile = STORIES_FILE;
  if (!fs.existsSync(targetFile) && fs.existsSync(SEED_STORIES_FILE)) {
    targetFile = SEED_STORIES_FILE;
  }

  if (!fs.existsSync(targetFile)) {
    storiesCache = [];
    return storiesCache;
  }
  try {
    const raw = fs.readFileSync(targetFile, 'utf-8');
    storiesCache = JSON.parse(raw);
    return storiesCache || [];
  } catch (e) {
    console.error('Error reading stories file:', e);
    return [];
  }
}

function atomicWriteJsonSync(filePath: string, data: any): void {
  ensureDataDir();
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    console.warn(`Could not persist ${filePath} to disk:`, err);
  }
}

async function saveStories(stories: NIntelStory[], deletedIds: string[] = []): Promise<void> {
  if (USE_FIRESTORE) {
    await writeContentCollection('nintel_stories', stories, deletedIds);
    storiesCache = null;
    return;
  }
  storiesCache = stories;
  atomicWriteJsonSync(STORIES_FILE, stories);
}

async function loadBatches(): Promise<NIntelBatch[]> {
  if (USE_FIRESTORE) return readContentCollection<NIntelBatch>('nintel_batches');
  if (batchesCache) return batchesCache;
  ensureDataDir();

  let targetFile = BATCHES_FILE;
  if (!fs.existsSync(targetFile) && fs.existsSync(SEED_BATCHES_FILE)) {
    targetFile = SEED_BATCHES_FILE;
  }

  if (!fs.existsSync(targetFile)) {
    batchesCache = [];
    return batchesCache;
  }
  try {
    const raw = fs.readFileSync(targetFile, 'utf-8');
    batchesCache = JSON.parse(raw);
    return batchesCache || [];
  } catch (e) {
    console.error('Error reading batches file:', e);
    return [];
  }
}

async function saveBatches(batches: NIntelBatch[]): Promise<void> {
  if (USE_FIRESTORE) {
    await writeContentCollection('nintel_batches', batches);
    batchesCache = null;
    return;
  }
  batchesCache = batches;
  atomicWriteJsonSync(BATCHES_FILE, batches);
}

async function loadAudit(): Promise<NIntelAuditLog[]> {
  if (USE_FIRESTORE) return readContentCollection<NIntelAuditLog>('nintel_audit');
  if (auditCache) return auditCache;
  ensureDataDir();

  let targetFile = AUDIT_FILE;
  if (!fs.existsSync(targetFile) && fs.existsSync(SEED_AUDIT_FILE)) {
    targetFile = SEED_AUDIT_FILE;
  }

  if (!fs.existsSync(targetFile)) {
    auditCache = [];
    return auditCache;
  }
  try {
    const raw = fs.readFileSync(targetFile, 'utf-8');
    auditCache = JSON.parse(raw);
    return auditCache || [];
  } catch (e) {
    console.error('Error reading audit file:', e);
    return [];
  }
}

async function saveAudit(logs: NIntelAuditLog[], deletedIds: string[] = []): Promise<void> {
  if (USE_FIRESTORE) {
    await writeContentCollection('nintel_audit', logs, deletedIds);
    auditCache = null;
    return;
  }
  auditCache = logs;
  atomicWriteJsonSync(AUDIT_FILE, logs);
}

async function addAuditLog(action: 'PUBLISH' | 'EDIT' | 'DELETE' | 'RESTORE', adminEmail: string, details: string, storyId?: string, batchId?: string): Promise<void> {
  const logs = await loadAudit();
  const entry: NIntelAuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    action,
    storyId,
    batchId,
    adminEmail,
    timestamp: new Date().toISOString(),
    details
  };
  logs.unshift(entry);
  // Keep last 1,000 audit records
  const discarded = logs.slice(1000).map(log => log.id);
  if (logs.length > 1000) logs.length = 1000;
  await saveAudit(logs, discarded);
}

// ── Public Database APIs ──

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

  // Always sort latest newly uploaded news at the top
  stories = [...stories].sort((a, b) => {
    // 1. Primary: Date descending (newest day first)
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    // 2. Secondary: Upload timestamp descending (newest uploaded item first)
    const timeA = a.createdAt || '';
    const timeB = b.createdAt || '';
    if (timeA && timeB && timeA !== timeB) {
      return timeB.localeCompare(timeA);
    }
    // 3. Fallback: itemNumber descending
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

export async function saveBatchAndStories(batch: NIntelBatch, newStories: NIntelStory[], adminEmail: string): Promise<{ batch: NIntelBatch; count: number }> {
  const existingStories = await loadStories();
  const existingBatches = await loadBatches();

  // Prepend new stories, deduplicating by ID
  const storyMap = new Map<string, NIntelStory>();
  for (const s of [...newStories, ...existingStories]) {
    if (!storyMap.has(s.id)) {
      storyMap.set(s.id, s);
    }
  }
  const updatedStories = Array.from(storyMap.values());
  await saveStories(updatedStories);

  const updatedBatches = [batch, ...existingBatches];
  await saveBatches(updatedBatches);

  await addAuditLog(
    'PUBLISH',
    adminEmail,
    `Published ${newStories.length} stories across ${batch.categories.length} categories for ${batch.date}`,
    undefined,
    batch.id
  );

  return { batch, count: newStories.length };
}

export async function updateStory(id: string, updates: Partial<NIntelStory>, adminEmail: string): Promise<NIntelStory | null> {
  const stories = await loadStories();
  const index = stories.findIndex(s => s.id === id);
  if (index === -1) return null;

  const current = stories[index];

  // Category key sync
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

  stories[index] = updated;
  await saveStories(stories);

  const changeKeys = Object.keys(updates).join(', ');
  await addAuditLog('EDIT', adminEmail, `Edited story [${id}]: updated (${changeKeys})`, id);

  return updated;
}

export async function deleteStory(id: string, adminEmail: string): Promise<boolean> {
  const stories = await loadStories();
  const index = stories.findIndex(s => s.id === id);
  if (index === -1) return false;

  stories[index] = {
    ...stories[index],
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: adminEmail,
    updatedAt: new Date().toISOString()
  };

  await saveStories(stories);

  await addAuditLog('DELETE', adminEmail, `Soft-deleted story [${id}]: "${stories[index].headline}"`, id);
  return true;
}

export const softDeleteStory = deleteStory;

export async function restoreStory(id: string, adminEmail: string): Promise<boolean> {
  const stories = await loadStories();
  const index = stories.findIndex(s => s.id === id);
  if (index === -1) return false;

  stories[index] = {
    ...stories[index],
    isDeleted: false,
    deletedAt: undefined,
    deletedBy: undefined,
    updatedAt: new Date().toISOString()
  };

  await saveStories(stories);

  await addAuditLog('RESTORE', adminEmail, `Restored story [${id}]: "${stories[index].headline}"`, id);
  return true;
}

export async function purgeStory(id: string, adminEmail: string): Promise<boolean> {
  const stories = await loadStories();
  const story = stories.find(s => s.id === id);
  if (!story) return false;

  const filtered = stories.filter(s => s.id !== id);
  await saveStories(filtered, [id]);

  await addAuditLog('DELETE', adminEmail, `Permanently purged story [${id}]: "${story.headline}"`, id);
  return true;
}

export async function purgeAllDeletedStories(adminEmail: string): Promise<number> {
  const stories = await loadStories();
  const deleted = stories.filter(s => s.isDeleted);
  if (deleted.length === 0) return 0;

  const retained = stories.filter(s => !s.isDeleted);
  await saveStories(retained, deleted.map(story => story.id));

  await addAuditLog('DELETE', adminEmail, `Emptied trash: permanently purged all ${deleted.length} deleted stories.`);
  return deleted.length;
}

export async function deleteStoriesByDate(
  date: string,
  adminEmail: string,
  permanent = false
): Promise<{ count: number; date: string }> {
  const stories = await loadStories();
  let count = 0;

  if (permanent) {
    const retained = stories.filter(s => {
      if (s.date === date) {
        count++;
        return false;
      }
      return true;
    });
    await saveStories(retained, stories.filter(s => s.date === date).map(s => s.id));
    await addAuditLog('DELETE', adminEmail, `Permanently purged entire briefing for ${date} (${count} stories removed).`);
  } else {
    for (let i = 0; i < stories.length; i++) {
      if (stories[i].date === date && !stories[i].isDeleted) {
        stories[i] = {
          ...stories[i],
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          deletedBy: adminEmail,
          updatedAt: new Date().toISOString()
        };
        count++;
      }
    }
    await saveStories(stories);
    await addAuditLog('DELETE', adminEmail, `Soft-deleted entire briefing for ${date} (${count} stories moved to trash).`);
  }

  return { count, date };
}

export async function deleteStoriesByCategory(
  category: string,
  adminEmail: string,
  date?: string,
  permanent = false
): Promise<{ count: number; category: string; date?: string }> {
  const stories = await loadStories();
  let count = 0;
  const targetCategory = category.trim().toLowerCase();

  const matchesCategory = (s: NIntelStory) => {
    if (s.category.trim().toLowerCase() !== targetCategory) return false;
    if (date && s.date !== date) return false;
    return true;
  };

  if (permanent) {
    const retained = stories.filter(s => {
      if (matchesCategory(s)) {
        count++;
        return false;
      }
      return true;
    });
    await saveStories(retained, stories.filter(matchesCategory).map(s => s.id));
    await addAuditLog(
      'DELETE',
      adminEmail,
      `Permanently purged category "${category}"${date ? ` for date ${date}` : ''} (${count} stories removed).`
    );
  } else {
    for (let i = 0; i < stories.length; i++) {
      if (matchesCategory(stories[i]) && !stories[i].isDeleted) {
        stories[i] = {
          ...stories[i],
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          deletedBy: adminEmail,
          updatedAt: new Date().toISOString()
        };
        count++;
      }
    }
    await saveStories(stories);
    await addAuditLog(
      'DELETE',
      adminEmail,
      `Soft-deleted category "${category}"${date ? ` for date ${date}` : ''} (${count} stories moved to trash).`
    );
  }

  return { count, category, date };
}

export async function deleteStoriesByIds(
  ids: string[],
  adminEmail: string,
  permanent = false
): Promise<{ count: number; ids: string[] }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { count: 0, ids: [] };
  }
  const idMap: Record<string, boolean> = {};
  for (const id of ids) idMap[id] = true;

  const stories = await loadStories();
  let count = 0;

  if (permanent) {
    const retained = stories.filter(s => {
      if (idMap[s.id]) {
        count++;
        return false;
      }
      return true;
    });
    await saveStories(retained, stories.filter(s => idMap[s.id]).map(s => s.id));
    await addAuditLog('DELETE', adminEmail, `Permanently purged ${count} selected stories.`);
  } else {
    for (let i = 0; i < stories.length; i++) {
      if (idMap[stories[i].id] && !stories[i].isDeleted) {
        stories[i] = {
          ...stories[i],
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          deletedBy: adminEmail,
          updatedAt: new Date().toISOString()
        };
        count++;
      }
    }
    await saveStories(stories);
    await addAuditLog('DELETE', adminEmail, `Soft-deleted ${count} selected stories (moved to trash).`);
  }

  return { count, ids };
}

export async function getAuditLogs(limitCount = 100): Promise<NIntelAuditLog[]> {
  const logs = await loadAudit();
  return logs.slice(0, limitCount);
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

// Pre-seed with the sample data provided by the user if the store is empty
export async function seedSampleDataIfEmpty(samplePostText: string): Promise<void> {
  const existing = await loadStories();
  if (existing.length > 0) return;

  console.log('🌱 Seeding initial N-INTEL sample edition...');
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
    console.log(`✅ Seeded ${parseResult.totalStories} N-INTEL stories for 2026-10-28!`);
  }
}

/**
 * Merges and synchronizes client-side stories and batches into the server database.
 * Used for multi-layer persistence and cold-start serverless container hydration.
 */
export async function syncNIntelStories(incomingStories: NIntelStory[], incomingBatches?: NIntelBatch[]): Promise<{ count: number; total: number }> {
  if (!Array.isArray(incomingStories) || incomingStories.length === 0) {
    return { count: 0, total: (await loadStories()).length };
  }

  const existingStories = await loadStories();
  const storyMap = new Map<string, NIntelStory>();

  for (const s of existingStories) {
    if (s && s.id) storyMap.set(s.id, s);
  }
  for (const s of incomingStories) {
    if (s && s.id) storyMap.set(s.id, s);
  }

  const updatedStories = Array.from(storyMap.values());
  await saveStories(updatedStories);

  if (Array.isArray(incomingBatches) && incomingBatches.length > 0) {
    const existingBatches = await loadBatches();
    const batchMap = new Map<string, NIntelBatch>();
    for (const b of existingBatches) {
      if (b && b.id) batchMap.set(b.id, b);
    }
    for (const b of incomingBatches) {
      if (b && b.id) batchMap.set(b.id, b);
    }
    await saveBatches(Array.from(batchMap.values()));
  }

  return { count: incomingStories.length, total: updatedStories.length };
}
