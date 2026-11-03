/**
 * cloud-db.ts — Centralized Cloud Persistent Database Layer
 *
 * Backed by authenticated Google Cloud Sheets Storage via Service Account.
 * Provides permanent, cross-device persistence that survives all Vercel
 * serverless container lifecycles, redeployments, and cold restarts.
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import os from 'os';

const IS_VERCEL = Boolean(process.env.VERCEL);
const LOCAL_CACHE_DIR = IS_VERCEL
  ? path.join(os.tmpdir(), 'nishchay_cloud_cache')
  : path.join(process.cwd(), 'data');

function ensureCacheDir() {
  try {
    if (!fs.existsSync(LOCAL_CACHE_DIR)) {
      fs.mkdirSync(LOCAL_CACHE_DIR, { recursive: true });
    }
  } catch {}
}

function getAuth(): JWT {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error('Google Cloud Service Account credentials are not configured.');
  }

  key = key.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1').trim();
  if (!key.includes('BEGIN PRIVATE KEY')) {
    throw new Error('GOOGLE_PRIVATE_KEY is malformed.');
  }

  return new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

let docInstance: GoogleSpreadsheet | null = null;
let docLoadedAt = 0;
const DOC_TTL_MS = 60_000; // reload sheet metadata every 60s

async function getDoc(): Promise<GoogleSpreadsheet> {
  const now = Date.now();
  if (docInstance && now - docLoadedAt < DOC_TTL_MS) {
    return docInstance;
  }
  const sheetId = process.env.GOOGLE_SHEET_ID_CONTACT || '1gGWQxXAuKCpt99m6efSBwaDUqLFJn_7f-WnESPOnmQY';
  const auth = getAuth();
  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();
  docInstance = doc;
  docLoadedAt = now;
  return doc;
}

// ---------------------------------------------------------------------------
// Sheet tab manager with auto-creation
// ---------------------------------------------------------------------------

async function getOrCreateTab(
  tabTitle: string,
  headerValues: string[]
) {
  const doc = await getDoc();
  let tab = doc.sheetsByTitle[tabTitle];
  if (!tab) {
    try {
      tab = await doc.addSheet({ title: tabTitle, headerValues });
    } catch {
      // In case another process added it concurrently
      await doc.loadInfo();
      tab = doc.sheetsByTitle[tabTitle];
    }
  }
  try {
    await tab.loadHeaderRow();
  } catch {
    try {
      await tab.setHeaderRow(headerValues);
    } catch {}
  }
  return tab;
}

// ---------------------------------------------------------------------------
// Generic Collection CRUD with local disk backup and in-memory TTL
// ---------------------------------------------------------------------------

interface MemoryCache<T> {
  items: T[];
  expiresAt: number;
}

const memoryCaches: Record<string, MemoryCache<any>> = {};
const CACHE_TTL_MS = 30_000; // 30 seconds

function readDiskBackup<T>(collectionName: string): T[] | null {
  ensureCacheDir();
  const filePath = path.join(LOCAL_CACHE_DIR, `${collectionName}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeDiskBackup<T>(collectionName: string, items: T[]): void {
  ensureCacheDir();
  const filePath = path.join(LOCAL_CACHE_DIR, `${collectionName}.json`);
  const tmpPath = `${filePath}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(items), 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
  }
}

export async function fetchCollection<T extends { id: string }>(
  tabName: string,
  headers: string[]
): Promise<T[]> {
  const now = Date.now();
  const cached = memoryCaches[tabName];
  if (cached && now < cached.expiresAt) {
    return cached.items;
  }

  try {
    const tab = await getOrCreateTab(tabName, headers);
    const rows = await tab.getRows();
    const items: T[] = [];

    for (const r of rows) {
      const rawJson = r.get('json');
      if (rawJson) {
        try {
          items.push(JSON.parse(rawJson));
        } catch {}
      }
    }

    memoryCaches[tabName] = { items, expiresAt: now + CACHE_TTL_MS };
    writeDiskBackup(tabName, items);
    return items;
  } catch (err) {
    console.warn(`[CloudDB] Could not load ${tabName} from Cloud Sheet, falling back to disk backup:`, err);
    const backup = readDiskBackup<T>(tabName);
    if (backup) {
      memoryCaches[tabName] = { items: backup, expiresAt: now + 5000 };
      return backup;
    }
    return [];
  }
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1200): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const msg = String(err?.message || '') + String(err?.status || '') + String(err?.code || '');
    const isRateLimit = msg.includes('429') || msg.includes('Quota exceeded') || msg.includes('RESOURCE_EXHAUSTED');
    if (isRateLimit && retries > 0) {
      console.warn(`[CloudDB] Google Sheets 429 quota reached, auto-retrying in ${delayMs}ms...`);
      await new Promise(res => setTimeout(res, delayMs));
      return withRetry(fn, retries - 1, delayMs * 2);
    }
    throw err;
  }
}

export async function saveRecord<T extends { id: string }>(
  tabName: string,
  headers: string[],
  record: T,
  rowFieldExtractors?: (item: T) => Record<string, any>
): Promise<void> {
  return withRetry(async () => {
    const tab = await getOrCreateTab(tabName, headers);
    const rows = await tab.getRows();
    const existing = rows.find(r => r.get('id') === record.id);

    const extraFields = rowFieldExtractors ? rowFieldExtractors(record) : {};
    const rowData = {
      ...extraFields,
      id: record.id,
      json: JSON.stringify(record),
      updatedAt: new Date().toISOString()
    };

    if (existing) {
      for (const [k, v] of Object.entries(rowData)) {
        existing.set(k, String(v ?? ''));
      }
      await existing.save();
    } else {
      await tab.addRow(rowData);
    }

    // Update in-memory and disk cache
    delete memoryCaches[tabName];
  });
}

export async function saveBatchRecords<T extends { id: string }>(
  tabName: string,
  headers: string[],
  records: T[],
  rowFieldExtractors?: (item: T) => Record<string, any>
): Promise<void> {
  if (records.length === 0) return;
  return withRetry(async () => {
    const tab = await getOrCreateTab(tabName, headers);
    const rows = await tab.getRows();
    const rowMap = new Map<string, any>();
    for (const r of rows) {
      const id = r.get('id');
      if (id) rowMap.set(id, r);
    }

    const toAdd: any[] = [];
    for (const rec of records) {
      const extraFields = rowFieldExtractors ? rowFieldExtractors(rec) : {};
      const rowData = {
        ...extraFields,
        id: rec.id,
        json: JSON.stringify(rec),
        updatedAt: new Date().toISOString()
      };
      const existing = rowMap.get(rec.id);
      if (existing) {
        for (const [k, v] of Object.entries(rowData)) {
          existing.set(k, String(v ?? ''));
        }
        await existing.save();
      } else {
        toAdd.push(rowData);
      }
    }

    if (toAdd.length > 0) {
      await tab.addRows(toAdd);
    }

    delete memoryCaches[tabName];
  });
}

export async function deleteRecord(
  tabName: string,
  headers: string[],
  id: string
): Promise<boolean> {
  return withRetry(async () => {
    const tab = await getOrCreateTab(tabName, headers);
    const rows = await tab.getRows();
    const target = rows.find(r => r.get('id') === id);
    if (!target) return false;

    await target.delete();
    delete memoryCaches[tabName];
    return true;
  });
}

export async function deleteRecordsMatching(
  tabName: string,
  headers: string[],
  predicate: (row: any) => boolean
): Promise<number> {
  return withRetry(async () => {
    const tab = await getOrCreateTab(tabName, headers);
    const rows = await tab.getRows();
    let deletedCount = 0;

    for (const r of rows) {
      if (predicate(r)) {
        await r.delete();
        deletedCount++;
        if (deletedCount > 1) {
          await new Promise(res => setTimeout(res, 120));
        }
      }
    }

    if (deletedCount > 0) {
      delete memoryCaches[tabName];
    }
    return deletedCount;
  });
}

export function invalidateCollectionCache(tabName: string): void {
  delete memoryCaches[tabName];
}
