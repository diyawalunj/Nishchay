/**
 * pyq-db.ts — Persistent Cloud Database Storage for PYQ (Previous Year Questions).
 *
 * Backed by authenticated Google Cloud Storage (via cloud-db.ts).
 * Permanent, cross-device, single source of truth.
 * Survives container recycling, server restarts, and redeployments.
 */

import {
  fetchCollection,
  saveRecord,
  deleteRecord
} from './cloud-db';

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

export async function getAllPyqSessions(): Promise<Record<string, PyqSessionData>> {
  const sessions = await fetchCollection<PyqSessionData>(PYQ_TAB, PYQ_HEADERS);
  const dict: Record<string, PyqSessionData> = {};
  for (const s of sessions) {
    const key = s.sessionId || s.id;
    dict[key] = { ...s, id: key, sessionId: key };
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

  await saveRecord(PYQ_TAB, PYQ_HEADERS, sessionRecord, s => ({
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
  await saveRecord(PYQ_TAB, PYQ_HEADERS, sessionRecord, s => ({
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
    if (!session || !session.subjects) continue;
    const existing = all[sessionId];
    if (!existing) {
      await saveRecord(PYQ_TAB, PYQ_HEADERS, { ...session, id: sessionId, sessionId }, s => ({
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
        await saveRecord(PYQ_TAB, PYQ_HEADERS, existing, s => ({
          exam: s.exam,
          session: s.session,
          year: s.year,
          title: s.title
        }));
      }
    }
  }

  return getAllPyqSessions();
}
