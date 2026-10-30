// Shared TypeScript interfaces for Firestore and N-INTEL data models
// Single source of truth — import from here instead of redefining in each component

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: any;
}

// ── N-INTEL News Models ──

export const NINTEL_CORE_CATEGORIES = [
  'Defence News',
  'International Relations',
  'Important Appointments',
  'National Affairs',
  'Polity & Judiciary',
  'World News',
  'Sports',
] as const;

export type NIntelCategory = string;

export interface NIntelStory {
  id: string;
  batchId: string;
  headline: string;
  content: string;
  category: string;
  categoryKey: string;
  date: string; // YYYY-MM-DD
  itemNumber?: number;
  sourceName?: string;
  sourceUrl?: string;
  tags: string[];
  isDefence: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
  lastEditedBy?: string;
}

export interface NIntelBatch {
  id: string;
  date: string; // YYYY-MM-DD
  rawContentHash: string;
  publishedAt: string;
  publishedBy: string;
  storyCount: number;
  categories: string[];
}

export interface NIntelAuditLog {
  id: string;
  action: 'PUBLISH' | 'EDIT' | 'DELETE' | 'RESTORE';
  storyId?: string;
  batchId?: string;
  adminEmail: string;
  timestamp: string;
  details: string;
}

// Firestore collection path constants — prevents typos and centralizes paths
export const COLLECTIONS = {
  USERS: 'users',
  NINTEL_STORIES: 'nintel_stories',
  NINTEL_BATCHES: 'nintel_batches',
  NINTEL_AUDIT: 'nintel_audit',
} as const;
