import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import { app, isFirebaseConfigured } from './firebase-app';
import { ADMIN_EMAILS } from './admin-emails';

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/** Synchronous fallback for immediate UI decisions. */
export const checkIfAdmin = (user: User | null) => {
  if (!user || !user.email || !user.emailVerified) return false;
  const email = user.email.trim().toLowerCase();
  return ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === email);
};

/** The token claim is authoritative; email is a synchronous UI fallback. */
export const checkIfAdminAsync = async (user: User | null): Promise<boolean> => {
  if (!user) return false;
  try {
    const token = await user.getIdTokenResult();
    if (token.claims.admin === true) return true;
  } catch (error) {
    if (import.meta.env.DEV) console.warn('Could not verify admin claim; using local admin fallback.');
  }
  return checkIfAdmin(user);
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Keep Firestore out of the initial navigation bundle; load it only after
    // a user signs in and profile synchronization is actually needed.
    try {
      const { db, doc, getDoc, setDoc } = await import('./firebase');
      const userRef = doc(db, 'users', user.uid);
      let userDoc;
      try {
        userDoc = await getDoc(userRef);
      } catch {
        if (import.meta.env.DEV) console.warn('Could not fetch the signed-in user profile.');
      }

      if (!userDoc?.exists()) {
        try {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: checkIfAdmin(user) ? 'admin' : 'user'
          }, { merge: true });
        } catch {
          if (import.meta.env.DEV) console.error('Could not sync the signed-in user profile.');
        }
      }
    } catch {
      if (import.meta.env.DEV) console.warn('Could not load Firestore to sync the signed-in profile.');
    }

    return user;
  } catch (error: any) {
    if (import.meta.env.DEV) console.error('Sign-in failed with Firebase error code:', error?.code || 'unknown');

    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      return null;
    } else if (error?.code === 'auth/popup-blocked') {
      throw new Error('Sign-in popup was blocked by your browser. Please allow popups for this site.');
    } else if (error?.code === 'auth/unauthorized-domain') {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
      throw new Error(`Domain "${currentHost}" is not authorized in Firebase Console. Please add "${currentHost}" under Firebase Console -> Authentication -> Settings -> Authorized domains.`);
    } else if (error?.code === 'auth/operation-not-allowed') {
      throw new Error('Google Sign-In is disabled in Firebase. Please enable Google provider in Firebase Console -> Authentication -> Sign-in method.');
    } else if (error?.code === 'auth/configuration-not-found') {
      throw new Error('Google Sign-In configuration not found in Firebase. Please enable Google under Authentication in Firebase Console.');
    } else if (error?.code === 'auth/invalid-api-key') {
      throw new Error('Firebase API key is invalid or restricted. Please check your Firebase project configuration.');
    } else if (error?.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your internet connection and try again.');
    } else if (error?.message && (error.message.includes('Cross-Origin-Opener-Policy') || error.message.includes('COOP'))) {
      throw new Error('Browser cross-origin security blocked the sign-in popup. Please refresh the page and try again.');
    }

    throw new Error(error?.message || 'Something went wrong during sign-in. Please try again.');
  }
};

export const logout = () => signOut(auth);

export { isFirebaseConfigured, onAuthStateChanged };
export type { User };
