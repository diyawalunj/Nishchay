/**
 * notes-db.ts — Firestore-backed persistent storage for Subject Notes.
 *
 * MIGRATION: Previously used Vercel /tmp JSON files (ephemeral, caused data loss).
 * Now uses Firebase Admin Firestore (permanent, cross-device, single source of truth).
 *
 * Collection: subjectNotes
 */

import admin from 'firebase-admin';

export interface SubjectNote {
  id: string;
  subjectId: string;
  subjectTitle: string;
  title: string;
  category?: string;
  url: string;
  driveFileId?: string;
  fileName: string;
  fileSize?: string;
  uploadedAt: string;
}

function getDb(): FirebaseFirestore.Firestore {
  return admin.firestore();
}

const CACHE_TTL_MS = 30_000;
let notesCache: { data: SubjectNote[]; expiresAt: number } | null = null;

function invalidateNotesCache() { notesCache = null; }

export async function getAllNotes(): Promise<SubjectNote[]> {
  if (notesCache && Date.now() < notesCache.expiresAt) return notesCache.data;
  const db = getDb();
  const snap = await db.collection('subjectNotes').orderBy('uploadedAt', 'desc').get();
  const notes = snap.docs.map(d => d.data() as SubjectNote);
  notesCache = { data: notes, expiresAt: Date.now() + CACHE_TTL_MS };
  return notes;
}

export async function getNotesBySubject(subjectId: string): Promise<SubjectNote[]> {
  const all = await getAllNotes();
  return all.filter(n => n.subjectId.toLowerCase() === subjectId.toLowerCase());
}

export async function getNoteById(id: string): Promise<SubjectNote | undefined> {
  const db = getDb();
  const snap = await db.collection('subjectNotes').doc(id).get();
  return snap.exists ? (snap.data() as SubjectNote) : undefined;
}

export async function saveNote(data: {
  subjectId: string;
  subjectTitle: string;
  title: string;
  category?: string;
  url: string;
  driveFileId?: string;
  fileName: string;
  fileSize?: string;
}): Promise<SubjectNote> {
  const db = getDb();
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
    uploadedAt: new Date().toISOString()
  };

  await db.collection('subjectNotes').doc(id).set(newNote);
  invalidateNotesCache();
  return newNote;
}

export async function deleteNote(id: string): Promise<boolean> {
  const db = getDb();
  const ref = db.collection('subjectNotes').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  invalidateNotesCache();
  return true;
}

export async function syncNotes(incomingNotes: SubjectNote[]): Promise<SubjectNote[]> {
  if (!Array.isArray(incomingNotes) || incomingNotes.length === 0) {
    return getAllNotes();
  }

  const db = getDb();
  let added = false;

  for (const note of incomingNotes) {
    if (!note || !note.id) continue;
    const ref = db.collection('subjectNotes').doc(note.id);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set(note);
      added = true;
    }
  }

  if (added) invalidateNotesCache();
  return getAllNotes();
}
