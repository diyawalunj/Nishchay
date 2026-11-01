import fs from 'fs';
import path from 'path';
import os from 'os';

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
  sessionId: string; // e.g. "nda-2-2026"
  exam: 'NDA' | 'CDS';
  session: 'I' | 'II';
  year: number;
  title: string;
  subjects: {
    maths?: PyqSubjectSlot;
    gat?: PyqSubjectSlot;
    english?: PyqSubjectSlot;
    gs?: PyqSubjectSlot;
  };
  updatedAt: string;
}

const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL ? path.join(os.tmpdir(), 'nishchay_data') : path.join(process.cwd(), 'data');
const SEED_DATA_DIR = path.join(process.cwd(), 'data');
const PYQ_FILE = path.join(DATA_DIR, 'pyq-papers.json');
const SEED_PYQ_FILE = path.join(SEED_DATA_DIR, 'pyq-papers.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not ensure data directory:', err);
  }
}

let pyqCache: Record<string, PyqSessionData> | null = null;

export function getAllPyqSessions(): Record<string, PyqSessionData> {
  if (pyqCache) {
    return pyqCache;
  }

  ensureDataDir();

  let targetFile = PYQ_FILE;
  if (!fs.existsSync(targetFile) && fs.existsSync(SEED_PYQ_FILE)) {
    targetFile = SEED_PYQ_FILE;
  }

  if (!fs.existsSync(targetFile)) {
    pyqCache = {};
    return pyqCache;
  }

  try {
    const raw = fs.readFileSync(targetFile, 'utf-8');
    pyqCache = JSON.parse(raw);
    return pyqCache || {};
  } catch (err) {
    console.error('Failed to parse pyq-papers.json, fallback to empty:', err);
    pyqCache = {};
    return pyqCache;
  }
}

function persistPyqData(data: Record<string, PyqSessionData>) {
  ensureDataDir();
  pyqCache = data;
  try {
    const tempFile = `${PYQ_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, PYQ_FILE);
  } catch (err) {
    console.warn('Could not write pyq-papers.json to disk:', err);
  }
}

export function savePyqFileRecord(params: {
  sessionId: string;
  exam: 'NDA' | 'CDS';
  session: 'I' | 'II';
  year: number;
  title: string;
  subjectKey: 'maths' | 'gat' | 'english' | 'gs';
  fileType: 'paper' | 'key';
  url: string;
  driveFileId?: string;
  fileName: string;
  fileSize?: string;
}): PyqSessionData {
  const all = getAllPyqSessions();
  const { sessionId, exam, session, year, title, subjectKey, fileType, url, driveFileId, fileName, fileSize } = params;

  if (!all[sessionId]) {
    all[sessionId] = {
      sessionId,
      exam,
      session,
      year,
      title,
      subjects: {},
      updatedAt: new Date().toISOString(),
    };
  }

  const sessionRecord = all[sessionId];
  if (!sessionRecord.subjects[subjectKey]) {
    sessionRecord.subjects[subjectKey] = {};
  }

  const fileItem: PyqFileItem = {
    url,
    driveFileId,
    fileName,
    fileSize: fileSize || 'PDF Document',
    uploadedAt: new Date().toISOString(),
  };

  if (fileType === 'paper') {
    sessionRecord.subjects[subjectKey]!.paper = fileItem;
  } else {
    sessionRecord.subjects[subjectKey]!.key = fileItem;
  }

  sessionRecord.updatedAt = new Date().toISOString();
  persistPyqData(all);
  return sessionRecord;
}

export function deletePyqFileRecord(params: {
  sessionId: string;
  subjectKey: 'maths' | 'gat' | 'english' | 'gs';
  fileType: 'paper' | 'key';
}): PyqSessionData | null {
  const all = getAllPyqSessions();
  const { sessionId, subjectKey, fileType } = params;

  const sessionRecord = all[sessionId];
  if (!sessionRecord || !sessionRecord.subjects[subjectKey]) {
    return sessionRecord || null;
  }

  if (fileType === 'paper') {
    delete sessionRecord.subjects[subjectKey]!.paper;
  } else {
    delete sessionRecord.subjects[subjectKey]!.key;
  }

  sessionRecord.updatedAt = new Date().toISOString();
  persistPyqData(all);
  return sessionRecord;
}
