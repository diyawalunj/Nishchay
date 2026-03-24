import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, collection, addDoc, serverTimestamp, getDoc, setDoc, doc, query, orderBy, getDocs, where, onSnapshot, limit, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfigJson from './firebase-applet-config.json';

// Use environment variables if available (for Vercel/Production), otherwise fallback to JSON
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigJson.measurementId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId
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
    // @ts-ignore
    return getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
  }
})();

export const googleProvider = new GoogleAuthProvider();

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
// The actual admin check reads from Firestore.
const ADMIN_EMAILS = [
  "diyawalunj@gmail.com",
  "vedantranjeetjadhav@gmail.com",
  "abhijeetgaikwad1904@gmail.com",
  "muthalrishikesh2006@gmail.com",
  "adityasahane076@gmail.com"
];

/** Synchronous fallback — checks email list. Use for fast routing decisions only. */
export const checkIfAdmin = (user: User | null) => {
  if (!user || !user.email) return false;
  return ADMIN_EMAILS.includes(user.email);
};

/** Async admin check — reads role from Firestore `users/{uid}`. Authoritative source. */
export const checkIfAdminAsync = async (user: User | null): Promise<boolean> => {
  if (!user) return false;
  // Fast path: check email first
  if (checkIfAdmin(user)) return true;
  // Authoritative path: check Firestore role
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    return userDoc.exists() && userDoc.data()?.role === 'admin';
  } catch (e) {
    console.warn('Could not verify admin role from Firestore, falling back to email check', e);
    return checkIfAdmin(user);
  }
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

// ── Subcollection Cleanup ──
/** Delete a doubt and all its messages in one batch. */
export async function deleteDoubtWithMessages(doubtId: string): Promise<void> {
  // Fetch all messages in the subcollection
  const messagesSnap = await getDocs(collection(db, `doubts/${doubtId}/messages`));
  
  // Firestore batches are limited to 500 ops — fine for typical chat threads
  const batch = writeBatch(db);
  messagesSnap.docs.forEach(msgDoc => {
    batch.delete(msgDoc.ref);
  });
  batch.delete(doc(db, 'doubts', doubtId));
  
  await batch.commit();
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
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/popup-blocked') {
      throw new Error("Sign-in popup was blocked by your browser. Please allow popups for this site.");
    } else if (error.code === 'auth/configuration-not-found') {
      throw new Error("Google Sign-In is not enabled in the Firebase Console. Please enable it under Authentication > Sign-in method.");
    } else if (error.code === 'auth/cancelled-popup-request') {
      // This happens if user clicks twice quickly, we can ignore the second one
      return null;
    }
    throw error;
  }
};

export const logout = () => signOut(auth);

export { onAuthStateChanged, serverTimestamp, collection, addDoc, doc, setDoc, getDoc, query, orderBy, getDocs, where, onSnapshot, limit, updateDoc, deleteDoc };
export type { User };
