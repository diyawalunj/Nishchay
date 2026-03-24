import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp, getDoc, setDoc, doc, query, orderBy, getDocs, where, onSnapshot, limit, updateDoc, deleteDoc } from 'firebase/firestore';

import firebaseConfig from './firebase-applet-config.json';

// Firebase is now configured with the user's real API key
export const isFirebaseConfigured = true;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// @ts-ignore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
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

export const ADMIN_EMAILS = [
  "diyawalunj@gmail.com",
  "vedantranjeetjadhav@gmail.com",
  "abhijeetgaikwad1904@gmail.com",
  "muthalrishikesh2006@gmail.com",
  "adityasahane076@gmail.com"
];

export const checkIfAdmin = (user: User | null) => {
  if (!user || !user.email) return false;
  return ADMIN_EMAILS.includes(user.email);
};

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
