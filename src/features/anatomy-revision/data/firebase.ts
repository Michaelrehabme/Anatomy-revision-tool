import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, type Firestore } from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithCredential,
  linkWithPopup,
  linkWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type Auth,
  type User,
  type AuthCredential,
  type AuthError,
  type Unsubscribe,
} from 'firebase/auth';

/**
 * Lazily-initialised Firebase singletons. This module is only imported when
 * VITE_PERSISTENCE=firestore (see data/repository.ts's dynamic import) or
 * when AuthProvider needs auth — "local" mode never pulls the
 * Firebase SDK into the bundle at runtime cost.
 */
let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let auth: Auth | null = null;

function getFirebaseApp(): FirebaseApp {
  if (app) return app;

  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  if (!config.apiKey || !config.projectId) {
    throw new Error(
      'Firebase config missing. Set VITE_FIREBASE_* env vars (see .env.example) before using VITE_PERSISTENCE=firestore.',
    );
  }

  app = initializeApp(config);
  return app;
}

export function getDb(): Firestore {
  if (!firestore) firestore = getFirestore(getFirebaseApp());
  return firestore;
}

export function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(getFirebaseApp());
  return auth;
}

/**
 * Silently signs the current visitor in anonymously (no login UI) and
 * resolves with their uid once ready. Anonymous Auth is used instead of a
 * hand-rolled client-generated UUID so Firestore security rules can check
 * `request.auth.uid` rather than trusting a client-supplied id.
 */
export function ensureAnonymousUser(): Promise<User> {
  const authInstance = getFirebaseAuth();
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      authInstance,
      (user) => {
        if (user) {
          unsubscribe();
          resolve(user);
        }
      },
      reject,
    );
    if (!authInstance.currentUser) {
      signInAnonymously(authInstance).catch(reject);
    }
  });
}

/** Thin wrapper so AuthProvider never needs a static `firebase/auth` import (keeps local-mode bundle Firebase-free). */
export function subscribeToAuthState(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export function signOutUser(): Promise<void> {
  return signOut(getFirebaseAuth());
}

/**
 * users/{uid} profile doc — written on first sign-in and refreshed
 * (lastActiveAt + whatever changed via linking) on every subsequent app
 * load. `cohort` is a placeholder for a later educator feature and is never
 * set here. Distinct from AnatomyRepository: this is auth-adjacent account
 * data, not anatomy content or revision history.
 */
export async function touchUserProfile(user: User): Promise<void> {
  const db = getDb();
  const ref = doc(db, 'users', user.uid);
  const snapshot = await getDoc(ref);
  const fields = {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    isAnonymous: user.isAnonymous,
    lastActiveAt: serverTimestamp(),
  };

  if (snapshot.exists()) {
    await setDoc(ref, fields, { merge: true });
  } else {
    await setDoc(ref, { ...fields, createdAt: serverTimestamp(), cohort: null });
  }
}

export interface LinkResult {
  user: User;
  /**
   * True when the credential already belonged to a different account (this
   * person signed up on another device previously) — we signed them into
   * that existing account instead of linking, so THIS device's anonymous
   * progress could not be merged. Callers must surface this, not swallow it.
   */
  recoveredExistingAccount: boolean;
}

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: string }).code
    : undefined;
}

/**
 * Links `credential` to the currently-signed-in (anonymous) user, preserving
 * their uid so users/{uid}/** data carries over untouched — no migration
 * step needed since it's the same uid before and after. If the credential
 * already belongs to a different account, recovers by signing into that
 * existing account instead (see LinkResult.recoveredExistingAccount).
 *
 * Auth instance is passed in (not resolved via getFirebaseAuth()) so this
 * function is directly unit-testable against a mocked `firebase/auth`
 * without needing a real Firebase app.
 */
export async function linkAnonymousCredential(authInstance: Auth, credential: AuthCredential): Promise<LinkResult> {
  const currentUser = authInstance.currentUser;

  if (!currentUser || !currentUser.isAnonymous) {
    const result = await signInWithCredential(authInstance, credential);
    return { user: result.user, recoveredExistingAccount: false };
  }

  try {
    const result = await linkWithCredential(currentUser, credential);
    return { user: result.user, recoveredExistingAccount: false };
  } catch (error) {
    const code = errorCode(error);
    if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
      const result = await signInWithCredential(authInstance, credential);
      return { user: result.user, recoveredExistingAccount: true };
    }
    throw error;
  }
}

/**
 * Google's credential can only be minted via a popup, so this can't funnel
 * through linkAnonymousCredential the same way email/password does —
 * `linkWithPopup` does the popup + link in one call, and on
 * auth/credential-already-in-use the existing credential is recovered from
 * the error itself (GoogleAuthProvider.credentialFromError) rather than
 * being pre-built by the caller.
 */
export async function linkAnonymousWithGoogle(authInstance: Auth): Promise<LinkResult> {
  const provider = new GoogleAuthProvider();
  const currentUser = authInstance.currentUser;

  if (!currentUser || !currentUser.isAnonymous) {
    const result = await signInWithPopup(authInstance, provider);
    return { user: result.user, recoveredExistingAccount: false };
  }

  try {
    const result = await linkWithPopup(currentUser, provider);
    return { user: result.user, recoveredExistingAccount: false };
  } catch (error) {
    const code = errorCode(error);
    if (code === 'auth/credential-already-in-use') {
      const credential = GoogleAuthProvider.credentialFromError(error as AuthError);
      if (!credential) throw error;
      const result = await signInWithCredential(authInstance, credential);
      return { user: result.user, recoveredExistingAccount: true };
    }
    throw error;
  }
}

export function linkAnonymousWithEmail(authInstance: Auth, email: string, password: string): Promise<LinkResult> {
  return linkAnonymousCredential(authInstance, EmailAuthProvider.credential(email, password));
}

export type LinkInput = { provider: 'google' } | { provider: 'password'; email: string; password: string };

/** Entry point used by AuthProvider — resolves the shared Auth singleton and dispatches to the right linking primitive. */
export function linkAnonymousAccount(input: LinkInput): Promise<LinkResult> {
  const authInstance = getFirebaseAuth();
  return input.provider === 'google'
    ? linkAnonymousWithGoogle(authInstance)
    : linkAnonymousWithEmail(authInstance, input.email, input.password);
}

/** Signs in with Google, linking the current anonymous session if there is one so uid/data carry over. */
export function signInWithGoogle(): Promise<LinkResult> {
  const authInstance = getFirebaseAuth();
  if (authInstance.currentUser?.isAnonymous) return linkAnonymousWithGoogle(authInstance);
  return signInWithPopup(authInstance, new GoogleAuthProvider()).then((result) => ({
    user: result.user,
    recoveredExistingAccount: false,
  }));
}

/** Creates a new email/password account, linking the current anonymous session if there is one so uid/data carry over. */
export function signUpWithEmail(email: string, password: string): Promise<LinkResult> {
  const authInstance = getFirebaseAuth();
  if (authInstance.currentUser?.isAnonymous) return linkAnonymousWithEmail(authInstance, email, password);
  return createUserWithEmailAndPassword(authInstance, email, password).then((result) => ({
    user: result.user,
    recoveredExistingAccount: false,
  }));
}

/** Plain existing-account login — not a link. Replaces whatever session (including an anonymous one) is active. */
export function signInWithEmail(email: string, password: string): Promise<LinkResult> {
  const authInstance = getFirebaseAuth();
  return signInWithEmailAndPassword(authInstance, email, password).then((result) => ({
    user: result.user,
    recoveredExistingAccount: false,
  }));
}
