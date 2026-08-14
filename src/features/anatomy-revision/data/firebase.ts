import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth, type User } from 'firebase/auth';

/**
 * Lazily-initialised Firebase singletons. This module is only imported when
 * VITE_PERSISTENCE=firestore (see data/repository.ts's dynamic import) or
 * when AnonymousUserProvider needs auth — "local" mode never pulls the
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
