/**
 * pyq-db.ts — Firestore-backed persistent storage for PYQ (Previous Year Questions).
 *
 * MIGRATION: Previously used Vercel /tmp JSON files (ephemeral, caused data loss).
 * Now uses Firebase Admin Firestore (permanent, cross-device, single source of truth).
 *
 * Collection: pyqSessions
 */

import admin from 'firebase-admin';

export interface PyqFileItem {
  url: string;
  driveFileId?: string;
  fileName: string;
  fileSize?: string;
  uploadedAt: string;
}

export interface PyqSubjectSlot {
  paper?: PyqFileItem;
  key?: PyqFileItem;
}

export interface PyqSessionData {
  sessionId: string; // e.g. "nda-2-2026", "afcat-1-2025"
  exam: 'NDA' | 'CDS' | 'AFCAT';
  session: 'I' | 'II';
  year: number;
  title: string;
  subjects: {
    maths?: PyqSubjectSlot;
    gat?: PyqSubjectSlot;
    english?: PyqSubjectSlot;
    gs?: PyqSubjectSlot;
    afcat?: PyqSubjectSlot;
  };
  updatedAt: string;
}

function getDb(): FirebaseFirestore.Firestore {
  return admin.firestore();
}

const CACHE_TTL_MS = 30_000;
let pyqCache: { data: Record<string, PyqSessionData>; expiresAt: number } | null = null;

function invalidatePyqCache() { pyqCache = null; }

export async function getAllPyqSessions(): Promise<Record<string, PyqSessionData>> {
  if (pyqCache && Date.now() < pyqCache.expiresAt) return pyqCache.data;
  const db = getDb();
  const snap = await db.collection('pyqSessions').get();
  const sessions: Record<string, PyqSessionData> = {};
  for (const doc of snap.docs) {
    const data = doc.data() as PyqSessionData;
    sessions[data.sessionId] = data;
  }
  pyqCache = { data: sessions, expiresAt: Date.now() + CACHE_TTL_MS };
  return sessions;
}

export async function savePyqFileRecord(params: {
  sessionId: string;
  exam: 'NDA' | 'CDS' | 'AFCAT';
  session: 'I' | 'II';
  year: number;
  title: string;
  subjectKey: 'maths' | 'gat' | 'english' | 'gs' | 'afcat';
  fileType: 'paper' | 'key';
  url: string;
  driveFileId?: string;
  fileName: string;
  fileSize?: string;
}): Promise<PyqSessionData> {
  const db = getDb();
  const { sessionId, exam, session, year, title, subjectKey, fileType, url, driveFileId, fileName, fileSize } = params;

  const ref = db.collection('pyqSessions').doc(sessionId);
  const snap = await ref.get();

  let sessionRecord: PyqSessionData = snap.exists
    ? (snap.data() as PyqSessionData)
    : { sessionId, exam, session, year, title, subjects: {}, updatedAt: new Date().toISOString() };

  if (!sessionRecord.subjects[subjectKey]) {
    sessionRecord.subjects[subjectKey] = {};
  }

  const fileItem: PyqFileItem = {
    url,
    driveFileId,
    fileName,
    fileSize: fileSize || 'PDF Document',
    uploadedAt: new Date().toISOString()
  };

  if (fileType === 'paper') {
    sessionRecord.subjects[subjectKey]!.paper = fileItem;
  } else {
    sessionRecord.subjects[subjectKey]!.key = fileItem;
  }

  sessionRecord.updatedAt = new Date().toISOString();
  await ref.set(sessionRecord, { merge: true });
  invalidatePyqCache();
  return sessionRecord;
}

export async function deletePyqFileRecord(params: {
  sessionId: string;
  subjectKey: 'maths' | 'gat' | 'english' | 'gs' | 'afcat';
  fileType: 'paper' | 'key';
}): Promise<PyqSessionData | null> {
  const db = getDb();
  const { sessionId, subjectKey, fileType } = params;

  const ref = db.collection('pyqSessions').doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const sessionRecord = snap.data() as PyqSessionData;
  if (!sessionRecord.subjects[subjectKey]) return sessionRecord;

  if (fileType === 'paper') {
    delete sessionRecord.subjects[subjectKey]!.paper;
  } else {
    delete sessionRecord.subjects[subjectKey]!.key;
  }

  sessionRecord.updatedAt = new Date().toISOString();
  await ref.set(sessionRecord, { merge: true });
  invalidatePyqCache();
  return sessionRecord;
}

export async function syncPyqSessions(
  incomingSessions: Record<string, PyqSessionData>
): Promise<Record<string, PyqSessionData>> {
  if (!incomingSessions || typeof incomingSessions !== 'object') {
    return getAllPyqSessions();
  }

  const db = getDb();
  let changed = false;

  for (const [sessionId, session] of Object.entries(incomingSessions)) {
    if (!session || !session.subjects) continue;
    const ref = db.collection('pyqSessions').doc(sessionId);
    const snap = await ref.get();

    if (!snap.exists) {
      await ref.set(session);
      changed = true;
    } else {
      const existing = snap.data() as PyqSessionData;
      let updated = false;
      for (const key of ['maths', 'gat', 'english', 'gs', 'afcat'] as const) {
        const incSlot = session.subjects[key];
        if (!incSlot) continue;
        if (!existing.subjects[key]) {
          existing.subjects[key] = {};
          updated = true;
        }
        if (incSlot.paper && !existing.subjects[key]!.paper) {
          existing.subjects[key]!.paper = incSlot.paper;
          updated = true;
        }
        if (incSlot.key && !existing.subjects[key]!.key) {
          existing.subjects[key]!.key = incSlot.key;
          updated = true;
        }
      }
      if (updated) {
        existing.updatedAt = new Date().toISOString();
        await ref.set(existing, { merge: true });
        changed = true;
      }
    }
  }

  if (changed) invalidatePyqCache();
  return getAllPyqSessions();
}
