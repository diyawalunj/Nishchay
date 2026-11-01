import fs from 'fs';
import path from 'path';
import os from 'os';

export interface SubjectNote {
  id: string; // e.g. "note-1730000000000"
  subjectId: string; // e.g. "maths", "english", "physics"
  subjectTitle: string; // e.g. "Mathematics"
  title: string; // Note display title
  category?: string; // Optional chapter / topic name
  url: string; // File URL (e.g. /uploads/notes/filename.pdf or Google Drive link)
  driveFileId?: string; // Optional Google Drive File ID
  fileName: string;
  fileSize?: string;
  uploadedAt: string;
}

const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL ? path.join(os.tmpdir(), 'nishchay_data') : path.join(process.cwd(), 'data');
const SEED_DATA_DIR = path.join(process.cwd(), 'data');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const SEED_NOTES_FILE = path.join(SEED_DATA_DIR, 'notes.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not ensure data directory:', err);
  }
}

let notesCache: SubjectNote[] | null = null;

export function getAllNotes(): SubjectNote[] {
  if (notesCache) {
    return notesCache;
  }

  ensureDataDir();

  // On Vercel, read from /tmp first, fallback to seeded repository data
  let targetFile = NOTES_FILE;
  if (!fs.existsSync(targetFile) && fs.existsSync(SEED_NOTES_FILE)) {
    targetFile = SEED_NOTES_FILE;
  }

  if (!fs.existsSync(targetFile)) {
    notesCache = [];
    return notesCache;
  }

  try {
    const raw = fs.readFileSync(targetFile, 'utf-8');
    notesCache = JSON.parse(raw);
    return notesCache || [];
  } catch (err) {
    console.error('Failed to parse notes.json, fallback to empty list:', err);
    notesCache = [];
    return notesCache;
  }
}

export function getNotesBySubject(subjectId: string): SubjectNote[] {
  const all = getAllNotes();
  return all.filter((n) => n.subjectId.toLowerCase() === subjectId.toLowerCase());
}

export function getNoteById(id: string): SubjectNote | undefined {
  const all = getAllNotes();
  return all.find((n) => n.id === id);
}

function persistNotes(notes: SubjectNote[]) {
  ensureDataDir();
  notesCache = notes;
  try {
    const tempFile = `${NOTES_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(notes, null, 2), 'utf-8');
    fs.renameSync(tempFile, NOTES_FILE);
  } catch (err) {
    console.warn('Could not write notes.json to disk:', err);
  }
}

export function saveNote(data: {
  subjectId: string;
  subjectTitle: string;
  title: string;
  category?: string;
  url: string;
  driveFileId?: string;
  fileName: string;
  fileSize?: string;
}): SubjectNote {
  const all = getAllNotes();
  const id = `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newNote: SubjectNote = {
    id,
    subjectId: data.subjectId.toLowerCase(),
    subjectTitle: data.subjectTitle,
    title: data.title.trim(),
    category: data.category?.trim() || undefined,
    url: data.url,
    driveFileId: data.driveFileId,
    fileName: data.fileName,
    fileSize: data.fileSize || 'PDF Document',
    uploadedAt: new Date().toISOString(),
  };

  all.unshift(newNote); // newest first
  persistNotes(all);
  return newNote;
}

export function deleteNote(id: string): boolean {
  const all = getAllNotes();
  const index = all.findIndex((n) => n.id === id);
  if (index === -1) return false;

  all.splice(index, 1);
  persistNotes(all);
  return true;
}
