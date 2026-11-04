import admin from 'firebase-admin';

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { expiresAt: number; records: { id: string }[] }>();

function cloneRecords<T extends { id: string }>(records: T[]): T[] {
  return records.map(record => ({ ...record }));
}

function canonical(record: Record<string, unknown>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b))));
}

// Firestore rejects `undefined` values unless the Admin SDK is configured to
// ignore them. Optional fields from parsers (for example, a story without a
// source URL) and audit entries can legitimately be undefined, so strip those
// fields at the persistence boundary instead of failing the whole write.
export function omitUndefinedFirestoreValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => item === undefined ? null : omitUndefinedFirestoreValues(item));
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .map(([key, child]) => [key, omitUndefinedFirestoreValues(child)])
    );
  }
  return value;
}

function firestore() {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin is not initialized; configure a Firestore service account before using persistent content storage.');
  }
  return admin.firestore();
}

function docId(id: string): string {
  return encodeURIComponent(id);
}

export async function readContentCollection<T extends { id: string }>(name: string): Promise<T[]> {
  const cached = cache.get(name);
  if (cached && cached.expiresAt > Date.now()) return cached.records as T[];
  const snapshot = await firestore().collection(name).get();
  const records = snapshot.docs.map(doc => ({ ...doc.data(), id: String(doc.data().id || decodeURIComponent(doc.id)) })) as T[];
  cache.set(name, { records: cloneRecords(records), expiresAt: Date.now() + CACHE_TTL_MS });
  return cloneRecords(records);
}

export async function writeContentCollection<T extends { id: string }>(
  name: string,
  records: T[],
  deletedIds: string[] = []
): Promise<void> {
  const collection = firestore().collection(name);
  let baseline = cache.get(name)?.records;
  if (!baseline) baseline = await readContentCollection<T>(name);
  const existing = new Map(baseline.map(record => [docId(record.id), record]));
  const writer = firestore().bulkWriter();
  for (const record of records) {
    const ref = collection.doc(docId(record.id));
    const old = existing.get(ref.id);
    if (!old || canonical(old) !== canonical(record)) {
      writer.set(ref, omitUndefinedFirestoreValues(record) as T);
    }
  }
  for (const id of new Set(deletedIds)) writer.delete(collection.doc(docId(id)));
  await writer.close();
  cache.set(name, { records: cloneRecords(records), expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateContentCollection(name: string): void {
  cache.delete(name);
}
