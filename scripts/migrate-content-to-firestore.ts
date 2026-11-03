import 'dotenv/config';
import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { fetchCollection } from '../cloud-db';
import type { Article } from '../articles-db';
import type { NIntelStory, NIntelBatch, NIntelAuditLog } from '../types';
import type { SubjectNote } from '../notes-db';
import type { PyqSessionData } from '../pyq-db';

function readJson<T>(filename: string, fallback: T): T {
  const fullPath = path.join(process.cwd(), 'data', filename);
  if (!fs.existsSync(fullPath)) return fallback;
  return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as T;
}

function firestoreId(id: string): string {
  return encodeURIComponent(id);
}

async function mergeMissing<T extends { id: string }>(collectionName: string, records: T[]) {
  const collection = admin.firestore().collection(collectionName);
  const existing = await collection.get();
  const existingById = new Map(existing.docs.map(doc => [
    String(doc.data().id || decodeURIComponent(doc.id)),
    doc.data()
  ]));
  const writer = admin.firestore().bulkWriter();
  let added = 0;
  let updated = 0;
  for (const record of records) {
    if (!record?.id) continue;
    const ref = collection.doc(firestoreId(record.id));
    const current = existingById.get(record.id);
    if (!current) {
      writer.create(ref, record);
      added++;
    } else if (collectionName === 'pyq_sessions') {
      const merged = { ...record, ...current, id: record.id } as Record<string, any>;
      const currentSubjects = current.subjects || {};
      const incomingSubjects = (record as any).subjects || {};
      const subjects: Record<string, any> = { ...incomingSubjects };
      let changed = false;
      for (const key of ['maths', 'gat', 'english', 'gs', 'afcat']) {
        const incomingSlot = incomingSubjects[key] || {};
        const existingSlot = currentSubjects[key] || {};
        subjects[key] = { ...incomingSlot, ...existingSlot };
        for (const fileType of ['paper', 'key']) {
          if (!existingSlot[fileType] && incomingSlot[fileType]) changed = true;
        }
      }
      if (changed) {
        merged.subjects = subjects;
        writer.set(ref, merged);
        updated++;
      }
    }
  }
  await writer.close();
  return { existing: existing.size, added, updated };
}

async function main() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  const email = process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;
  if (!projectId || !email || !rawKey) {
    throw new Error('Set VITE_FIREBASE_PROJECT_ID and a service account email/private key before migration.');
  }
  // Accept the common .env formats: escaped newlines, a quoted multiline PEM,
  // or a PEM value pasted with the trailing comma from a service-account JSON.
  const privateKey = rawKey
    .trim()
    .replace(/,$/, '')
    .replace(/^(["'])([\s\S]*)\1$/, '$2')
    .replace(/\\n/g, '\n')
    .trim();
  admin.initializeApp({
    projectId,
    credential: admin.credential.cert({ projectId, clientEmail: email, privateKey }),
  });

  const stories = readJson<NIntelStory[]>('n-intel-stories.json', []);
  const batches = readJson<NIntelBatch[]>('n-intel-batches.json', []);
  const audit = readJson<NIntelAuditLog[]>('n-intel-audit.json', []);
  const articles = readJson<Article[]>('articles.json', []);
  const notes = await fetchCollection<SubjectNote>('subject_notes', ['id', 'subjectId', 'subjectTitle', 'title', 'url', 'json', 'uploadedAt'], { strict: true });
  let pyq = await fetchCollection<PyqSessionData>('pyq_sessions', ['id', 'exam', 'session', 'year', 'title', 'json', 'updatedAt'], { strict: true });
  if (pyq.length === 0) {
    const seeded = readJson<Record<string, PyqSessionData>>('pyq-papers.json', {});
    pyq = Object.entries(seeded).map(([id, record]) => ({ ...record, id, sessionId: id }));
  }

  const sources = { nintel_stories: stories, nintel_batches: batches, nintel_audit: audit, articles, subject_notes: notes, pyq_sessions: pyq };
  const backupName = `firestore-migration-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(path.join(process.cwd(), 'data', backupName), JSON.stringify(sources, null, 2), 'utf8');

  const results: Record<string, { existing: number; added: number }> = {};
  for (const [name, records] of Object.entries(sources)) {
    results[name] = await mergeMissing(name, records as { id: string }[]);
  }
  process.stdout.write(JSON.stringify({ projectId, backupName, results }, null, 2));
  await admin.app().delete();
}

main().catch(async error => {
  process.stderr.write(`${error.code || error.name}: ${error.message}\n`);
  if (admin.apps.length) await admin.app().delete();
  process.exitCode = 1;
});
