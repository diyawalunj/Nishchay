import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, collection, addDoc, serverTimestamp, getDoc, setDoc, doc, query, orderBy, getDocs, where, onSnapshot, limit, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { ADMIN_EMAILS } from './admin-emails';

// Firebase client settings are supplied through Vite environment variables.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID
};

// Firebase is now configured with the user's real API key
export const isFirebaseConfigured = true;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
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

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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

// ── Admin Check ──
// Private list — only used for initial role assignment during sign-up.
// The actual authorization enforcement is performed by Firestore Security Rules and Firebase Custom Claims.
/** Synchronous fallback — checks email list. Use for fast routing decisions only. */
export const checkIfAdmin = (user: User | null) => {
  if (!user || !user.email || !user.emailVerified) return false;
  const email = user.email.trim().toLowerCase();
  return ADMIN_EMAILS.some(e => e.toLowerCase() === email);
};

/**
 * Async admin check — reads the Firebase Custom Claim `admin === true` from the ID token.
 * Authoritative client-side source for UI display decisions.
 */
export const checkIfAdminAsync = async (user: User | null): Promise<boolean> => {
  if (!user) return false;
  try {
    const token = await user.getIdTokenResult();
    if (token && token.claims && token.claims.admin === true) {
      return true;
    }
  } catch (e) {
    console.warn('Could not verify admin claim from token, checking email fallback', e);
  }
  return checkIfAdmin(user);
};

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

// Auth Helpers
export const signInWithGoogle = async () => {
  try {
    // Ensure we don't have multiple popups opening
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Sync user to Firestore
    const userRef = doc(db, 'users', user.uid);
    let userDoc;
    try {
      userDoc = await getDoc(userRef);
    } catch (e) {
      // If we can't read the doc (e.g. rules), we still have the user object
      console.warn("Could not fetch user doc, might be a new user or rules issue", e);
    }

    if (!userDoc?.exists()) {
      try {
        const isAdmin = checkIfAdmin(user);
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: isAdmin ? 'admin' : 'user'
        }, { merge: true });
      } catch (e) {
        console.error("Failed to sync user to Firestore", e);
      }
    }

    return user;
  } catch (error: any) {
    console.error('Sign-in error details:', error?.code, error?.message, error);

    // Handle specific Firebase Auth errors
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      // User closed the popup or clicked sign-in twice — not an error, just ignore
      return null;
    } else if (error?.code === 'auth/popup-blocked') {
      throw new Error("Sign-in popup was blocked by your browser. Please allow popups for this site.");
    } else if (error?.code === 'auth/unauthorized-domain') {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
      throw new Error(`Domain "${currentHost}" is not authorized in Firebase Console. Please add "${currentHost}" under Firebase Console -> Authentication -> Settings -> Authorized domains.`);
    } else if (error?.code === 'auth/operation-not-allowed') {
      throw new Error("Google Sign-In is disabled in Firebase. Please enable Google provider in Firebase Console -> Authentication -> Sign-in method.");
    } else if (error?.code === 'auth/configuration-not-found') {
      throw new Error("Google Sign-In configuration not found in Firebase. Please enable Google under Authentication in Firebase Console.");
    } else if (error?.code === 'auth/invalid-api-key') {
      throw new Error("Firebase API key is invalid or restricted. Please check your Firebase project configuration.");
    } else if (error?.code === 'auth/network-request-failed') {
      throw new Error("Network error. Please check your internet connection and try again.");
    } else if (error?.message && (error.message.includes('Cross-Origin-Opener-Policy') || error.message.includes('COOP'))) {
      throw new Error("Browser cross-origin security blocked the sign-in popup. Please refresh the page and try again.");
    }

    throw new Error(error?.message || "Something went wrong during sign-in. Please try again.");
  }
};

export const logout = () => signOut(auth);

export { onAuthStateChanged, serverTimestamp, collection, addDoc, doc, setDoc, getDoc, query, orderBy, getDocs, where, onSnapshot, limit, updateDoc, deleteDoc };
export type { User };
