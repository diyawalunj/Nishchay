/**
 * notes-db.ts — Persistent Cloud Database Storage for Subject Notes.
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

const NOTES_TAB = 'subject_notes';
const NOTES_HEADERS = ['id', 'subjectId', 'subjectTitle', 'title', 'url', 'json', 'uploadedAt'];

export async function getAllNotes(): Promise<SubjectNote[]> {
  const notes = await fetchCollection<SubjectNote>(NOTES_TAB, NOTES_HEADERS);
  return [...notes].sort(
    (a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
  );
}

export async function getNotesBySubject(subjectId: string): Promise<SubjectNote[]> {
  const all = await getAllNotes();
  return all.filter(n => n.subjectId.toLowerCase() === subjectId.toLowerCase());
}

export async function getNoteById(id: string): Promise<SubjectNote | undefined> {
  const all = await getAllNotes();
  return all.find(n => n.id === id);
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

  await saveRecord(NOTES_TAB, NOTES_HEADERS, newNote, n => ({
    subjectId: n.subjectId,
    subjectTitle: n.subjectTitle,
    title: n.title,
    url: n.url,
    uploadedAt: n.uploadedAt
  }));

  return newNote;
}

export async function deleteNote(id: string): Promise<boolean> {
  return deleteRecord(NOTES_TAB, NOTES_HEADERS, id);
}

export async function syncNotes(incomingNotes: SubjectNote[]): Promise<SubjectNote[]> {
  if (!Array.isArray(incomingNotes) || incomingNotes.length === 0) {
    return getAllNotes();
  }

  const existing = await getAllNotes();
  const existingMap = new Map<string, boolean>();
  for (const n of existing) existingMap.set(n.id, true);

  for (const note of incomingNotes) {
    if (note && note.id && !existingMap.has(note.id)) {
      await saveRecord(NOTES_TAB, NOTES_HEADERS, note, n => ({
        subjectId: n.subjectId,
        subjectTitle: n.subjectTitle,
        title: n.title,
        url: n.url,
        uploadedAt: n.uploadedAt
      }));
    }
  }

  return getAllNotes();
}
