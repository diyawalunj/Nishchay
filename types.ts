// Shared TypeScript interfaces for Firestore data models
// Single source of truth — import from here instead of redefining in each component

export interface Doubt {
  id: string;
  uid: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: any;
  status: 'pending' | 'resolved';
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  isAdmin: boolean;
  createdAt: any;
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: any;
}

// Firestore collection path constants — prevents typos and centralizes paths
export const COLLECTIONS = {
  USERS: 'users',
  DOUBTS: 'doubts',
  doubtMessages: (doubtId: string) => `doubts/${doubtId}/messages`,
} as const;
