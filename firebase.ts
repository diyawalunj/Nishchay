import type { User } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, collection, addDoc, serverTimestamp, getDoc, setDoc, doc, query, orderBy, getDocs, where, onSnapshot, limit, updateDoc, deleteDoc } from 'firebase/firestore';
import { app, firebaseConfig } from './firebase-app';
import { auth } from './firebase-auth';

export const db = (() => {
  try {
    // Use modern persistence API (replaces deprecated enableIndexedDbPersistence)
    return initializeFirestore(app, {
      localCache: persistentLocalCache({}),
    }, firebaseConfig.firestoreDatabaseId || '(default)');
  } catch (e) {
    // Fallback if persistence fails (e.g., multiple tabs)
    return getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
  }
})();

// Error Handling Spec for Firestore Operations
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ── Retry Wrapper ──
/** Retry a Firestore write operation with exponential backoff. */
export async function retryWrite<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Don't retry permission errors
      if (error?.code === 'permission-denied' || error?.code === 'unauthenticated') {
        throw error;
      }
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

export { app } from './firebase-app';
export {
  auth,
  checkIfAdmin,
  checkIfAdminAsync,
  googleProvider,
  isFirebaseConfigured,
  logout,
  onAuthStateChanged,
  signInWithGoogle
} from './firebase-auth';
export { serverTimestamp, collection, addDoc, doc, setDoc, getDoc, query, orderBy, getDocs, where, onSnapshot, limit, updateDoc, deleteDoc };
export type { User };
