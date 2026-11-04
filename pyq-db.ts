/**
 * pyq-db.ts — Persistent Cloud Database Storage for PYQ (Previous Year Questions).
 *
 * Backed by Firestore on Vercel and Google Sheets for local development.
 */

import {
  fetchCollection,
  saveRecord
} from './cloud-db';
import { readContentCollection, writeContentCollection } from './firestore-content';

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
  id: string; // matches sessionId for cloud-db interface
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

const PYQ_TAB = 'pyq_sessions';
const PYQ_HEADERS = ['id', 'exam', 'session', 'year', 'title', 'json', 'updatedAt'];
// Vercel's filesystem is ephemeral. Always use Firestore there so PYQ card
// links cannot be lost after a function restart or deployment.
const USE_FIRESTORE = Boolean(process.env.VERCEL) || process.env.USE_FIRESTORE_CONTENT !== 'false';
const BLOCKED_RECORD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isSafeSessionId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 160
    && !BLOCKED_RECORD_KEYS.has(value);
}

function createSessionRecord(): Record<string, PyqSessionData> {
  return Object.create(null) as Record<string, PyqSessionData>;
}

function setSessionRecord(
  target: Record<string, PyqSessionData>,
  sessionId: string,
  session: PyqSessionData
): void {
  if (!isSafeSessionId(sessionId)) return;
  Object.defineProperty(target, sessionId, {
    value: session,
    enumerable: true,
    configurable: true,
    writable: true
  });
}

export async function getAllPyqSessions(): Promise<Record<string, PyqSessionData>> {
  const sessions = USE_FIRESTORE
    ? await readContentCollection<PyqSessionData>(PYQ_TAB)
    : await fetchCollection<PyqSessionData>(PYQ_TAB, PYQ_HEADERS);
  const dict = createSessionRecord();
  for (const s of sessions) {
    const key = s.sessionId || s.id;
    if (isSafeSessionId(key)) {
      setSessionRecord(dict, key, { ...s, id: key, sessionId: key });
    }
  }

  return dict;
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
  const all = await getAllPyqSessions();
  const { sessionId, exam, session, year, title, subjectKey, fileType, url, driveFileId, fileName, fileSize } = params;
  if (!isSafeSessionId(sessionId)) throw new Error('Invalid PYQ session ID.');
  if (!['maths', 'gat', 'english', 'gs', 'afcat'].includes(subjectKey)) throw new Error('Invalid PYQ subject.');
  if (fileType !== 'paper' && fileType !== 'key') throw new Error('Invalid PYQ file type.');

  let sessionRecord: PyqSessionData = all[sessionId] || {
    id: sessionId,
    sessionId,
    exam,
    session,
    year,
    title,
    subjects: {},
    updatedAt: new Date().toISOString()
  };

  if (!sessionRecord.subjects) sessionRecord.subjects = {};
  if (!sessionRecord.subjects[subjectKey]) sessionRecord.subjects[subjectKey] = {};

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
  sessionRecord.id = sessionId;
  sessionRecord.sessionId = sessionId;

  if (USE_FIRESTORE) {
    setSessionRecord(all, sessionId, sessionRecord);
    await writeContentCollection(PYQ_TAB, Object.values(all));
  } else await saveRecord(PYQ_TAB, PYQ_HEADERS, sessionRecord, s => ({
    exam: s.exam,
    session: s.session,
    year: s.year,
    title: s.title
  }));

  return sessionRecord;
}

export async function deletePyqFileRecord(params: {
  sessionId: string;
  subjectKey: 'maths' | 'gat' | 'english' | 'gs' | 'afcat';
  fileType: 'paper' | 'key';
}): Promise<PyqSessionData | null> {
  const all = await getAllPyqSessions();
  const { sessionId, subjectKey, fileType } = params;
  if (!isSafeSessionId(sessionId)) return null;
  if (!['maths', 'gat', 'english', 'gs', 'afcat'].includes(subjectKey)) return null;
  if (fileType !== 'paper' && fileType !== 'key') return null;

  const sessionRecord = all[sessionId];
  if (!sessionRecord || !sessionRecord.subjects || !sessionRecord.subjects[subjectKey]) {
    return sessionRecord || null;
  }

  if (fileType === 'paper') {
    delete sessionRecord.subjects[subjectKey]!.paper;
  } else {
    delete sessionRecord.subjects[subjectKey]!.key;
  }

  sessionRecord.updatedAt = new Date().toISOString();
  if (USE_FIRESTORE) {
    await writeContentCollection(PYQ_TAB, Object.values(all));
  } else await saveRecord(PYQ_TAB, PYQ_HEADERS, sessionRecord, s => ({
    exam: s.exam,
    session: s.session,
    year: s.year,
    title: s.title
  }));

  return sessionRecord;
}

export async function syncPyqSessions(
  incomingSessions: Record<string, PyqSessionData>
): Promise<Record<string, PyqSessionData>> {
  if (!incomingSessions || typeof incomingSessions !== 'object') {
    return getAllPyqSessions();
  }

  const all = await getAllPyqSessions();
  for (const [sessionId, session] of Object.entries(incomingSessions)) {
    if (!isSafeSessionId(sessionId)) continue;
    if (!session || !session.subjects) continue;
    const existing = all[sessionId];
    if (!existing) {
      if (USE_FIRESTORE) {
        setSessionRecord(all, sessionId, { ...session, id: sessionId, sessionId });
      } else await saveRecord(PYQ_TAB, PYQ_HEADERS, { ...session, id: sessionId, sessionId }, s => ({
        exam: s.exam,
        session: s.session,
        year: s.year,
        title: s.title
      }));
    } else {
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
        if (USE_FIRESTORE) {
          setSessionRecord(all, sessionId, existing);
        } else await saveRecord(PYQ_TAB, PYQ_HEADERS, existing, s => ({
          exam: s.exam,
          session: s.session,
          year: s.year,
          title: s.title
        }));
      }
    }
  }

  if (USE_FIRESTORE) await writeContentCollection(PYQ_TAB, Object.values(all));
  return getAllPyqSessions();
}
