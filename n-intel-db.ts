import fs from 'fs';
import path from 'path';
import type { NIntelStory, NIntelBatch, NIntelAuditLog } from './types';
import { parseDailyNewsPost } from './n-intel-parser';

const DATA_DIR = path.join(process.cwd(), 'data');
const STORIES_FILE = path.join(DATA_DIR, 'n-intel-stories.json');
const BATCHES_FILE = path.join(DATA_DIR, 'n-intel-batches.json');
const AUDIT_FILE = path.join(DATA_DIR, 'n-intel-audit.json');

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// In-memory cache for ultra-fast reading
let storiesCache: NIntelStory[] | null = null;
let batchesCache: NIntelBatch[] | null = null;
let auditCache: NIntelAuditLog[] | null = null;

function loadStories(): NIntelStory[] {
  if (storiesCache) return storiesCache;
  ensureDataDir();
  if (!fs.existsSync(STORIES_FILE)) {
    // Seed initial dataset if file does not exist yet
    storiesCache = [];
    saveStories(storiesCache);
    return storiesCache;
  }
  try {
    const raw = fs.readFileSync(STORIES_FILE, 'utf-8');
    storiesCache = JSON.parse(raw);
    return storiesCache || [];
  } catch (e) {
    console.error('Error reading stories file:', e);
    return [];
  }
}

function saveStories(stories: NIntelStory[]): void {
  ensureDataDir();
  storiesCache = stories;
  fs.writeFileSync(STORIES_FILE, JSON.stringify(stories, null, 2), 'utf-8');
}

function loadBatches(): NIntelBatch[] {
  if (batchesCache) return batchesCache;
  ensureDataDir();
  if (!fs.existsSync(BATCHES_FILE)) {
    batchesCache = [];
    saveBatches(batchesCache);
    return batchesCache;
  }
  try {
    const raw = fs.readFileSync(BATCHES_FILE, 'utf-8');
    batchesCache = JSON.parse(raw);
    return batchesCache || [];
  } catch (e) {
    console.error('Error reading batches file:', e);
    return [];
  }
}

function saveBatches(batches: NIntelBatch[]): void {
  ensureDataDir();
  batchesCache = batches;
  fs.writeFileSync(BATCHES_FILE, JSON.stringify(batches, null, 2), 'utf-8');
}

function loadAudit(): NIntelAuditLog[] {
  if (auditCache) return auditCache;
  ensureDataDir();
  if (!fs.existsSync(AUDIT_FILE)) {
    auditCache = [];
    saveAudit(auditCache);
    return auditCache;
  }
  try {
    const raw = fs.readFileSync(AUDIT_FILE, 'utf-8');
    auditCache = JSON.parse(raw);
    return auditCache || [];
  } catch (e) {
    console.error('Error reading audit file:', e);
    return [];
  }
}

function saveAudit(logs: NIntelAuditLog[]): void {
  ensureDataDir();
  auditCache = logs;
  fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs, null, 2), 'utf-8');
}

function addAuditLog(action: 'PUBLISH' | 'EDIT' | 'DELETE' | 'RESTORE', adminEmail: string, details: string, storyId?: string, batchId?: string) {
  const logs = loadAudit();
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
  if (logs.length > 1000) logs.length = 1000;
  saveAudit(logs);
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

export function getAllStories(options: StoryFilterOptions = {}): NIntelStory[] {
  let stories = loadStories();

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

export function getStoryById(id: string): NIntelStory | null {
  const stories = loadStories();
  return stories.find(s => s.id === id) || null;
}

export function getBatches(): NIntelBatch[] {
  return loadBatches();
}

export function findDuplicateBatch(hash: string, date: string): NIntelBatch | null {
  const batches = loadBatches();
  return batches.find(b => b.rawContentHash === hash && b.date === date) || null;
}

export function saveBatchAndStories(batch: NIntelBatch, newStories: NIntelStory[], adminEmail: string): void {
  const existingStories = loadStories();
  const existingBatches = loadBatches();

  // Prepend new stories, deduplicating by ID
  const storyMap = new Map<string, NIntelStory>();
  for (const s of [...newStories, ...existingStories]) {
    if (!storyMap.has(s.id)) {
      storyMap.set(s.id, s);
    }
  }
  const updatedStories = Array.from(storyMap.values());
  saveStories(updatedStories);

  const updatedBatches = [batch, ...existingBatches];
  saveBatches(updatedBatches);

  addAuditLog(
    'PUBLISH',
    adminEmail,
    `Published ${newStories.length} stories across ${batch.categories.length} categories for ${batch.date}`,
    undefined,
    batch.id
  );
}

export function updateStory(id: string, updates: Partial<NIntelStory>, adminEmail: string): NIntelStory | null {
  const stories = loadStories();
  const index = stories.findIndex(s => s.id === id);
  if (index === -1) return null;

  const current = stories[index];

  // Category key sync
  let categoryKey = current.categoryKey;
  if (updates.category) {
    categoryKey = updates.category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  const updated: NIntelStory = {
    ...current,
    ...updates,
    categoryKey,
    updatedAt: new Date().toISOString(),
    lastEditedBy: adminEmail
  };

  stories[index] = updated;
  saveStories(stories);

  const changeKeys = Object.keys(updates).join(', ');
  addAuditLog('EDIT', adminEmail, `Edited story [${id}]: updated (${changeKeys})`, id);

  return updated;
}

export function deleteStory(id: string, adminEmail: string): boolean {
  const stories = loadStories();
  const index = stories.findIndex(s => s.id === id);
  if (index === -1) return false;

  stories[index] = {
    ...stories[index],
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: adminEmail,
    updatedAt: new Date().toISOString()
  };

  saveStories(stories);

  addAuditLog('DELETE', adminEmail, `Soft-deleted story [${id}]: "${stories[index].headline}"`, id);
  return true;
}

export function restoreStory(id: string, adminEmail: string): boolean {
  const stories = loadStories();
  const index = stories.findIndex(s => s.id === id);
  if (index === -1) return false;

  stories[index] = {
    ...stories[index],
    isDeleted: false,
    deletedAt: undefined,
    deletedBy: undefined,
    updatedAt: new Date().toISOString()
  };

  saveStories(stories);

  addAuditLog('RESTORE', adminEmail, `Restored story [${id}]: "${stories[index].headline}"`, id);
  return true;
}

export function purgeStory(id: string, adminEmail: string): boolean {
  const stories = loadStories();
  const story = stories.find(s => s.id === id);
  if (!story) return false;

  const filtered = stories.filter(s => s.id !== id);
  saveStories(filtered);

  addAuditLog('DELETE', adminEmail, `Permanently purged story [${id}]: "${story.headline}"`, id);
  return true;
}

export function purgeAllDeletedStories(adminEmail: string): number {
  const stories = loadStories();
  const deleted = stories.filter(s => s.isDeleted);
  if (deleted.length === 0) return 0;

  const retained = stories.filter(s => !s.isDeleted);
  saveStories(retained);

  addAuditLog('DELETE', adminEmail, `Emptied trash: permanently purged all ${deleted.length} deleted stories.`);
  return deleted.length;
}

export function getAuditLogs(limitCount = 100): NIntelAuditLog[] {
  const logs = loadAudit();
  return logs.slice(0, limitCount);
}

export function getAvailableEditions(): {
  date: string;
  storyCount: number;
  categories: string[];
  highlights: string[];
  defenceCount: number;
  categoryCounts: Record<string, number>;
}[] {
  const stories = getAllStories({ includeDeleted: false });
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
export function seedSampleDataIfEmpty(samplePostText: string) {
  const existing = loadStories();
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
    saveBatchAndStories(batch, parseResult.stories, 'system@nishchay.defence');
    console.log(`✅ Seeded ${parseResult.totalStories} N-INTEL stories for 2026-10-28!`);
  }
}
